import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import MacOSDock, { type DockApp } from '@/components/ui/mac-os-dock'
import { useThemeStore } from '@/stores/themeStore'
import { NAV_ITEMS } from './navConfig'

const HIDE_DELAY = 2500
const EDGE_TRIGGER_PX = 8

interface AppIconProps {
  Icon: LucideIcon
  gradient: string
}

function AppIcon({ Icon, gradient }: AppIconProps) {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background: gradient,
        borderRadius: '28%',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.15)'
      }}
    >
      <Icon className="w-[58%] h-[58%] text-white" strokeWidth={2} />
    </div>
  )
}

const ICON_GRADIENTS: Record<string, string> = {
  home:                   'linear-gradient(135deg, #4A90E2 0%, #2E6BC9 100%)',
  chat:                   'linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)',
  moments:                'linear-gradient(135deg, #FF7AA2 0%, #E84B7E 100%)',
  analytics:              'linear-gradient(135deg, #9B59B6 0%, #7A3FA0 100%)',
  'group-analytics':      'linear-gradient(135deg, #F39C12 0%, #D67E0E 100%)',
  'annual-report':        'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)',
  'transcription-assistant': 'linear-gradient(135deg, #5B6CFF 0%, #3F50E0 100%)',
  export:                 'linear-gradient(135deg, #1ABC9C 0%, #16A085 100%)',
  'data-management':      'linear-gradient(135deg, #607D8B 0%, #455A64 100%)',
  'open-api':             'linear-gradient(135deg, #00BCD4 0%, #0097A7 100%)',
  mcp:                    'linear-gradient(135deg, #EC407A 0%, #C2185B 100%)',
  agent:                  'linear-gradient(135deg, #7E57C2 0%, #5E35B1 100%)',
  settings:               'linear-gradient(135deg, #6E7B85 0%, #424A52 100%)',
}

const makeIcon = (Icon: LucideIcon, gradient: string, popOut?: boolean): ReactNode => (
  <div className="relative w-full h-full">
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background: gradient,
        borderRadius: '28%',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.15)'
      }}
    >
      <Icon className="w-[58%] h-[58%] text-white" strokeWidth={2} />
    </div>
    {popOut && (
      <span
        className="absolute -top-0.5 -right-0.5 text-[8px] leading-none text-white/70"
        style={{ textShadow: '0 0 2px rgba(0,0,0,0.6)' }}
      >
        ↗
      </span>
    )}
  </div>
)

function BottomDock() {
  const navigate = useNavigate()
  const location = useLocation()
  const autoHideSetting = useThemeStore(s => s.dockAutoHide)
  // 首页强制显示 Dock：避免用户进入软件后找不到导航
  const autoHide = autoHideSetting && location.pathname !== '/home'
  const [visible, setVisible] = useState(true)
  const hideTimerRef = useRef<number | undefined>(undefined)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== undefined) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = undefined
    }
  }, [])

  const scheduleHide = useCallback(() => {
    if (!autoHide) return
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => setVisible(false), HIDE_DELAY)
  }, [autoHide, clearHideTimer])

  // 自动收起开关变化时重置状态
  useEffect(() => {
    clearHideTimer()
    if (autoHide) {
      setVisible(true)
      scheduleHide()
    } else {
      setVisible(true)
    }
    return clearHideTimer
  }, [autoHide, clearHideTimer, scheduleHide])

  // 鼠标接近屏幕底部时浮出
  useEffect(() => {
    if (!autoHide) return
    const handler = (e: MouseEvent) => {
      if (e.clientY >= window.innerHeight - EDGE_TRIGGER_PX) {
        clearHideTimer()
        setVisible(true)
        scheduleHide()
      }
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [autoHide, clearHideTimer, scheduleHide])

  const handleMouseEnter = () => {
    clearHideTimer()
    setVisible(true)
  }

  const handleMouseLeave = () => {
    scheduleHide()
  }

  const apps: DockApp[] = NAV_ITEMS.map(item => ({
    id: item.id,
    name: item.popOutIcon ? `${item.label} ↗` : item.label,
    icon: makeIcon(item.icon, ICON_GRADIENTS[item.id] ?? 'linear-gradient(135deg, #888 0%, #666 100%)', item.popOutIcon),
  }))

  const handleAppClick = (appId: string) => {
    const item = NAV_ITEMS.find(n => n.id === appId)
    if (!item) return

    if (item.target === 'route') {
      navigate(item.route!)
    } else {
      const methodName = `open${item.windowAction}` as keyof typeof window.electronAPI.window
      try {
        void (window.electronAPI.window[methodName] as () => Promise<void>)()
      } catch (e) {
        console.error(`打开窗口失败 (${item.label}):`, e)
      }
    }
  }

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-40 pointer-events-none flex justify-center"
      style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}
      animate={{
        y: visible ? 0 : 140,
        opacity: visible ? 1 : 0
      }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={visible ? 'pointer-events-auto' : 'pointer-events-none'}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <MacOSDock apps={apps} onAppClick={handleAppClick} />
      </div>
    </motion.div>
  )
}

export default BottomDock
