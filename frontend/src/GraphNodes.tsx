import type { CSSProperties } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const statusNames: Record<string, string> = { WANT_TO_LEARN: '想学习', LEARNING: '学习中', MASTERED: '已掌握', PROFICIENT: '熟练', EXPERT: '专精' }
const statusColors: Record<string, string> = { WANT_TO_LEARN: '#9cadb4', LEARNING: '#e6a660', MASTERED: '#68b6a6', PROFICIENT: '#4a9e88', EXPERT: '#267966' }

export function BubbleNode({ data, selected }: NodeProps) {
  const level = Number(data.level || 1)
  const status = String(data.status || 'WANT_TO_LEARN')
  const accent = statusColors[status] || statusColors.WANT_TO_LEARN
  const vertical = Boolean(data.vertical)
  const childCount = Number(data.childCount || 0)
  const toggle = data.onToggle as (() => void) | undefined
  return <div className={`bubble-node ${selected ? 'selected' : ''} ${data.isChild ? 'bubble-child' : 'bubble-parent'}`} style={{ '--node-accent': accent } as CSSProperties}>
    <Handle type="target" position={vertical ? Position.Bottom : Position.Left} className="node-handle" />
    <span className="bubble-node-mark">{String(data.name).slice(0, 1).toUpperCase()}</span>
    <span className="bubble-node-copy"><strong>{String(data.name)}</strong><small>{data.isChild ? '细分技能' : '主技能'} · {statusNames[status] || '想学习'}</small></span>
    <span className="bubble-node-level">{level}/5</span>
    {childCount > 0 && toggle && <button className="node-collapse nodrag nopan" onClick={(event) => { event.stopPropagation(); toggle() }} title={data.collapsed ? `展开 ${childCount} 个下级` : `收起 ${childCount} 个下级`}>{data.collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
    <span className="bubble-node-progress"><i style={{ width: `${level * 20}%` }} /></span>
    <Handle type="source" position={vertical ? Position.Top : Position.Right} className="node-handle" />
  </div>
}
