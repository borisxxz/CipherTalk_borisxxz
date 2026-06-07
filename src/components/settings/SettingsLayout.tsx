import { lazy, Suspense, useState, useEffect } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import type { UpdateDownloadProgressPayload } from '../../types/electron'
import type { AccountProfile } from '../../types/account'
import * as configService from '../../services/config'
import BackgroundFx from './BackgroundFx'
import AboutTab from './tabs/AboutTab'
import ActivationTab from './tabs/ActivationTab'
import AppearanceTab from './tabs/AppearanceTab'
import SecurityTab from './tabs/SecurityTab'
import type { UpdateInfo } from './types'
import { useSettingsStore } from './settingsStore'
import { FloatingSaveButton, Toast } from './ui'
import {
  Palette, Database, HardDrive, Info, Mic,
  Sparkles, Lock
} from 'lucide-react'
import '../../pages/SettingsPage.scss'

const AISummarySettings = lazy(() => import('../ai/AISummarySettings'))
const DataManagementTab = lazy(() => import('./tabs/DataManagementTab'))
const DatabaseTab = lazy(() => import('./tabs/DatabaseTab'))
const SttTab = lazy(() => import('./tabs/SttTab'))

type SettingsTab = 'appearance' | 'database' | 'stt' | 'ai' | 'data' | 'security' | 'activation' | 'about'

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'database', label: '数据解密', icon: Database },
  { id: 'security', label: '安全设置', icon: Lock },
  { id: 'stt', label: '语音转文字', icon: Mic },
  { id: 'ai', label: 'AI 摘要', icon: Sparkles },
  { id: 'data', label: '数据管理', icon: HardDrive },
  // { id: 'activation', label: '激活', icon: Shield },
  { id: 'about', label: '关于', icon: Info }
]

