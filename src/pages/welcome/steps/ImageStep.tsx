import { useState } from 'react'
import type { StepProps } from '../types'

export function ImageStep({ state, callbacks }: StepProps) {
  const { imageXorKey, imageAesKey, dbPath, wxid, isMac } = state
  const { setImageXorKey, setImageAesKey, setError } = callbacks

  const [isFetchingImageKey, setIsFetchingImageKey] = useState(false)
  const [imageKeyStatus, setImageKeyStatus] = useState('')

  const handleAutoGetImageKey = async () => {
    if (isFetchingImageKey) return
    if (!dbPath) {
      setError('请先选择数据库目录')
      return
    }
    setIsFetchingImageKey(true)
    setError('')
    setImageKeyStatus('正在准备获取图片密钥...')
    try {
      const accountPath = wxid ? `${dbPath}/${wxid}` : dbPath
      const result = await window.electronAPI.imageKey.getImageKeys(accountPath)
      if (result.success) {
        if (typeof result.xorKey === 'number') {
          setImageXorKey(`0x${result.xorKey.toString(16).toUpperCase().padStart(2, '0')}`)
        }
        if (result.aesKey) {
          setImageAesKey(result.aesKey)
        }
        setImageKeyStatus('已获取图片密钥')
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('CipherTalk - 图片密钥获取成功', {
            body: '已成功获取图片密钥，可以继续下一步操作',
            icon: './logo.png'
          })
        }
      } else {
        setError(result.error || '自动获取图片密钥失败')
      }
    } catch (e) {
      setError(`自动获取图片密钥失败: ${e}`)
    } finally {
      setIsFetchingImageKey(false)
    }
  }

  return (
    <div className="setup-body">
      <label className="field-label">图片 XOR 密钥</label>
      <input
        type="text"
        className="field-input"
        placeholder="例如：0xA4"
        value={imageXorKey}
        onChange={(e) => setImageXorKey(e.target.value)}
      />
      <label className="field-label">图片 AES 密钥</label>
      <input
        type="text"
        className="field-input"
        placeholder="16 位密钥"
        value={imageAesKey}
        onChange={(e) => setImageAesKey(e.target.value)}
      />
      <button className="btn btn-secondary btn-inline" onClick={handleAutoGetImageKey} disabled={isFetchingImageKey}>
        {isFetchingImageKey ? '获取中...' : '自动获取图片密钥'}
      </button>
      {imageKeyStatus && <div className="field-hint status-text">{imageKeyStatus}</div>}
      <div className="field-hint">{isMac ? '优先从 kvcomm 和模板文件推导，若失败再回退到内存扫描。' : '请在电脑微信中打开查看几个图片后再点击获取秘钥，如获取失败请重复以上操作'}</div>
      {isFetchingImageKey && <div className="field-hint status-text">{isMac ? '正在尝试 kvcomm / 内存扫描，请稍候...' : '正在扫描内存，请稍候...'}</div>}
    </div>
  )
}
