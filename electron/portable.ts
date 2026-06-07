import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// 便携模式：exe 旁边有 portable.marker 文件时，配置存到 data/ 目录
// 此文件必须作为 main.ts 的第一个 import，确保在其他模块读取 userData 之前设置路径
if (app.isPackaged) {
  try {
    const exeDir = path.dirname(app.getPath('exe'))
    if (fs.existsSync(path.join(exeDir, 'portable.marker'))) {
      const dataDir = path.join(exeDir, 'data')
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
      app.setPath('userData', dataDir)
    }
  } catch {}
}
