import { useState } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { CheckCircle2, Fingerprint, Lock } from 'lucide-react'
import type { StepProps } from '../types'

export function SecurityStep({ state, callbacks }: StepProps) {
  const { isMac } = state
  const { setError } = callbacks
  const { enableAuth, disableAuth, isAuthEnabled } = useAuthStore()

  const biometricLabel = isMac ? 'Touch ID' : 'Windows Hello'

  const [isEnablingAuth, setIsEnablingAuth] = useState(false)
  const [authStatus, setAuthStatus] = useState('')

  return (
    <div className="setup-body">
      <div className="auth-setup-card">
        <div className="auth-icon-large">
          {isMac ? <Lock size={48} /> : <Fingerprint size={48} />}
        </div>
        <h3>{biometricLabel} 认证</h3>
        <p className="auth-desc">
          {isMac ? '启用 Touch ID 以保护您的数据。' : '启用 Windows Hello 以保护您的数据。'}
          <br />
          {isMac ? '启用后，每次打开应用都需要进行系统 Touch ID 验证。' : '启用后，每次打开应用都需要进行生物识别或 PIN 码验证。'}
        </p>

        <div className="auth-actions">
          {!isAuthEnabled ? (
            <button
              className="btn btn-primary"
              onClick={async () => {
                setIsEnablingAuth(true)
                setAuthStatus(`正在等待${biometricLabel}验证...`)
                const result = await enableAuth()
                setIsEnablingAuth(false)
                if (result.success) {
                  setAuthStatus('已成功启用认证保护')
                } else {
                  setError(result.error || '启用失败')
                  setAuthStatus('')
                }
              }}
              disabled={isEnablingAuth}
            >
              {isEnablingAuth ? '正在配置...' : '启用应用锁'}
            </button>
          ) : (
            <div className="auth-success-state">
              <div className="success-badge">
                <CheckCircle2 size={16} />
                <span>已启用保护</span>
              </div>
              <button
                className="btn btn-text-danger"
                onClick={async () => {
                  await disableAuth()
                  setAuthStatus('')
                }}
              >
                关闭保护
              </button>
            </div>
          )}
        </div>

        {authStatus && (
          <div className="auth-status-text">
            {authStatus}
          </div>
        )}
      </div>
    </div>
  )
}
