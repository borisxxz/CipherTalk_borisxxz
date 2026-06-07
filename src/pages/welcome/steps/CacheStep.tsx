import { useState } from 'react'
import { dialog } from '../../../services/ipc'
import { FolderOpen, RotateCcw } from 'lucide-react'
import type { StepProps } from '../types'

export function CacheStep({ state, callbacks }: StepProps) {
  const { cachePath, isMac } = state
  const { setCachePath, setError } = callbacks

  const handleSelectCachePath = async () => {
    try {
      const result = await dialog.openFile({
        title: '选择缓存目录',
        properties: ['openDirectory']
      })
      if (!result.canceled && result.filePaths.length > 0) {
        setCachePath(result.filePaths[0])
        setError('')
      }
    } catch (e) {
      setError('选择缓存目录失败')
    }
  }

  const handleResetCachePath = async () => {
    try {
      const result = await window.electronAPI.dbPath.getBestCachePath()
      if (result.success && result.path) {
        setCachePath(result.path)
      }
    } catch (e) {
      setError('获取默认缓存路径失败')
    }
  }

  return (
    <div className="setup-body">
      <label className="field-label">缓存目录</label>
      <input
        type="text"
        className="field-input"
        placeholder={isMac ? '~/Documents/CipherTalkData' : 'D:\\CipherTalkDB'}
        value={cachePath}
        onChange={(e) => setCachePath(e.target.value)}
      />
      <div className="button-row">
        <button className="btn btn-primary" onClick={handleSelectCachePath}>
          <FolderOpen size={16} /> 浏览选择
        </button>
        <button className="btn btn-secondary" onClick={handleResetCachePath}>
          <RotateCcw size={16} /> 恢复默认
        </button>
      </div>
      <div className="field-hint">{isMac ? '用于头像、表情与图片缓存，默认已选文稿目录' : '用于头像、表情与图片缓存，已自动选择最佳磁盘'}</div>
    </div>
  )
}
