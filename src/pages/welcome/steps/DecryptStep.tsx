import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../stores/appStore'
import * as configService from '../../../services/config'
import type { StepProps } from '../types'

export interface DecryptStepCallbacks {
  onCountdownChange: (countdown: number) => void
  onClosingChange: (closing: boolean) => void
}

export function DecryptStep({ state, callbacks, standalone, decryptCallbacks }: StepProps & { standalone?: boolean; decryptCallbacks: DecryptStepCallbacks }) {
  const navigate = useNavigate()
  const { setDbConnected, setMyWxid: setCurrentWxid } = useAppStore()
  const { dbPath, cachePath, wxid, decryptKey, imageXorKey, imageAesKey, isAccountVerified } = state
  const { setError } = callbacks

  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptStatus, setDecryptStatus] = useState('')

  const handleConfirm = async () => {
    if (!dbPath) { setError('请先选择数据库目录'); return }
    if (!wxid) { setError('请先选择账号目录'); return }
    if (!isAccountVerified) { setError('账号目录尚未验证，请先验证'); return }
    if (!decryptKey || decryptKey.length !== 64) { setError('请填写 64 位解密密钥'); return }

    setIsDecrypting(true)
    setError('')
    setDecryptStatus('正在保存配置...')

    try {
      const savedAccount = await configService.saveAccount({
        dbPath,
        decryptKey,
        wxid,
        cachePath,
        imageXorKey,
        imageAesKey,
        displayName: wxid || '未命名账号'
      })

      if (!savedAccount) {
        throw new Error('保存账号配置失败')
      }

      await configService.setActiveAccount(savedAccount.id)
      setCurrentWxid(wxid)

      setDecryptStatus('正在测试数据库连接...')

      const result = await window.electronAPI.wcdb.testConnection(dbPath, decryptKey, wxid)
      if (!result.success) {
        setError(result.error || 'WCDB 连接失败')
        setDecryptStatus('')
        setIsDecrypting(false)
        return
      }

      setDecryptStatus('连接成功，配置保存完成...')

      decryptCallbacks.onCountdownChange(3)
      for (let i = 3; i > 0; i--) {
        decryptCallbacks.onCountdownChange(i)
        setDecryptStatus(`配置保存成功，${i} 秒后进入应用...`)

        if (i === 3) {
          try {
            localStorage.removeItem('welcomeConfig')
          } catch (e) {
            console.error('清除缓存配置失败:', e)
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      setDbConnected(true, dbPath)
      setCurrentWxid(wxid)

      if (standalone) {
        decryptCallbacks.onClosingChange(true)
        setTimeout(() => {
          window.electronAPI.window.completeWelcome()
        }, 450)
      } else {
        navigate('/home')
      }
    } catch (e) {
      setError(`连接失败: ${e}`)
      setDecryptStatus('')
      decryptCallbacks.onCountdownChange(0)
    } finally {
      setIsDecrypting(false)
    }
  }

  return (
    <div className="setup-body">
      <div className="decrypt-summary">
        <h3>配置摘要</h3>
        <div className="summary-item">
          <span className="summary-label">数据库目录：</span>
          <span className="summary-value">{dbPath || '未设置'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">缓存目录：</span>
          <span className="summary-value">{cachePath || '未设置'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">账号目录：</span>
          <span className="summary-value">{wxid ? `${wxid}${isAccountVerified ? '（已验证）' : '（未验证）'}` : '未设置'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">解密密钥：</span>
          <span className="summary-value">{decryptKey ? '已设置 (64位)' : '未设置'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">图片密钥：</span>
          <span className="summary-value">
            {imageXorKey || imageAesKey ? '已设置' : '未设置（可选）'}
          </span>
        </div>
      </div>

      <button
        className="btn btn-primary btn-full"
        onClick={handleConfirm}
        disabled={isDecrypting}
        style={{ marginTop: '16px' }}
      >
        {isDecrypting ? '连接中...' : '连接数据库'}
      </button>

      {decryptStatus && (
        <div className="decrypt-status-container" style={{ marginTop: '16px' }}>
          <div className="field-hint status-text" style={{ textAlign: 'center' }}>
            {decryptStatus}
          </div>
        </div>
      )}

      {!isDecrypting && !decryptStatus && (
        <div className="field-hint" style={{ marginTop: '12px', textAlign: 'center' }}>
          点击"连接数据库"按钮，系统将验证配置并直连 WCDB
        </div>
      )}
    </div>
  )
}
