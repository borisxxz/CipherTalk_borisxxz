import type { LucideIcon } from 'lucide-react'
import {
  Home,
  MessageSquare,
  BarChart3,
  Users,
  FileText,
  Database,
  Download,
  Aperture,
  Network,
  Bot,
  FileAudio,
  Boxes,
  Settings,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Navigation item shared between Sidebar and BottomDock */
export interface NavItem {
  /** Unique identifier used as key / appId */
  id: string
  /** Display label */
  label: string
  /** lucide-react icon component */
  icon: LucideIcon
  /** How this item is activated */
  target: 'route' | 'window'
  /** React-router path (required when target = 'route') */
  route?: string
  /** electronAPI.window method name without the leading `open` (required when target = 'window') */
  windowAction?: string
  /** Whether to show a pop-out indicator beside the label */
  popOutIcon?: boolean
}

// ---------------------------------------------------------------------------
// Shared navigation items
// ---------------------------------------------------------------------------

export const NAV_ITEMS: NavItem[] = [
  { id: 'home',                   label: '首页',         icon: Home,         target: 'route',  route: '/home' },
  { id: 'chat',                   label: '聊天查看',     icon: MessageSquare,target: 'window', windowAction: 'ChatWindow',          popOutIcon: true },
  { id: 'moments',                label: '朋友圈',       icon: Aperture,     target: 'window', windowAction: 'MomentsWindow',        popOutIcon: true },
  { id: 'analytics',              label: '私聊分析',     icon: BarChart3,    target: 'route',  route: '/analytics' },
  { id: 'group-analytics',        label: '群聊分析',     icon: Users,        target: 'window', windowAction: 'GroupAnalyticsWindow', popOutIcon: true },
  { id: 'annual-report',          label: '年度报告',     icon: FileText,     target: 'route',  route: '/annual-report' },
  { id: 'transcription-assistant',label: '转文字助手',   icon: FileAudio,    target: 'route',  route: '/transcription-assistant' },
  { id: 'export',                 label: '导出数据',     icon: Download,     target: 'route',  route: '/export' },
  { id: 'data-management',        label: '数据管理',     icon: Database,     target: 'route',  route: '/data-management' },
  { id: 'open-api',               label: '开放接口',     icon: Network,      target: 'route',  route: '/open-api' },
  { id: 'mcp',                    label: 'MCP & Skills', icon: Boxes,        target: 'route',  route: '/mcp' },
  { id: 'agent',                  label: 'Agent',        icon: Bot,          target: 'route',  route: '/agent' },
  { id: 'settings',               label: '设置',         icon: Settings,     target: 'route',  route: '/settings' },
]
