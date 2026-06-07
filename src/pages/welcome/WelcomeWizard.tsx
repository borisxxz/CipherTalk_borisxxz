import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import {
  ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Minus, X
} from 'lucide-react'
import { STEPS } from './types'
import type { WelcomeWizardState, StepCallbacks, StepId } from './types'
import { IntroStep } from './steps/IntroStep'
import { DbStep } from './steps/DbStep'
import { CacheStep } from './steps/CacheStep'
import { KeyStep } from './steps/KeyStep'
import { ImageStep } from './steps/ImageStep'
import { SecurityStep } from './steps/SecurityStep'
import { DecryptStep } from './steps/DecryptStep'
import type { DecryptStepCallbacks } from './steps/DecryptStep'
import '../WelcomePage.scss'

interface WelcomeWizardProps {
  standalone?: boolean
}

export function WelcomeWizard({ standalone = false }: WelcomeWizardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDbConnected, setDbConnected, setMyWxid: setCurrentWxid } = useAppStore()

  const [stepIndex, setStepIndex] = useState(0)
  const [dbPath, setDbPath] = useState('')
  const [decryptKey, setDecryptKey] = useState('')
  const [imageXorKey, setImageXorKey] = useState('')
  const [imageAesKey, setImageAesKey] = useState('')
  const [cachePath, setCachePath] = useState('')
  const [wxid, setWxid] = useState('')
  const [wxidOptions, setWxidOptions] = useState<string[]>([])
  const [isAccountVerified, setIsAccountVerified] = useState(false)
  const [error, setError] = useState('')
  const [hasCache, setHasCache] = useState(false)
  const [showHookSuccessToast, setShowHookSuccessToast] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [platformInfo, setPlatformInfo] = useState<{ platform: string; arch: string }>({
    platform: 'win32',
    arch: 'x64'
  })

  const isMac = platformInfo.platform === 'darwin'
  const isAddAccountMode = new URLSearchParams(location.search).get('mode') === 'add-account'

  // Build shared state object
  const wizardState: WelcomeWizardState = {
    dbPath,
    cachePath,
    wxid,
    wxidOptions,
    decryptKey,
    imageXorKey,
    imageAesKey,
    isAccountVerified,
    isMac,
    hasCache,
    isAddAccountMode
  }

  const callbacks: StepCallbacks = {
    setDbPath,
    setCachePath,
    setWxid,
    setWxidOptions,
    setDecryptKey,
    setImageXorKey,
    setImageAesKey,
    setIsAccountVerified,
    setError
  }

  // --- Effects ---

  useEffect(() => {
    const removeStatus = window.electronAPI.wxKey?.onStatus?.((payload: { status: string }) => {
      // expose to DbStep/KeyStep via custom event
      window.dispatchEvent(new CustomEvent('wxkey-status', { detail: payload }))
      if (payload.status.includes('hook安装成功') || payload.status.includes('Hook安装成功')) {
        setShowHookSuccessToast(true)
        setTimeout(() => {
          setShowHookSuccessToast(false)
        }, 3000)
      }
    })
    const removeImageProgress = window.electronAPI.imageKey?.onProgress?.((msg: string) => {
      window.dispatchEvent(new CustomEvent('imagekey-progress', { detail: msg }))
    })

    void window.electronAPI.app.getPlatformInfo().then(setPlatformInfo).catch(() => {
      // ignore
    })

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Load cached config
    if (!isAddAccountMode) {
      try {
        const cached = localStorage.getItem('welcomeConfig')
        if (cached) {
          const config = JSON.parse(cached)
          if (config.dbPath) { setDbPath(config.dbPath); setHasCache(true) }
          if (config.cachePath) setCachePath(config.cachePath)
          if (config.wxid) setWxid(config.wxid)
          if (config.decryptKey) setDecryptKey(config.decryptKey)
          if (config.imageXorKey) setImageXorKey(config.imageXorKey)
          if (config.imageAesKey) setImageAesKey(config.imageAesKey)
        }
      } catch (e) {
        console.error('加载缓存配置失败:', e)
      }
    }

    // Auto-detect best cache path
    const initCachePath = async () => {
      if (!cachePath) {
        try {
          const result = await window.electronAPI.dbPath.getBestCachePath()
          if (result.success && result.path) {
            setCachePath(result.path)
          }
        } catch (e) {
          console.error('获取缓存路径失败:', e)
        }
      }
    }
    initCachePath()

    return () => {
      removeStatus?.()
      removeImageProgress?.()
    }
  }, [isAddAccountMode])

  // Reset wxid options when dbPath changes
  useEffect(() => {
    setWxidOptions([])
    setIsAccountVerified(false)
  }, [dbPath])

  // Auto-detect db path when entering db step
  const isAutoDetectingRef = useRef(false)
  useEffect(() => {
    const currentStep = STEPS[stepIndex]
    if (currentStep.id !== 'db') return
    if (dbPath) return
    if (isAutoDetectingRef.current) return

    isAutoDetectingRef.current = true
    void (async () => {
      try {
        const result = await window.electronAPI.dbPath.autoDetect()
        if (result.success && result.path) {
          setDbPath(result.path)
        }
      } catch {
        // silent
      } finally {
        isAutoDetectingRef.current = false
      }
    })()
  }, [stepIndex, dbPath])

  // Save config to cache
  useEffect(() => {
    if (isAddAccountMode) return
    const config = { dbPath, cachePath, wxid, decryptKey, imageXorKey, imageAesKey }
    try {
      localStorage.setItem('welcomeConfig', JSON.stringify(config))
    } catch (e) {
      console.error('保存配置到缓存失败:', e)
    }
  }, [dbPath, cachePath, wxid, decryptKey, imageXorKey, imageAesKey, isAddAccountMode])

  const decryptCallbacks: DecryptStepCallbacks = {
    onCountdownChange: setCountdown,
    onClosingChange: setIsClosing
  }

  // --- Navigation ---

  const currentStep = STEPS[stepIndex]
  const currentStepId = currentStep.id as StepId

  const canGoNext = () => {
    if (currentStepId === 'intro') return true
    if (currentStepId === 'db') return Boolean(dbPath)
    if (currentStepId === 'cache') return Boolean(cachePath)
    if (currentStepId === 'key') return decryptKey.length === 64 && Boolean(wxid) && isAccountVerified
    if (currentStepId === 'image') return true
    if (currentStepId === 'security') return true
    if (currentStepId === 'decrypt') return false
    return false
  }

  const handleNext = () => {
    if (!canGoNext()) {
      if (currentStepId === 'db' && !dbPath) setError('请先选择数据库目录')
      if (currentStepId === 'cache' && !cachePath) setError('请填写缓存目录')
      if (currentStepId === 'key') {
        if (decryptKey.length !== 64) setError('密钥长度必须为 64 个字符')
        else if (!wxid) setError('请先选择账号目录')
        else if (!isAccountVerified) setError('账号目录尚未验证，请先验证后继续')
      }
      return
    }
    setError('')
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const handleBack = () => {
    setError('')
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  // --- Window controls ---

  const showWindowControls = standalone

  const handleMinimize = () => {
    window.electronAPI.window.minimize()
  }

  const handleCloseWindow = () => {
    window.electronAPI.window.close()
  }

  const renderWindowControls = () => {
    if (!showWindowControls) return null
    return (
      <div className="window-controls">
        {isMac ? (
          <>
            <button type="button" className="window-btn is-close" onClick={handleCloseWindow} aria-label="关闭">
              <X size={14} />
            </button>
            <button type="button" className="window-btn" onClick={handleMinimize} aria-label="最小化">
              <Minus size={14} />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="window-btn" onClick={handleMinimize} aria-label="最小化">
              <Minus size={14} />
            </button>
            <button type="button" className="window-btn is-close" onClick={handleCloseWindow} aria-label="关闭">
              <X size={14} />
            </button>
          </>
        )}
      </div>
    )
  }

  // --- Info panel content ---

  const renderInfoContent = () => {
    if (currentStepId === 'intro') {
      return (
        <div className="info-content">
          <h3>准备好了吗？</h3>
          <p>接下来只需配置数据库目录和获取解密密钥。</p>
          <div className="info-tips">
            <div className="tip-item"><CheckCircle2 size={16} /><span>数据仅在本地处理</span></div>
            <div className="tip-item"><CheckCircle2 size={16} /><span>不上传任何信息</span></div>
            <div className="tip-item"><CheckCircle2 size={16} /><span>完全离线运行</span></div>
          </div>
        </div>
      )
    }
    if (currentStepId === 'db') {
      return (
        <div className="info-content">
          <h3>自动获取数据库目录</h3>
          <p>系统会优先自动识别当前设备上的微信数据存储目录。</p>
          <ul className="info-list">
            <li>进入本步骤后会先尝试自动检测</li>
            <li>检测到结果后可直接打开文件夹确认</li>
            <li>{isMac ? '若未命中，再手动选择版本目录或账号目录' : '若未命中，再按微信存储位置手动选择'}</li>
          </ul>
          {!isMac && (
            <div className="info-warning">
              <ShieldCheck size={16} />
              <span>如路径包含中文，请在微信中更改存储位置</span>
            </div>
          )}
        </div>
      )
    }
    if (currentStepId === 'cache') {
      return (
        <div className="info-content">
          <h3>缓存目录说明</h3>
          <p>用于存储解密后的图片、表情等媒体文件。</p>
          <ul className="info-list">
            <li>{isMac ? 'macOS 默认使用文稿目录下的 CipherTalkData' : '自动检测可用磁盘（优先 D、E、F 盘）'}</li>
            <li>{isMac ? '也可以手动指定到其他本地目录' : '避免使用系统盘（C盘）'}</li>
            <li>需要足够的存储空间</li>
            <li>可以手动修改路径</li>
          </ul>
        </div>
      )
    }
    if (currentStepId === 'key') {
      return (
        <div className="info-content">
          <h3>解密密钥说明</h3>
          <p>此步骤会在本机完成密钥识别与账号校验。</p>
          <ul className="info-list">
            <li>{isMac ? '建议先启动微信，并按界面提示完成授权' : '点击"自动获取"后按提示操作'}</li>
            <li>{isMac ? '识别完成后会自动尝试匹配账号目录' : '完成后会自动识别账号目录'}</li>
            <li>密钥仅保存在本地配置中</li>
          </ul>
          <div className="info-warning">
            <ShieldCheck size={16} />
            <span>{isMac ? '若系统环境不满足要求，界面会直接给出提示' : '密钥不会上传到服务器'}</span>
          </div>
        </div>
      )
    }
    if (currentStepId === 'image') {
      return (
        <div className="info-content">
          <h3>图片密钥说明</h3>
          <p>用于解密微信图片的密钥（可选）。</p>
          <ul className="info-list">
            <li>优先通过本地缓存目录和 kvcomm 码推导图片密钥</li>
            <li>{isMac ? 'kvcomm 失败时才回退到微信进程内存扫描' : '无需启动微信，秒级获取'}</li>
            <li>自动匹配当前 wxid 的密钥</li>
            <li>如无法获取，可手动填写</li>
          </ul>
        </div>
      )
    }
    if (currentStepId === 'security') {
      return (
        <div className="info-content">
          <h3>安全防护说明</h3>
          <p>为应用添加额外的安全保护（可选）。</p>
          {isMac ? (
            <>
              <ul className="info-list">
                <li>启用后每次启动需要验证</li>
                <li>使用 macOS 系统 Touch ID 进行认证</li>
                <li>若当前设备不支持，可跳过后改用应用密码</li>
                <li>保护您的聊天记录隐私</li>
              </ul>
              <div className="info-warning" style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50' }}>
                <ShieldCheck size={16} />
                <span>推荐在共享设备上开启此功能</span>
              </div>
            </>
          ) : (
            <>
              <ul className="info-list">
                <li>启用后每次启动需要验证</li>
                <li>使用 Windows Hello 进行认证</li>
                <li>支持面部识别、指纹或 PIN 码</li>
                <li>保护您的聊天记录隐私</li>
              </ul>
              <div className="info-warning" style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50' }}>
                <ShieldCheck size={16} />
                <span>推荐在公共电脑上开启此功能</span>
              </div>
            </>
          )}
        </div>
      )
    }
    if (currentStepId === 'decrypt') {
      return (
        <div className="info-content">
          <h3>连接数据库说明</h3>
          <p>直连本地 WCDB，无需落地解密缓存。</p>
          <ul className="info-list">
            <li>点击"连接数据库"验证配置</li>
            <li>系统会测试 WCDB 直连</li>
            <li>连接成功后保存账号配置</li>
            <li>完成后即可开始使用</li>
          </ul>
          <div className="info-warning">
            <ShieldCheck size={16} />
            <span>请确保前面的步骤都已正确配置</span>
          </div>
        </div>
      )
    }
    return null
  }

  // --- Step component renderer ---

  const renderStepContent = () => {
    switch (currentStepId) {
      case 'intro':
        return <IntroStep state={wizardState} callbacks={callbacks} />
      case 'db':
        return <DbStep state={wizardState} callbacks={callbacks} />
      case 'cache':
        return <CacheStep state={wizardState} callbacks={callbacks} />
      case 'key':
        return <KeyStep state={wizardState} callbacks={callbacks} />
      case 'image':
        return <ImageStep state={wizardState} callbacks={callbacks} />
      case 'security':
        return <SecurityStep state={wizardState} callbacks={callbacks} />
      case 'decrypt':
        return <DecryptStep state={wizardState} callbacks={callbacks} standalone={standalone} decryptCallbacks={decryptCallbacks} />
    }
  }

  // --- Already connected state ---

  const rootClassName = `welcome-page${isClosing ? ' is-closing' : ''}${standalone ? ' is-standalone' : ''}${showWindowControls ? (isMac ? ' is-mac' : ' is-windows') : ''}`

  if (isDbConnected && !isAddAccountMode) {
    return (
      <div className={rootClassName}>
        {renderWindowControls()}
        <div className="welcome-shell">
          <div className="connected-panel">
            <div className="connected-icon">
              <CheckCircle2 size={48} />
            </div>
            <h1>已连接数据库</h1>
            <p>配置已完成，可以开始使用了</p>
            <button
              className="btn btn-primary btn-large"
              onClick={() => {
                if (standalone) {
                  setIsClosing(true)
                  setTimeout(() => {
                    window.electronAPI.window.completeWelcome()
                  }, 450)
                } else {
                  navigate('/home')
                }
              }}
            >
              进入首页
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={rootClassName}>
      {renderWindowControls()}

      {showHookSuccessToast && (
        <div className="hook-success-toast">
          <CheckCircle2 size={18} />
          <span>Hook 安装成功，现在登录微信</span>
        </div>
      )}

      {countdown > 0 && (
        <div className="countdown-overlay">
          <div className="countdown-content">
            <div className="countdown-number-large">{countdown}</div>
            <div className="countdown-text-large">秒后进入应用</div>
          </div>
        </div>
      )}

      <div className="welcome-shell">
        <div className="progress-header">
          <div className="step-progress">
            {STEPS.map((step, index) => (
              <div key={step.id} className={`progress-step ${index === stepIndex ? 'active' : ''} ${index < stepIndex ? 'done' : ''}`}>
                <div className="progress-dot">
                  {index < stepIndex ? <CheckCircle2 size={16} /> : index + 1}
                </div>
                <div className="progress-label">{step.title}</div>
                {index < STEPS.length - 1 && <div className="progress-line" />}
              </div>
            ))}
          </div>
        </div>

        <div className="content-area">
          <div className="info-panel">
            <div className="panel-brand">
              <img src="./logo.png" alt="CipherTalk" className="brand-logo" />
              <div>
                <h1 className="brand-title">CipherTalk</h1>
                <p className="brand-subtitle">初始引导</p>
              </div>
            </div>

            <div className="info-divider"></div>

            <div className="step-header">
              <h2>{currentStep.title}</h2>
              <p className="info-desc">{currentStep.desc}</p>
            </div>

            {renderInfoContent()}

            <div className="info-footer">
              <ShieldCheck size={14} />
              <span>数据仅在本地处理，不上传服务器</span>
            </div>
          </div>

          <div className="setup-card">
            <div className="setup-body">
              {renderStepContent()}
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="setup-actions">
              <button className="btn btn-tertiary" onClick={handleBack} disabled={stepIndex === 0}>
                <ArrowLeft size={16} /> 上一步
              </button>
              {stepIndex < STEPS.length - 1 && (
                <button className="btn btn-primary" onClick={handleNext} disabled={!canGoNext()}>
                  下一步 <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
