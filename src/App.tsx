import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import BottomDock from './components/BottomDock'
import RouteGuard from './components/RouteGuard'
import DecryptProgressOverlay from './components/DecryptProgressOverlay'
import UpdateOverlay, { AppUpdateInfo, UpdateDownloadProgressPayload } from './components/UpdateOverlay'
import WelcomePage from './pages/WelcomePage'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AnnualReportPage from './pages/AnnualReportPage'
import AnnualReportWindow from './pages/AnnualReportWindow'
import AgreementPage from './pages/AgreementPage'
import GroupAnalyticsPage from './pages/GroupAnalyticsPage'
import DataManagementPage from './pages/DataManagementPage'
import SettingsPage from './pages/SettingsPage'
import OpenApiPage from './pages/OpenApiPage'
import McpPage from './pages/McpPage'
import ExportPage from './pages/ExportPage'
import TranscriptionAssistantPage from './pages/TranscriptionAssistantPage'
import ActivationPage from './pages/ActivationPage'
import ImageWindow from './pages/ImageWindow'
import VideoWindow from './pages/VideoWindow'
import BrowserWindowPage from './pages/BrowserWindowPage'
import SplashPage from './pages/SplashPage'
import AISummaryWindow from './pages/AISummaryWindow'
import ChatHistoryPage from './pages/ChatHistoryPage'
import AgentPage from './features/aiagent/AiAgentPage'
import MomentsWindow from './pages/MomentsWindow'
import { useAppStore } from './stores/appStore'
import { useThemeStore } from './stores/themeStore'
import { useChatStore } from './stores/chatStore'
import { useUpdateStatusStore } from './stores/updateStatusStore'
import { useActivationStore } from './stores/activationStore'
import * as configService from './services/config'
import { initTldList } from './utils/linkify'
import LockScreen from './pages/LockScreen'
import { useAuthStore } from './stores/authStore'
import AgreementOverlay from './components/AgreementOverlay'
import { applyWindowChromeToDocument, syncWindowControlsOverlayToDocument } from './utils/windowChrome'
import './App.scss'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setDbConnected } = useAppStore()
  const { currentTheme, themeMode, navLayout, isLoaded, loadTheme } = useThemeStore()
  const { status: activationStatus, checkStatus: checkActivationStatus, initialized: activationInitialized } = useActivationStore()
  const { isLocked, init: initAuth } = useAuthStore()


  // 协议同意状态
  const [showAgreement, setShowAgreement] = useState(false)
  const [agreementLoading, setAgreementLoading] = useState(true)

  // 激活状态
  const [showActivation, setShowActivation] = useState(false)

  // 更新提示状态
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<UpdateDownloadProgressPayload | null>(null)

  // 加载主题配置
  useEffect(() => {
    loadTheme()
    // 初始化 TLD 列表（优先从缓存读取）
    initTldList()
    // 初始化认证状态
    initAuth()
  }, [loadTheme])

  useEffect(() => {
    let cancelled = false
    let removeOverlayListeners: (() => void) | undefined

    const bindPlatformChrome = (platform?: string) => {
      const syncPlatformChrome = () => {
        if (cancelled) return
        applyWindowChromeToDocument(platform)
        syncWindowControlsOverlayToDocument(platform)
      }

      syncPlatformChrome()

      const overlay = navigator.windowControlsOverlay
      if (!overlay) {
        return
      }

      overlay.addEventListener('geometrychange', syncPlatformChrome)
      window.addEventListener('resize', syncPlatformChrome)

      removeOverlayListeners = () => {
        overlay.removeEventListener('geometrychange', syncPlatformChrome)
        window.removeEventListener('resize', syncPlatformChrome)
      }
    }

    void window.electronAPI.app.getPlatformInfo().then((info) => {
      if (cancelled) return
      bindPlatformChrome(info.platform)
    }).catch(() => {
      if (cancelled) return
      bindPlatformChrome('win32')
    })

    return () => {
      cancelled = true
      removeOverlayListeners?.()
    }
  }, [])

  // 应用主题
  useEffect(() => {
    if (!isLoaded) return
    document.documentElement.setAttribute('data-theme', currentTheme)

    const applyMode = (mode: string) => {
      document.documentElement.setAttribute('data-mode', mode)
      window.electronAPI.window.setTitleBarOverlay({ symbolColor: mode === 'dark' ? '#ffffff' : '#1a1a1a' })
    }

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyMode(mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent) => applyMode(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      applyMode(themeMode)
    }
  }, [currentTheme, themeMode, isLoaded])

  // 检查是否需要显示协议
  useEffect(() => {
    const checkAgreement = async () => {
      try {
        const needShow = await configService.needShowAgreement()
        if (needShow) {
          setShowAgreement(true)
        }
      } catch (e) {
        console.error('检查协议状态失败:', e)
      } finally {
        setAgreementLoading(false)
      }
    }
    checkAgreement()
  }, [])

  const handleAgree = async () => {
    await configService.acceptCurrentAgreement()
    setShowAgreement(false)
    // 协议同意后检查激活状态
    const status = await checkActivationStatus()
    if (!status?.isActivated || (status.daysRemaining !== null && status.daysRemaining <= 0)) {
      setShowActivation(true)
    }
  }

  const handleDisagree = () => {
    window.electronAPI.window.close()
  }

  // 检查激活状态（协议同意后）
  useEffect(() => {
    if (!showAgreement && !agreementLoading && !activationInitialized) {
      checkActivationStatus().then(status => {
        if (!status?.isActivated || (status.daysRemaining !== null && status.daysRemaining <= 0)) {
          setShowActivation(true)
        }
      })
    }
  }, [showAgreement, agreementLoading, activationInitialized])

  const handleActivated = () => {
    setShowActivation(false)
  }

  // 监听启动时的更新通知
  useEffect(() => {
    let mounted = true
    window.electronAPI.app.getUpdateState?.().then((info) => {
      if (mounted && info?.hasUpdate) {
        setUpdateInfo(info)
      }
    }).catch((error) => {
      console.error('获取更新状态失败:', error)
    })

    const removeUpdateListener = window.electronAPI.app.onUpdateAvailable?.((info) => {
      setUpdateInfo(info)
    })

    // 监听数据库是否有更新（正在解密同步）
    const removeUpdateAvailableListener = window.electronAPI.dataManagement.onUpdateAvailable?.((hasUpdate) => {
      const time = new Date().toLocaleTimeString()
      if (hasUpdate) {
        console.log(`[${time}] [自动更新] 检测到源数据库有变化，开始同步...`)
        useUpdateStatusStore.getState().setIsUpdating(true)
        useUpdateStatusStore.getState().addLog('检测到源数据库有更新，正在同步...')
      } else {
        console.log(`[${time}] [自动更新] 同步进程结束`)
        useUpdateStatusStore.getState().setIsUpdating(false)
      }
    })

    // 监听会话自动更新（静默增量同步）
    const removeSessionsListener = window.electronAPI.chat.onSessionsUpdated?.((sessions) => {
      const time = new Date().toLocaleTimeString()
      console.log(`[${time}] [自动增量更新] 收到新数据，当前活跃会话:`, sessions.length)
      useUpdateStatusStore.getState().addLog(`自动同步完成 (${sessions.length}个会话)`)
      useChatStore.getState().setSessions(sessions)
    })

    return () => {
      mounted = false
      removeUpdateListener?.()
      removeSessionsListener?.()
      removeUpdateAvailableListener?.()
    }
  }, [])

  // 监听下载进度
  useEffect(() => {
    const removeDownloadListener = window.electronAPI.app.onDownloadProgress?.((progress) => {
      setDownloadProgress(progress)
      setUpdateInfo((current) => {
        if (!current) return current
        return {
          ...current,
          diagnostics: {
            phase: 'downloading',
            strategy: current.diagnostics?.strategy || 'unknown',
            fallbackToFull: current.diagnostics?.fallbackToFull || false,
            lastError: current.diagnostics?.lastError,
            lastEvent: current.diagnostics?.lastEvent,
            progressPercent: progress.percent,
            downloadedBytes: progress.transferred,
            totalBytes: progress.total,
            targetVersion: current.version || current.diagnostics?.targetVersion,
            lastUpdatedAt: Date.now()
          }
        }
      })
    })
    return () => {
      removeDownloadListener?.()
    }
  }, [])

  const dismissUpdate = () => {
    const isDownloading = updateInfo?.diagnostics?.phase === 'downloading' || updateInfo?.diagnostics?.phase === 'installing'
    if (updateInfo?.forceUpdate || isDownloading) return
    setUpdateInfo(null)
  }

  const handleStartUpdate = () => {
    const isDownloading = updateInfo?.diagnostics?.phase === 'downloading' || updateInfo?.diagnostics?.phase === 'installing'
    if (isDownloading) return
    setUpdateInfo((current) => current ? {
      ...current,
      diagnostics: {
        phase: 'downloading',
        strategy: current.diagnostics?.strategy || 'unknown',
        fallbackToFull: current.diagnostics?.fallbackToFull || false,
        lastError: undefined,
        lastEvent: '开始下载更新',
        progressPercent: 0,
        downloadedBytes: 0,
        totalBytes: current.diagnostics?.totalBytes,
        targetVersion: current.version || current.diagnostics?.targetVersion,
        lastUpdatedAt: Date.now()
      }
    } : current)
    window.electronAPI.app.downloadAndInstall()
  }

  // 检查是否是独立聊天窗口
  const isChatWindow = location.pathname === '/chat-window'
  const isGroupAnalyticsWindow = location.pathname === '/group-analytics-window'
  const isMomentsWindow = location.pathname === '/moments-window'
  const isAnnualReportWindow = location.pathname === '/annual-report-window'
  const isAgreementWindow = location.pathname === '/agreement-window'
  const isAISummaryWindow = location.pathname === '/ai-summary-window'
  const isWelcomeWindow = location.pathname === '/welcome-window'

  // 启动时自动检查配置并连接数据库
  useEffect(() => {
    // 独立窗口不需要自动连接主数据库
    if (isChatWindow || isGroupAnalyticsWindow || isMomentsWindow || isAnnualReportWindow || isAgreementWindow || isAISummaryWindow || isWelcomeWindow || location.pathname === '/image-viewer-window') return

    const autoConnect = async () => {
      try {
        const dbPath = await configService.getDbPath()
        const decryptKey = await configService.getDecryptKey()
        const wxid = await configService.getMyWxid()

        // 如果配置完整，检查启动时是否已经连接
        if (dbPath && decryptKey && wxid) {
          // 先检查启动屏阶段是否已经成功连接
          const startupConnected = await window.electronAPI.app.getStartupDbConnected?.()
          if (startupConnected) {
            console.log('启动时已通过启动屏连接数据库，跳过重复连接')
            setDbConnected(true, dbPath)
            // 预加载用户信息
            await preloadUserInfo()
            // 如果当前在欢迎页，跳转到首页
            if (window.location.hash === '#/' || window.location.hash === '') {
              navigate('/home')
            }
            return
          }

          // 启动屏未连接，执行自动连接
          console.log('检测到已保存的配置，正在自动连接...')
          const result = await window.electronAPI.wcdb.testConnection(dbPath, decryptKey, wxid, true) // 标记为自动连接

          if (result.success) {
            console.log('自动连接成功')
            setDbConnected(true, dbPath)
            // 预加载用户信息
            await preloadUserInfo()
            // 如果当前在欢迎页，跳转到首页
            if (window.location.hash === '#/' || window.location.hash === '') {
              navigate('/home')
            }
          } else {
            console.log('自动连接失败:', result.error)
          }
        }
      } catch (e) {
        console.error('自动连接出错:', e)
      }
    }

    // 预加载用户信息
    const preloadUserInfo = async () => {
      try {
        const result = await window.electronAPI.chat.getMyUserInfo()
        if (result.success && result.userInfo) {
          useAppStore.getState().setUserInfo({
            wxid: result.userInfo.wxid,
            nickName: result.userInfo.nickName,
            alias: result.userInfo.alias,
            avatarUrl: result.userInfo.avatarUrl
          })
          console.log('用户信息预加载完成')
        } else {
          useAppStore.getState().setUserInfo(null)
        }
      } catch (e) {
        console.error('预加载用户信息失败:', e)
        useAppStore.getState().setUserInfo(null)
      }
    }

    autoConnect()
  }, [isChatWindow, isGroupAnalyticsWindow, isMomentsWindow, isAnnualReportWindow, isAgreementWindow, isAISummaryWindow, isWelcomeWindow, location.pathname, navigate, setDbConnected])

  // 独立聊天窗口 - 只显示聊天页面，无侧边栏
  if (isChatWindow) {
    return (
      <div className="chat-window-container">
        <ChatPage />
      </div>
    )
  }

  // 独立群聊分析窗口
  if (isGroupAnalyticsWindow) {
    return (
      <div className="chat-window-container">
        <GroupAnalyticsPage />
      </div>
    )
  }

  // 独立朋友圈窗口
  if (isMomentsWindow) {
    return (
      <div className="chat-window-container">
        <MomentsWindow />
      </div>
    )
  }

  // 独立年度报告窗口
  if (isAnnualReportWindow) {
    return (
      <div className="chat-window-container">
        <AnnualReportWindow />
      </div>
    )
  }

  // 独立 AI 摘要窗口
  if (isAISummaryWindow) {
    return <AISummaryWindow />
  }

  // 独立聊天记录窗口
  if (location.pathname.startsWith('/chat-history/')) {
    return (
      <div className="chat-window-container">
        <ChatHistoryPage />
      </div>
    )
  }

  // 独立引导窗口
  if (isWelcomeWindow) {
    return <WelcomePage standalone />
  }

  // 独立图片查看窗口
  if (location.pathname === '/image-viewer-window') {
    return <ImageWindow />
  }

  // 独立视频播放窗口
  if (location.pathname === '/video-player-window') {
    return <VideoWindow />
  }

  // 独立协议窗口
  if (isAgreementWindow) {
    return <AgreementPage />
  }

  // 独立浏览器窗口
  if (location.pathname === '/browser-window') {
    return <BrowserWindowPage />
  }

  // 启动屏
  if (location.pathname === '/splash') {
    return <SplashPage />
  }

  // 首次启动协议弹窗 - 全屏遮罩，不可关闭
  if (showAgreement && !agreementLoading) {
    return <AgreementOverlay onAgree={handleAgree} onDisagree={handleDisagree} />
  }

  // 激活页面 - 未激活或已过期时显示
  if (showActivation && !showAgreement) {
    return (
      <div className="app-container">
        <TitleBar />
        <ActivationPage onActivated={handleActivated} />
      </div>
    )
  }

  // 主窗口 - 完整布局
  const disableContentOverflow = ['/data-management', '/settings'].includes(location.pathname)
  const fullPageRoutes = ['/agent', '/home']
  const isFullPage = fullPageRoutes.includes(location.pathname)

  return (
    <div className="app-container">
      <TitleBar />
      <UpdateOverlay
        updateInfo={updateInfo}
        downloadProgress={downloadProgress}
        isUpdateDownloading={updateInfo?.diagnostics?.phase === 'downloading' || updateInfo?.diagnostics?.phase === 'installing'}
        progressPercent={downloadProgress?.percent ?? updateInfo?.diagnostics?.progressPercent ?? null}
        onStartUpdate={handleStartUpdate}
        onDismiss={dismissUpdate}
      />

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {navLayout === 'sidebar' && <Sidebar />}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: (disableContentOverflow || isFullPage) ? 'hidden' : 'auto',
            px: isFullPage ? 0 : 3,
            pt: isFullPage ? 0 : 3,
            pb: 0,
          }}
        >
          <RouteGuard>
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/annual-report" element={<AnnualReportPage />} />
              <Route path="/data-management" element={<DataManagementPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/open-api" element={<OpenApiPage />} />
              <Route path="/mcp" element={<McpPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/transcription-assistant" element={<TranscriptionAssistantPage />} />
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/chat-history/:sessionId/:messageId" element={<ChatHistoryPage />} />
            </Routes>
          </RouteGuard>
        </Box>
      </Box>
      {navLayout === 'dock' && <BottomDock />}
      <DecryptProgressOverlay />
      {isLocked && <LockScreen />}
    </div>
  )
}

export default App
