import { Wand2 } from 'lucide-react'
import type { StepProps } from '../types'

export function IntroStep(_props: StepProps) {
  return (
    <div className="intro-message">
      <Wand2 size={32} />
      <h3>点击"下一步"开始配置</h3>
      <p>整个过程大约需要 3-5 分钟</p>
    </div>
  )
}
