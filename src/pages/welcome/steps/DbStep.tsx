import { useState } from 'react'
import { dialog } from '../../../services/ipc'
import { CheckCircle2, FolderOpen, Wand2 } from 'lucide-react'
import type { StepProps } from '../types'

export function DbStep({ state, callbacks }: StepProps) {
  const { dbPath, isMac, hasCache } = state
  const { setDbPath, setError } = callbacks

  const [isDetectingPath, setIsDetectingPath] = useState(false)

  const handleAutoDetectPath = async (silent = false) => {
    if (isDetectingPath) return
    setIsDetectingPath(true)
    if (!silent) setError('')
    try {
      const result = await window.electronAPI.dbPath.autoDetect()
      if (result.success && result.path) {
        setDbPath(result.path)
        setError('')
        return
      }
      if (!silent) {
        setError(result.error || '未能自动检测到微信数据库目录')
      }
    } catch (e) {
      if (!silent) {
        setError(`自动检测失败: ${e}`)
      }
    } finally {
      setIsDetectingPath(false)
    }
  }

  const handleSelectPath = async () => {
    try {
      const result = await dialog.openFile({
        title: '选择微信数据库目录',
        properties: ['openDirectory']
      })
      if (!result.canceled && result.filePaths.length > 0) {
        setDbPath(result.filePaths[0])
        setError('')
      }
    } catch (e) {
      setError('选择目录失败')
    }
  }

  const handleOpenDetectedPath = async () => {
    if (!dbPath) {
      setError('当前没有可打开的数据库目录')
      return
    }
    try {
      const result = await window.electronAPI.shell.openPath(dbPath)
      if (result) {
        setError(result)
      }
    } catch (e) {
      setError(`打开目录失败: ${e}`)
    }
  }

  return (
    <div className="setup-body">
      <label className="field-label">数据库根目录</label>
      {hasCache && (
        <div className="field-hint" style={{ color: '#4CAF50', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle2 size={14} />
          <span>已从缓存加载配置数据</span>
        </div>
      )}
      <input
        type="text"
        className="field-input"
        placeholder={isMac
          ? '例如：~/Library/Containers/com.tencent.xinWeChat/Data/Library/Application Support/com.tencent.xinWeChat/2.0b4.0.9'
          : '例如：C:\\Users\\xxx\\Documents\\xwechat_files'}
        value={dbPath}
        onChange={(e) => setDbPath(e.target.value)}
      />
      <div className="button-row">
        <button
          className="btn btn-primary"
          onClick={() => handleAutoDetectPath()}
          disabled={isDetectingPath}
        >
          <Wand2 size={16} /> {isDetectingPath ? '自动检测中...' : '自动检测'}
        </button>
        <button className="btn btn-secondary" onClick={handleSelectPath}>
          <FolderOpen size={16} /> 浏览选择目录
        </button>
      </div>
      {dbPath && (
        <div className="button-row">
          <button className="btn btn-secondary" onClick={handleOpenDetectedPath}>
            <FolderOpen size={16} /> 打开此文件夹
          </button>
        </div>
      )}
      <div className="field-hint">{isMac ? '请选择微信版本目录或账号根目录' : '请选择微信-设置-存储位置对应的目录'}</div>
      {!isMac && (
        <div className="field-hint" style={{ color: '#ff6b6b', marginTop: '4px' }}>⚠️ 目录路径不可包含中文，如有中文请去微信-设置-存储位置点击更改，迁移至全英文目录</div>
      )}
    </div>
  )
}
