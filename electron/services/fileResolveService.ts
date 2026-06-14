import { join } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'
import { ConfigService } from './config'
import { dbAdapter } from './dbAdapter'

export interface FileResolvePayload {
  fileName: string
  fileMd5?: string
  fileSize?: number
  /** 消息创建时间（Unix 秒），用于推算月度目录 */
  createTime: number
}

export interface FileResolveResult {
  localPath: string
  fileName: string
}

/**
 * 聊天文件附件本地路径解析。
 *
 * 微信 4.0 将文件附件以**明文、原始文件名**存储在：
 *   <账户根>/msg/file/<YYYY-MM>/<原始文件名>
 * 月度目录由消息时间戳决定。本服务定位该文件供导出复用。
 *
 * 解析策略：
 *   1. 月度目录查找（主）：用 createTime 推算 YYYY-MM，命中即返回；
 *      未命中则扫描所有月度目录，用 fileSize 去重。
 *   2. hardlink.db 查询（回退）：按 md5 查 file_hardlink_info 取文件名与 modify_time，
 *      再走月度目录定位。
 */
export class FileResolveService {
  private static instance: FileResolveService
  private configService: ConfigService

  private constructor() {
    this.configService = new ConfigService()
  }

  static getInstance(): FileResolveService {
    if (!FileResolveService.instance) {
      FileResolveService.instance = new FileResolveService()
    }
    return FileResolveService.instance
  }

  async resolveFileAttachment(payload: FileResolvePayload): Promise<FileResolveResult | null> {
    const { fileName, fileSize, createTime } = payload
    if (!fileName) return null

    // 候选 file 基目录：readService 的直接路径 + accountDir 解析（两者任一命中即可）
    const candidates = new Set<string>()
    const direct = this.directFileBaseDir()
    if (direct) candidates.add(direct)
    const accountDir = this.resolveAccountDir()
    if (accountDir) candidates.add(join(accountDir, 'msg', 'file'))

    for (const fileBaseDir of candidates) {
      if (!existsSync(fileBaseDir)) continue
      // 主策略：月度目录查找
      const hit = this.findByMonthDirs(fileBaseDir, fileName, fileSize, createTime)
      if (hit) return { localPath: hit, fileName }
    }

    // 回退：hardlink.db 按 md5 反查文件名，再用 modify_time 走月度目录
    if (payload.fileMd5) {
      for (const fileBaseDir of candidates) {
        if (!existsSync(fileBaseDir)) continue
        const resolved = await this.resolveViaHardlink(fileBaseDir, payload.fileMd5, fileSize)
        if (resolved) return { localPath: resolved, fileName }
      }
    }

    return null
  }

  /** readService 同款直接路径：join(dbPath, myWxid, 'msg', 'file')。app 内已验证可用。 */
  private directFileBaseDir(): string | null {
    const dbPath = this.getDbPath()
    const wxid = this.getMyWxid()
    if (!dbPath || !wxid) return null
    return join(dbPath, wxid, 'msg', 'file')
  }

  /** 月度目录查找：先试 createTime 推算的月份，未命中再扫描全部月份目录。 */
  private findByMonthDirs(fileBaseDir: string, fileName: string, fileSize: number | undefined, createTime: number): string | null {
    const monthDirs = this.listMonthDirs(fileBaseDir)
    if (monthDirs.length === 0) return null

    const guessedMonth = this.monthOf(createTime)
    // 优先猜中的月份，其次按时间倒序（最近的最可能命中）
    const ordered = [guessedMonth, ...monthDirs.filter(m => m !== guessedMonth).sort().reverse()]

    const candidates: string[] = []
    for (const m of ordered) {
      const direct = join(fileBaseDir, m, fileName)
      if (existsSync(direct)) candidates.push(direct)

      // 微信偶有按文件名 stem 分子目录的结构
      const stem = fileName.replace(/\.[^.]+$/, '')
      const stemSub = join(fileBaseDir, m, stem, fileName)
      if (existsSync(stemSub)) candidates.push(stemSub)
    }

    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0]

