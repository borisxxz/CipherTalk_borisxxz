import type { ReactNode } from 'react'

export const STEPS = [
  { id: 'intro', title: '欢迎', desc: '准备开始你的本地数据探索' },
  { id: 'db', title: '数据库目录', desc: '定位微信数据目录' },
  { id: 'cache', title: '缓存目录', desc: '设置本地缓存存储位置' },
  { id: 'key', title: '解密密钥', desc: '获取密钥与自动识别账号' },
  { id: 'image', title: '图片密钥', desc: '获取 XOR 与 AES 密钥' },
  { id: 'security', title: '安全防护', desc: '配置应用锁保护隐私' },
  { id: 'decrypt', title: '连接数据库', desc: '直连 WCDB 并完成配置' }
] as const

export type StepId = (typeof STEPS)[number]['id']

export interface WelcomeWizardState {
  dbPath: string
  cachePath: string
  wxid: string
  wxidOptions: string[]
  decryptKey: string
  imageXorKey: string
  imageAesKey: string
  isAccountVerified: boolean
  isMac: boolean
  hasCache: boolean
  isAddAccountMode: boolean
}

export interface StepCallbacks {
  setDbPath: (v: string) => void
  setCachePath: (v: string) => void
  setWxid: (v: string) => void
  setWxidOptions: (v: string[]) => void
  setDecryptKey: (v: string) => void
  setImageXorKey: (v: string) => void
  setImageAesKey: (v: string) => void
  setIsAccountVerified: (v: boolean) => void
  setError: (v: string) => void
}

export interface StepProps {
  state: WelcomeWizardState
  callbacks: StepCallbacks
}

export interface StepInfoContent {
  intro: ReactNode
  db: ReactNode
  cache: ReactNode
  key: ReactNode
  image: ReactNode
  security: ReactNode
  decrypt: ReactNode
}
