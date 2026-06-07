import { X, Shield, Loader2 } from 'lucide-react'

export type AppUpdateInfo = {
  hasUpdate: boolean
  forceUpdate: boolean
  currentVersion: string
  version?: string
  releaseNotes?: string
  title?: string
  message?: string
  minimumSupportedVersion?: string
  reason?: 'minimum-version' | 'blocked-version'
  checkedAt: number
  updateSource: 'github' | 'custom' | 'none'
  policySource: 'github' | 'custom' | 'none'
  diagnostics?: {
    phase: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'failed'
    strategy: 'unknown' | 'differential' | 'full'
    fallbackToFull: boolean
    lastError?: string
    lastEvent?: string
    progressPercent?: number
    downloadedBytes?: number
    totalBytes?: number
    targetVersion?: string
    lastUpdatedAt: number
  }
}

export type UpdateDownloadProgressPayload = {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

type UpdateOverlayProps = {
  updateInfo: AppUpdateInfo | null
  downloadProgress: UpdateDownloadProgressPayload | null
  isUpdateDownloading: boolean
  progressPercent: number | null
  onStartUpdate: () => void
  onDismiss: () => void
}

const formatSpeed = (bytesPerSecond: number) => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '计算中'
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
}

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default function UpdateOverlay({
  updateInfo,
  downloadProgress,
  isUpdateDownloading,
  progressPercent,
  onStartUpdate,
  onDismiss,
}: UpdateOverlayProps) {
  if (!updateInfo) return null

  return (
    <>
      {/* Update available toast */}
      {!updateInfo.forceUpdate && !isUpdateDownloading && (
        <div className="update-toast">
          <div className="update-toast-icon">🎉</div>
          <div className="update-toast-content">
            <div className="update-toast-title">发现新版本</div>
            <div className="update-toast-version">v{updateInfo.version} 已发布</div>
            <div className="update-toast-version">
              更新源：{updateInfo.updateSource === 'github' ? 'borisxxz/CipherTalk_borisxxz' : '未知'}
            </div>
          </div>
          <button className="update-toast-btn" onClick={onStartUpdate}>
            立即更新
          </button>
          <button className="update-toast-close" onClick={onDismiss}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Force update overlay */}
      {updateInfo.forceUpdate && (
        <div className="force-update-overlay">
          <div className="force-update-card">
            <div className="force-update-badge">
              <Shield size={18} />
              <span>强制更新</span>
            </div>
            <h2>{updateInfo.title || '必须更新后才能继续使用'}</h2>
            <p className="force-update-desc">
              {updateInfo.message || '当前版本已被标记为需要立即升级，应用将限制继续使用，直到安装最新版本。'}
            </p>

            <div className="force-update-meta">
              <div>当前版本：v{updateInfo.currentVersion}</div>
              {updateInfo.version && <div>目标版本：v{updateInfo.version}</div>}
              {updateInfo.minimumSupportedVersion && <div>最低安全版本：v{updateInfo.minimumSupportedVersion}</div>}
              <div>更新来源：{updateInfo.updateSource === 'github' ? 'borisxxz/CipherTalk_borisxxz' : '未检测到普通更新源'}</div>
              <div>策略来源：{updateInfo.policySource === 'github' ? 'GitHub 策略源' : updateInfo.policySource === 'custom' ? '自定义策略源' : '无'}</div>
            </div>

            {updateInfo.releaseNotes && (
              <div className="force-update-notes">
                <div className="force-update-notes-title">更新说明</div>
                <pre>{updateInfo.releaseNotes}</pre>
              </div>
            )}

            {progressPercent !== null && (
              <div className="force-update-progress">
                <div className="force-update-progress-label">
                  <Loader2 size={16} className="spin" />
                  <span>正在下载更新... {progressPercent.toFixed(0)}%</span>
                </div>
                <div className="force-update-progress-bar">
                  <div className="force-update-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}

            <div className="force-update-actions">
              <button className="btn btn-primary" onClick={onStartUpdate} disabled={isUpdateDownloading}>
                立即更新
              </button>
              <button className="btn btn-secondary" onClick={() => window.electronAPI.window.close()}>
                退出应用
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download progress capsule */}
      {progressPercent !== null && (
        <div className="download-progress-capsule">
          <div className="capsule-compact">
            <Loader2 className="spin" size={14} />
            <span>更新中 {progressPercent.toFixed(0)}%</span>
          </div>
          <div className="capsule-detail">
            <div className="capsule-detail-head">
              <Loader2 className="spin" size={14} />
              <span className="capsule-detail-title">
                正在下载更新{updateInfo.version ? ` v${updateInfo.version}` : ''}
              </span>
              <span className="capsule-detail-pct">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="capsule-detail-meta">
              <span>{formatBytes(downloadProgress?.transferred ?? updateInfo.diagnostics?.downloadedBytes)} / {formatBytes(downloadProgress?.total ?? updateInfo.diagnostics?.totalBytes)}</span>
              <span>{formatSpeed(downloadProgress?.bytesPerSecond ?? 0)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