    // 多个候选：用 fileSize 比对 st_size 选最佳；无 fileSize 则取第一个
    if (fileSize && fileSize > 0) {
      let best = candidates[0]
      let bestDiff = Infinity
      for (const c of candidates) {
        try {
          const diff = Math.abs(statSync(c).size - fileSize)
          if (diff < bestDiff) {
            bestDiff = diff
            best = c
          }
        } catch {
          continue
        }
      }
      return best
    }
    return candidates[0]
  }

  /** 列出 msg/file 下所有形如 YYYY-MM 的子目录。 */
  private listMonthDirs(fileBaseDir: string): string[] {
    try {
      return readdirSync(fileBaseDir).filter(name => /^\d{4}-\d{2}$/.test(name))
    } catch {
      return []
    }
  }

  private monthOf(unixSeconds: number): string {
    const d = new Date(unixSeconds * 1000)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }

  /** hardlink.db 回退：按 md5 取 file_name 与 modify_time，再走月度目录定位。 */
  private async resolveViaHardlink(fileBaseDir: string, md5: string, fileSize: number | undefined): Promise<string | null> {
    const hardlinkDbPath = this.resolveHardlinkDbPath()
    if (!hardlinkDbPath) return null

    const normalizedMd5 = md5.trim().toLowerCase()
    if (!/^[a-f0-9]{8,}$/.test(normalizedMd5)) return null

    try {
      const row = await dbAdapter.get<{ file_name?: string; modify_time?: number; file_size?: number }>(
        'hardlink',
        '',
        'SELECT file_name, modify_time, file_size FROM file_hardlink_info WHERE md5 = ? LIMIT 1',
        [normalizedMd5]
      )
      if (!row?.file_name) return null

      // hardlink 记录的 modify_time 决定文件实际所在月份
      const createTime = row.modify_time && row.modify_time > 0 ? Number(row.modify_time) : 0
      const size = fileSize ?? (row.file_size ? Number(row.file_size) : undefined)
      if (createTime > 0) {
        const guessed = join(fileBaseDir, this.monthOf(createTime), row.file_name)
        if (existsSync(guessed)) return guessed
      }
      // 退而求其次：全量扫描
      return this.findByMonthDirs(fileBaseDir, row.file_name, size, createTime || 0)
    } catch {
      return null
    }
  }

  private resolveHardlinkDbPath(): string | undefined {
    const accountDir = this.resolveAccountDir()
    if (!accountDir) return undefined
    const direct = join(accountDir, 'db_storage', 'hardlink', 'hardlink.db')
    if (existsSync(direct)) return direct
    // 兼容历史/其他布局
    const flat = join(accountDir, 'hardlink.db')
    if (existsSync(flat)) return flat
    return undefined
  }

  private getDbPath(): string {
    return this.configService.get('dbPath') || ''
  }

  private getMyWxid(): string {
    return this.configService.get('myWxid') || ''
  }

  /** 解析账户根目录（含 msg/file、db_storage 的目录）。镜像 videoService.resolveAccountDir。 */
  private resolveAccountDir(): string | null {
    const wxid = this.getMyWxid()
    const dbPath = this.getDbPath()
    if (!dbPath) return null

    const normalized = dbPath.replace(/[\\/]+$/, '')
    const cleanedWxid = this.cleanWxid(wxid)

    const directCandidates = new Set<string>([normalized, join(normalized, wxid)])
    if (cleanedWxid && cleanedWxid !== wxid) {
      directCandidates.add(join(normalized, cleanedWxid))
    }
    for (const candidate of directCandidates) {
      if (this.isAccountDir(candidate)) return candidate
    }

    if (!this.isDirectory(normalized)) return null
    try {
      const entries = readdirSync(normalized)
      const wxidLower = wxid.toLowerCase()
      const cleanedWxidLower = cleanedWxid.toLowerCase()
      for (const entry of entries) {
        const entryPath = join(normalized, entry)
        if (!this.isDirectory(entryPath)) continue
        const lowerEntry = entry.toLowerCase()
        if (
          lowerEntry === wxidLower ||
          lowerEntry === cleanedWxidLower ||
          lowerEntry.startsWith(`${wxidLower}_`) ||
          lowerEntry.startsWith(`${cleanedWxidLower}_`)
        ) {
          if (this.isAccountDir(entryPath)) return entryPath
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  private cleanWxid(wxid: string): string {
    const trimmed = wxid.trim()
    if (!trimmed) return trimmed
    if (trimmed.toLowerCase().startsWith('wxid_')) {
      const match = trimmed.match(/^(wxid_[^_]+)/i)
      return match ? match[1] : trimmed
    }
    const suffixMatch = trimmed.match(/^(.+)_([a-zA-Z0-9]{4})$/)
    return suffixMatch ? suffixMatch[1] : trimmed
  }

  private isAccountDir(p: string): boolean {
    return existsSync(join(p, 'msg')) || existsSync(join(p, 'db_storage'))
  }

  private isDirectory(p: string): boolean {
    try {
      return statSync(p).isDirectory()
    } catch {
      return false
    }
  }
}

export const fileResolveService = FileResolveService.getInstance()