function SettingsLayout() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { setDbConnected, setLoading } = useAppStore()
  const hydrateSettings = useSettingsStore(s => s.hydrate)
  const commitSettings = useSettingsStore(s => s.commit)
  const storeHasUnsavedChanges = useSettingsStore(s => s.hasUnsavedChanges)
  const storeIsSaving = useSettingsStore(s => s.isSaving)

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab')
    if (tab && tabs.some(t => t.id === tab)) {
      return tab as SettingsTab
    }
    return 'appearance'
  })

  const [isLoading, setIsLoadingState] = useState(false)
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null)

  // AboutTab 相关状态
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadProgressDetail, setDownloadProgressDetail] = useState<UpdateDownloadProgressPayload | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  const [platformInfo, setPlatformInfo] = useState<{ platform: string; arch: string }>({
    platform: 'win32',
    arch: 'x64'
  })

  const isMac = platformInfo.platform === 'darwin'

  // ---- 初始化 ----

  useEffect(() => {
    loadConfig()
    loadAppVersion()
    void window.electronAPI.app.getPlatformInfo().then(setPlatformInfo).catch(() => {
      // ignore
    })
  }, [])

  // ---- 消息提示 ----

  const showMessage = (text: string, success: boolean) => {
    setMessage({ text, success })
    setTimeout(() => setMessage(null), 3000)
  }

  // ---- 配置加载 ----

  const loadConfig = async () => {
    try {
      const [accounts, activeAccount] = await Promise.all([
        configService.listAccounts(),
        configService.getActiveAccount()
      ])

      const editingAccount = activeAccount || accounts[0] || null

      // 并行加载所有持久化配置
      const [
        savedKey, savedPath, savedWxid, savedCachePath,
        savedXorKey, savedAesKey, savedExportPath,
        savedSttLanguages, savedSttModelType, savedSttMode,
        savedSttOnlineProvider, savedSttOnlineApiKey, savedSttOnlineBaseURL,
        savedSttOnlineModel, savedSttOnlineLanguage,
        savedSttOnlineTimeoutMs, savedSttOnlineMaxConcurrency,
        savedSkipIntegrityCheck, savedAutoUpdateDatabase,
        savedCheckInterval, savedMinInterval, savedDebounceTime,
        savedQuoteStyle, savedExportDefaultDateRange,
        savedAiProvider, savedAiApiKey, savedAiModel, savedAiDefaultTimeRange,
        savedAiSummaryDetail, savedAiSystemPromptPreset, savedAiCustomSystemPrompt,
        savedAiEnableThinking, savedAiMessageLimit,
        savedAiAgentDecisionMaxTokens, savedAiAgentAnswerMaxTokens,
        savedCloseToTray
      ] = await Promise.all([
        configService.getDecryptKey(),
        configService.getDbPath(),
        configService.getMyWxid(),
        configService.getCachePath(),
        configService.getImageXorKey(),
        configService.getImageAesKey(),
        configService.getExportPath(),
        configService.getSttLanguages(),
        configService.getSttModelType(),
        configService.getSttMode(),
        configService.getSttOnlineProvider(),
        configService.getSttOnlineApiKey(),
        configService.getSttOnlineBaseURL(),
        configService.getSttOnlineModel(),
        configService.getSttOnlineLanguage(),
        configService.getSttOnlineTimeoutMs(),
        configService.getSttOnlineMaxConcurrency(),
        configService.getSkipIntegrityCheck(),
        configService.getAutoUpdateDatabase(),
        configService.getAutoUpdateCheckInterval(),
        configService.getAutoUpdateMinInterval(),
        configService.getAutoUpdateDebounceTime(),
        configService.getQuoteStyle(),
        configService.getExportDefaultDateRange(),
        configService.getAiProvider(),
        configService.getAiApiKey(),
        configService.getAiModel(),
        configService.getAiDefaultTimeRange(),
        configService.getAiSummaryDetail(),
        configService.getAiSystemPromptPreset(),
        configService.getAiCustomSystemPrompt(),
        configService.getAiEnableThinking(),
        configService.getAiMessageLimit(),
        configService.getAiAgentDecisionMaxTokens(),
        configService.getAiAgentAnswerMaxTokens(),
        configService.getCloseToTray()
      ])

      const editingId = editingAccount?.id || ''
      const effectiveKey = editingAccount?.decryptKey || savedKey || ''
      const effectivePath = editingAccount?.dbPath || savedPath || ''
      const effectiveWxid = editingAccount?.wxid || savedWxid || ''
      const effectiveCachePath = editingAccount?.cachePath || savedCachePath || ''
      const effectiveXorKey = editingAccount?.imageXorKey || savedXorKey || ''
      const effectiveAesKey = editingAccount?.imageAesKey || savedAesKey || ''

      hydrateSettings({
        decryptKey: effectiveKey,
        dbPath: effectivePath,
        wxid: effectiveWxid,
        cachePath: effectiveCachePath,
        imageXorKey: effectiveXorKey,
        imageAesKey: effectiveAesKey,
        editingAccountId: editingId,
        skipIntegrityCheck: savedSkipIntegrityCheck,
        autoUpdateDatabase: savedAutoUpdateDatabase,
        autoUpdateCheckInterval: savedCheckInterval,
        autoUpdateMinInterval: savedMinInterval,
        autoUpdateDebounceTime: savedDebounceTime,
        sttLanguages: savedSttLanguages && savedSttLanguages.length > 0 ? savedSttLanguages : ['zh'],
        sttModelType: savedSttModelType,
        sttMode: savedSttMode,
        sttOnlineProvider: savedSttOnlineProvider,
        sttOnlineApiKey: savedSttOnlineApiKey,
        sttOnlineBaseURL: savedSttOnlineBaseURL,
        sttOnlineModel: savedSttOnlineModel,
        sttOnlineLanguage: savedSttOnlineLanguage,
        sttOnlineTimeoutMs: savedSttOnlineTimeoutMs,
        sttOnlineMaxConcurrency: savedSttOnlineMaxConcurrency,
        quoteStyle: savedQuoteStyle,
        exportDefaultDateRange: savedExportDefaultDateRange,
        exportPath: savedExportPath || '',
        aiProvider: savedAiProvider,
        aiApiKey: savedAiApiKey,
        aiModel: savedAiModel,
        aiDefaultTimeRange: savedAiDefaultTimeRange,
        aiSummaryDetail: savedAiSummaryDetail,
        aiSystemPromptPreset: savedAiSystemPromptPreset,
        aiCustomSystemPrompt: savedAiCustomSystemPrompt,
        aiEnableThinking: savedAiEnableThinking,
        aiMessageLimit: savedAiMessageLimit,
        aiAgentDecisionMaxTokens: savedAiAgentDecisionMaxTokens,
        aiAgentAnswerMaxTokens: savedAiAgentAnswerMaxTokens,
        closeToTray: savedCloseToTray
      })
    } catch (e) {
      console.error('加载配置失败:', e)
    }
  }

  const loadAppVersion = async () => {
    try {
      const version = await window.electronAPI.app.getVersion()
      setAppVersion(version)
    } catch (e) {
      console.error('获取版本号失败:', e)
    }
  }

  // ---- 保存配置 ----

  const handleSaveConfig = async () => {
    const storeConfig = useSettingsStore.getState().config
    useSettingsStore.getState().setSaving(true)
    setIsLoadingState(true)
    setLoading(true, '正在保存配置...')

    try {
      // 保存账号相关配置
      const accountPayload = {
        wxid: storeConfig.wxid.trim(),
        dbPath: storeConfig.dbPath.trim(),
        decryptKey: storeConfig.decryptKey.trim(),
        cachePath: storeConfig.cachePath.trim(),
        imageXorKey: storeConfig.imageXorKey.trim(),
        imageAesKey: storeConfig.imageAesKey.trim(),
        displayName: storeConfig.wxid.trim() || '未命名账号'
      }

      let savedAccount: AccountProfile | null = null
      if (storeConfig.editingAccountId) {
        savedAccount = await configService.updateAccount(storeConfig.editingAccountId, accountPayload)
      } else if (accountPayload.wxid || accountPayload.dbPath || accountPayload.decryptKey || accountPayload.cachePath) {
        savedAccount = await configService.saveAccount(accountPayload)
      }

      if (savedAccount) {
        useSettingsStore.getState().setField('editingAccountId', savedAccount.id)
      }

      // 保存导出路径
      if (storeConfig.exportPath) await configService.setExportPath(storeConfig.exportPath)

      // 保存完整性检查设置
      await configService.setSkipIntegrityCheck(storeConfig.skipIntegrityCheck)
      // 保存自动更新设置
      await configService.setAutoUpdateDatabase(storeConfig.autoUpdateDatabase)
      // 保存自动同步高级参数
      await configService.setAutoUpdateCheckInterval(storeConfig.autoUpdateCheckInterval)
      await configService.setAutoUpdateMinInterval(storeConfig.autoUpdateMinInterval)
      await configService.setAutoUpdateDebounceTime(storeConfig.autoUpdateDebounceTime)

      // 保存引用样式
      await configService.setQuoteStyle(storeConfig.quoteStyle)

      // 保存导出默认设置
      await configService.setExportDefaultDateRange(storeConfig.exportDefaultDateRange)

      // 保存 AI 配置
      await configService.setAiProvider(storeConfig.aiProvider)
      await configService.setAiApiKey(storeConfig.aiApiKey)
      await configService.setAiModel(storeConfig.aiModel)
      await configService.setAiDefaultTimeRange(storeConfig.aiDefaultTimeRange)
      await configService.setAiSummaryDetail(storeConfig.aiSummaryDetail)
      await configService.setAiSystemPromptPreset(storeConfig.aiSystemPromptPreset)
      await configService.setAiCustomSystemPrompt(storeConfig.aiCustomSystemPrompt)
      await configService.setAiEnableThinking(storeConfig.aiEnableThinking)
      await configService.setAiMessageLimit(storeConfig.aiMessageLimit)
      await configService.setAiAgentDecisionMaxTokens(storeConfig.aiAgentDecisionMaxTokens)
      await configService.setAiAgentAnswerMaxTokens(storeConfig.aiAgentAnswerMaxTokens)

      // 保存 STT 配置
      await configService.setSttLanguages(storeConfig.sttLanguages)
      await configService.setSttModelType(storeConfig.sttModelType)
      await configService.setSttMode(storeConfig.sttMode)
      await configService.setSttOnlineProvider(storeConfig.sttOnlineProvider)
      await configService.setSttOnlineApiKey(storeConfig.sttOnlineApiKey)
      await configService.setSttOnlineBaseURL(storeConfig.sttOnlineBaseURL)
      await configService.setSttOnlineModel(storeConfig.sttOnlineModel)
      await configService.setSttOnlineLanguage(storeConfig.sttOnlineLanguage)
      await configService.setSttOnlineTimeoutMs(storeConfig.sttOnlineTimeoutMs)
      await configService.setSttOnlineMaxConcurrency(storeConfig.sttOnlineMaxConcurrency)

      // 保存关闭行为配置
      await configService.setCloseToTray(storeConfig.closeToTray)

      // 如果数据库配置完整，设置已连接状态
      if (storeConfig.decryptKey && storeConfig.dbPath && storeConfig.wxid && storeConfig.decryptKey.length === 64) {
        setDbConnected(true, storeConfig.dbPath)
      }

      showMessage('配置保存成功', true)
      commitSettings()
    } catch (e) {
      showMessage(`保存配置失败: ${e}`, false)
      useSettingsStore.getState().setSaving(false)
    } finally {
      setIsLoadingState(false)
      setLoading(false)
    }
  }

  // ---- 更新检查 (AboutTab) ----

  const syncUpdateState = async () => {
    try {
      const state = await window.electronAPI.app.getUpdateState?.()
      if (!state) return
      setUpdateInfo(state)
      const phase = state.diagnostics?.phase
      setIsDownloading(phase === 'downloading' || phase === 'installing')
      if (typeof state.diagnostics?.progressPercent === 'number') {
        setDownloadProgress(state.diagnostics.progressPercent)
      }
    } catch (error) {
      console.error('同步更新状态失败:', error)
    }
  }

  useEffect(() => {
    syncUpdateState()

    const removeListener = window.electronAPI.app.onDownloadProgress?.((progress: UpdateDownloadProgressPayload) => {
      setDownloadProgress(progress.percent)
      setDownloadProgressDetail(progress)
      setIsDownloading(true)
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
    return () => removeListener?.()
  }, [])

  const handleCheckUpdate = async () => {
    if (isDownloading || updateInfo?.diagnostics?.phase === 'installing') return
    setIsCheckingUpdate(true)
    try {
      const result = await window.electronAPI.app.checkForUpdates()
      if (result.hasUpdate) {
        setUpdateInfo(result)
        showMessage(result.forceUpdate ? `检测到强制更新 ${result.version}` : `发现新版本 ${result.version}`, true)
      } else {
        showMessage('当前已是最新版本', true)
      }
    } catch (e) {
      showMessage(`检查更新失败: ${e}`, false)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const handleUpdateNow = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    setDownloadProgress(0)
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
    try {
      showMessage('正在下载更新...', true)
      await window.electronAPI.app.downloadAndInstall()
    } catch (e) {
      showMessage(`更新失败: ${e}`, false)
      setIsDownloading(false)
      await syncUpdateState()
    }
  }

  // 检查导航传递的更新信息
  useEffect(() => {
    if (location.state?.updateInfo) {
      setUpdateInfo(location.state.updateInfo)
      const phase = location.state.updateInfo.diagnostics?.phase
      setIsDownloading(phase === 'downloading' || phase === 'installing')
      if (typeof location.state.updateInfo.diagnostics?.progressPercent === 'number') {
        setDownloadProgress(location.state.updateInfo.diagnostics.progressPercent)
      }
    } else {
      syncUpdateState()
    }
  }, [location.state])

  // ---- 渲染 ----

  return (
    <div className="settings-page">
      <BackgroundFx />

      <Toast message={message} />

      <div className="settings-tabs">
        {tabs.map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-body">
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'database' && (
          <Suspense fallback={<div className="tab-content">加载中...</div>}>
            <DatabaseTab showMessage={showMessage} reloadConfig={loadConfig} onSave={handleSaveConfig} />
          </Suspense>
        )}
        {activeTab === 'security' && <SecurityTab isMac={isMac} showMessage={showMessage} />}
        {activeTab === 'stt' && (
          <Suspense fallback={<div className="tab-content">加载中...</div>}>
            <SttTab active={activeTab === 'stt'} showMessage={showMessage} />
          </Suspense>
        )}
        {activeTab === 'ai' && (
          <Suspense fallback={<div className="tab-content">加载中...</div>}>
            <AISummarySettings showMessage={showMessage} />
          </Suspense>
        )}
        {activeTab === 'data' && (
          <Suspense fallback={<div className="tab-content">加载中...</div>}>
            <DataManagementTab
              showMessage={showMessage}
              reloadConfig={loadConfig}
            />
          </Suspense>
        )}
        {activeTab === 'activation' && <ActivationTab />}
        {activeTab === 'about' && (
          <AboutTab
            appVersion={appVersion}
            updateInfo={updateInfo}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            downloadProgressDetail={downloadProgressDetail}
            isCheckingUpdate={isCheckingUpdate}
            onUpdateNow={handleUpdateNow}
            onCheckUpdate={handleCheckUpdate}
          />
        )}
      </div>

      <FloatingSaveButton
        hasChanges={storeHasUnsavedChanges}
        onClick={handleSaveConfig}
        disabled={isLoading || storeIsSaving}
      />
    </div>
  )
}

export default SettingsLayout
