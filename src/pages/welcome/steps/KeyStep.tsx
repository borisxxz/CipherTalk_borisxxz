import { useState } from 'react'
import { dialog } from '../../../services/ipc'
import { Eye, EyeOff, FolderOpen } from 'lucide-react'
import type { StepProps } from '../types'

export function KeyStep({ state, callbacks }: StepProps) {
  const {
    dbPath, wxid, wxidOptions, decryptKey,
    isAccountVerified, isMac
  } = state
  const {
    setWxid, setWxidOptions, setDecryptKey,
    setIsAccountVerified, setError
  } = callbacks

  const [isScanningWxid, setIsScanningWxid] = useState(false)
  const [isFetchingDbKey, setIsFetchingDbKey] = useState(false)
  const [isVerifyingAccount, setIsVerifyingAccount] = useState(false)
  const [showDecryptKey, setShowDecryptKey] = useState(false)
  const [dbKeyStatus, setDbKeyStatus] = useState('')
  const [showWechatPathPrompt, setShowWechatPathPrompt] = useState(false)
  const [customWechatPath, setCustomWechatPath] = useState('')

  const verifyAccountDirectory = async (candidateWxid: string, key: string, silent = false) => {
    if (!dbPath || !candidateWxid || key.length !== 64) {
      setIsAccountVerified(false)
      return false
    }
    setIsVerifyingAccount(true)
    try {
      const result = await window.electronAPI.wcdb.testConnection(dbPath, key, candidateWxid)
      if (result.success) {
        setIsAccountVerified(true)
        if (!silent) setDbKeyStatus(`账号目录验证成功：${candidateWxid}`)
        return true
      }
      setIsAccountVerified(false)
      if (!silent) setError(result.error || '账号目录验证失败，请重新选择')
      return false
    } catch (e) {
      setIsAccountVerified(false)
      if (!silent) setError(`账号目录验证失败: ${e}`)
      return false
    } finally {
      setIsVerifyingAccount(false)
    }
  }

  const handleScanWxid = async (silent = false) => {
    if (!dbPath) {
      if (!silent) setError('请先选择数据库目录')
      return []
    }
    if (isScanningWxid) return []
    setIsScanningWxid(true)
    if (!silent) setError('')
    try {
      const wxids = await window.electronAPI.dbPath.scanWxids(dbPath)
      setWxidOptions(wxids)
      setIsAccountVerified(false)
      if (wxids.length > 0) {
        let selectedWxid = ''
        if (decryptKey.length === 64) {
          const resolved = await window.electronAPI.wcdb.resolveValidWxid(dbPath, decryptKey)
          if (resolved.success && resolved.wxid && wxids.includes(resolved.wxid)) {
            selectedWxid = resolved.wxid
          }
        }
        if (!selectedWxid) {
          let accountInfo: { wxid: string; dbPath: string } | null = null
          accountInfo = await window.electronAPI.wxKey.detectCurrentAccount(dbPath, 10)
          if (!accountInfo) {
            accountInfo = await window.electronAPI.wxKey.detectCurrentAccount(dbPath, 60)
          }
          if (accountInfo && wxids.includes(accountInfo.wxid)) {
            selectedWxid = accountInfo.wxid
          }
        }
        if (!selectedWxid) {
          const wxidAccount = wxids.find(id => id.startsWith('wxid_'))
          selectedWxid = wxidAccount || wxids[0]
        }
        if (selectedWxid) {
          setWxid(selectedWxid)
          if (!silent) setError('')
        } else {
          if (!silent) setError('未能自动确定正确账号目录，请手动选择')
        }
      } else {
        if (!silent) setError('未检测到账号目录，请检查路径')
      }
      return wxids
    } catch (e) {
      if (!silent) setError(`扫描失败: ${e}`)
      return []
    } finally {
      setIsScanningWxid(false)
    }
  }

  const handleAutoGetDbKey = async (wechatPath?: string) => {
    if (isFetchingDbKey) return
    setIsFetchingDbKey(true)
    setError('')
    setDbKeyStatus('正在准备获取密钥...')
    try {
      const result = await window.electronAPI.wxKey.startGetKey(wechatPath, dbPath || undefined)
      if (result.success && result.key) {
        setDecryptKey(result.key)
        setDbKeyStatus('密钥获取成功，正在验证账号目录...')
        setError('')
        setShowWechatPathPrompt(false)
        if (dbPath) {
          const resolved = await window.electronAPI.wcdb.resolveValidWxid(dbPath, result.key)
          if (resolved.success && resolved.wxid) {
            setWxid(resolved.wxid)
            setIsAccountVerified(true)
            setDbKeyStatus(`密钥获取成功，已验证账号目录: ${resolved.wxid}`)
            return
          }
        }
        if (result.validatedWxid) {
          setWxid(result.validatedWxid)
          setDbKeyStatus(`密钥获取成功，已验证账号目录: ${result.validatedWxid}`)
          return
        }
        let accountInfo: { wxid: string; dbPath: string } | null = null
        if (dbPath) {
          accountInfo = await window.electronAPI.wxKey.detectCurrentAccount(dbPath, 10)
          if (!accountInfo) {
            accountInfo = await window.electronAPI.wxKey.detectCurrentAccount(dbPath, 60)
          }
        }
        if (accountInfo) {
          setWxid(accountInfo.wxid)
          const ok = await verifyAccountDirectory(accountInfo.wxid, result.key, true)
          if (ok) {
            setDbKeyStatus(`密钥获取成功，已验证账号目录: ${accountInfo.wxid}`)
            return
          }
        }
        const wxids = await handleScanWxid(true)
        if (wxids.length > 1) {
          setDbKeyStatus(`密钥获取成功，识别到 ${wxids.length} 个候选账号目录，请选择后验证`)
        } else if (wxids.length === 1) {
          const ok = await verifyAccountDirectory(wxids[0], result.key, true)
          setDbKeyStatus(ok ? '密钥获取成功，已自动识别并验证账号目录' : '密钥获取成功，请手动确认账号目录')
        } else {
          setDbKeyStatus('密钥获取成功，请手动选择并验证账号目录')
        }
      } else {
        if (result.needManualPath) {
          setShowWechatPathPrompt(true)
          setDbKeyStatus('需要手动选择微信安装位置')
        } else {
          setError(result.error || '自动获取密钥失败')
          setDbKeyStatus('')
        }
      }
    } catch (e) {
      setError(`自动获取密钥失败: ${e}`)
      setDbKeyStatus('')
    } finally {
      setIsFetchingDbKey(false)
    }
  }

  const handleSelectWechatPath = async () => {
    try {
      const result = await dialog.openFile({
        title: '选择微信程序 (Weixin.exe)',
        properties: ['openFile'],
        filters: [{ name: '微信程序', extensions: ['exe'] }]
      })
      if (!result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0]
        if (path.toLowerCase().endsWith('weixin.exe')) {
          setCustomWechatPath(path)
          setError('')
        } else {
          setError('请选择 Weixin.exe 文件')
        }
      }
    } catch (e) {
      setError('选择文件失败')
    }
  }

  const handleConfirmWechatPath = () => {
    if (!customWechatPath) {
      setError('请先选择微信程序')
      return
    }
    handleAutoGetDbKey(customWechatPath)
  }

  return (
    <div className="setup-body">
      <label className="field-label">账号目录（待验证）</label>
      <input
        type="text"
        className="field-input"
        placeholder="获取密钥后将自动填充"
        value={wxid}
        onChange={(e) => {
          setWxid(e.target.value)
          setIsAccountVerified(false)
        }}
      />
      {wxidOptions.length > 0 && (
        <div className="wxid-options">
          {wxidOptions.map((id) => (
            <button
              key={id}
              className={`wxid-option ${wxid === id ? 'is-selected' : ''}`}
              onClick={async () => {
                setWxid(id)
                setIsAccountVerified(false)
                if (decryptKey.length === 64) {
                  await verifyAccountDirectory(id, decryptKey)
                }
              }}
            >
              <div className="wxid-option-name">{id}</div>
            </button>
          ))}
        </div>
      )}
      <div className="button-row">
        <button
          className="btn btn-secondary btn-inline"
          onClick={() => verifyAccountDirectory(wxid, decryptKey)}
          disabled={isVerifyingAccount || !wxid || decryptKey.length !== 64}
        >
          {isVerifyingAccount ? '验证中...' : '验证账号目录'}
        </button>
      </div>
      <div className="field-hint">
        状态：{isAccountVerified ? '✅ 已验证' : '⚠️ 未验证（密钥前只能识别候选目录）'}
      </div>
      <label className="field-label">解密密钥</label>
      <div className="field-with-toggle">
        <input
          type={showDecryptKey ? 'text' : 'password'}
          className="field-input"
          placeholder="64 位十六进制密钥"
          value={decryptKey}
          onChange={(e) => setDecryptKey(e.target.value.trim())}
        />
        <button type="button" className="toggle-btn" onClick={() => setShowDecryptKey(!showDecryptKey)}>
          {showDecryptKey ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      <button className="btn btn-secondary btn-inline" onClick={() => handleAutoGetDbKey()} disabled={isFetchingDbKey}>
        {isFetchingDbKey ? '获取中...' : '自动获取密钥'}
      </button>

      {!isMac && showWechatPathPrompt && (
        <div className="manual-prompt">
          <p className="prompt-text">未能自动找到微信安装位置，请手动选择 Weixin.exe</p>
          <input
            type="text"
            className="field-input"
            placeholder="例如：C:\Program Files\Tencent\WeChat\Weixin.exe"
            value={customWechatPath}
            onChange={(e) => setCustomWechatPath(e.target.value)}
            style={{ marginBottom: '8px' }}
          />
          <div className="button-row">
            <button className="btn btn-secondary" onClick={handleSelectWechatPath}>
              <FolderOpen size={16} /> 浏览选择
            </button>
            <button className="btn btn-primary" onClick={handleConfirmWechatPath}>
              确认并继续
            </button>
          </div>
        </div>
      )}

      {dbKeyStatus && <div className="field-hint status-text">{dbKeyStatus}</div>}
      <div className="field-hint">{isMac ? '获取密钥会调用 mac helper，并尝试识别候选账号目录' : '获取密钥会自动启动微信并识别候选账号目录'}</div>
      <div className="field-hint">
        {isMac ? 'macOS 要求先关闭 SIP；点击后会弹出管理员授权，再等待微信触发数据库访问即可。' : <>点击自动获取后等待提示<span style={{ color: 'red' }}>hook安装成功</span>，然后登录微信即可</>}
      </div>
    </div>
  )
}
