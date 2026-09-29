import { useState } from 'react'
import { ArrowRight, Check, ChevronDown, ChevronRight, GraduationCap, Plus, Trash2, X } from 'lucide-react'
import { api, errorMessage } from './api'
import type { MySkill, User } from './types'

const statuses = [
  { value: 'WANT_TO_LEARN', label: '想学习', color: '#a8b4af' },
  { value: 'LEARNING', label: '学习中', color: '#e4a565' },
  { value: 'MASTERED', label: '已掌握', color: '#65b9ac' },
  { value: 'PROFICIENT', label: '熟练', color: '#4f9f8e' },
  { value: 'EXPERT', label: '专精', color: '#287a69' },
]
const statusLabel = (status?: string | null) => statuses.find((item) => item.value === status)?.label || '想学习'
const statusColor = (status?: string | null) => statuses.find((item) => item.value === status)?.color || '#a8b4af'

export default function MySkills({ user, mine, onLogin, onExplore, onRefresh, notify }: {
  user: User | null; mine: MySkill[]; onLogin: () => void; onExplore: () => void;
  onRefresh: () => void; notify: (message: string) => void
}) {
  const [selected, setSelected] = useState<MySkill | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [status, setStatus] = useState('WANT_TO_LEARN')
  const [level, setLevel] = useState(1)
  const [note, setNote] = useState('')

  const byId = new Map(mine.map((skill) => [skill.id, skill]))
  const children = new Map<number, MySkill[]>()
  const roots: MySkill[] = []
  for (const skill of mine) {
    const parent = skill.parents?.find((item) => item.id !== skill.id && byId.has(item.id))
    if (!parent) roots.push(skill)
    else children.set(parent.id, [...(children.get(parent.id) || []), skill])
  }
  const toggle = (id: number) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const choose = (skill: MySkill) => {
    setSelected(skill); setStatus(skill.status); setLevel(skill.level); setNote(skill.note || '')
  }
  const save = async () => {
    if (!selected) return
    try {
      await api.put(`/me/skills/${selected.id}`, { status, level, note })
      setSelected(null); onRefresh(); notify('技能进度已保存')
    } catch (error) { notify(errorMessage(error)) }
  }
  const remove = async () => {
    if (!selected || (children.get(selected.id)?.length || 0) > 0) return
    if (!window.confirm(`从我的技能中移除「${selected.name}」？`)) return
    try {
      await api.delete(`/me/skills/${selected.id}`)
      setSelected(null); onRefresh(); notify('已移除技能')
    } catch (error) { notify(errorMessage(error)) }
  }
  const renderBranch = (skill: MySkill, depth: number, ancestors = new Set<number>()): React.ReactNode => {
    if (ancestors.has(skill.id)) return null
    const nextAncestors = new Set(ancestors).add(skill.id)
    const subskills = children.get(skill.id) || []
    const isOpen = expanded.has(skill.id)
    const activeChildren = subskills.filter((child) => child.status !== 'WANT_TO_LEARN').length
    return <div className={`mine-branch ${depth === 0 ? 'mine-branch-root' : 'mine-branch-child'}`} key={skill.id}>
      <div className="mine-branch-card">
        <span className={`mine-branch-avatar tint-${depth % 5}`}>{skill.name.slice(0, 1).toUpperCase()}</span>
        <button className="mine-branch-main" onClick={() => subskills.length ? toggle(skill.id) : choose(skill)} aria-expanded={subskills.length ? isOpen : undefined}>
          <span className="mine-branch-title"><strong>{skill.name}</strong>{subskills.length > 0 && <small>{subskills.length} 个子技能 · {activeChildren} 个已开始</small>}</span>
          <span className="mine-branch-meta">{skill.categoryName} / {skill.groupName}</span>
        </button>
        <span className="status-chip" style={{ color: statusColor(skill.status), backgroundColor: `${statusColor(skill.status)}18` }}><i style={{ backgroundColor: statusColor(skill.status) }} />{statusLabel(skill.status)}</span>
        <span className="mine-branch-level">{skill.level}/5</span>
        <button className="mine-branch-edit" onClick={() => choose(skill)} title={`编辑 ${skill.name} 的学习进度`}>编辑</button>
        {subskills.length > 0 && <button className="mine-branch-toggle" onClick={() => toggle(skill.id)} aria-label={isOpen ? `收起 ${skill.name} 的子技能` : `展开 ${skill.name} 的子技能`} aria-expanded={isOpen}>{isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>}
      </div>
      {isOpen && subskills.length > 0 && <div className="mine-branch-children">{subskills.map((child) => renderBranch(child, depth + 1, nextAncestors))}</div>}
    </div>
  }

  return <div className="page">
    <div className="page-heading"><div><span className="section-kicker">MY SKILLS</span><h1>我的技能<span className="heading-accent">.</span></h1><p>先看技能分支，展开后查看每个子技能的学习情况。</p></div><button className="button button-dark" onClick={onExplore}><Plus size={18} /> 添加技能</button></div>
    {!user ? <div className="empty-state auth-empty"><GraduationCap size={34} /><strong>登录后查看你的技能树</strong><p>记录每个技能的进步。</p><button className="button button-dark" onClick={onLogin}>登录 / 注册 <ArrowRight size={17} /></button></div> : <>
      <div className="mine-summary"><div><span>技能总数</span><strong>{mine.length}</strong></div><div><span>正在学习</span><strong>{mine.filter((item) => item.status === 'LEARNING').length}</strong></div><div><span>已掌握及以上</span><strong>{mine.filter((item) => ['MASTERED', 'PROFICIENT', 'EXPERT'].includes(item.status)).length}</strong></div><div className="summary-quote">“ 一点点积累，<br /> 也能长成森林。 ”</div></div>
      {mine.length ? <div className="mine-hierarchy"><div className="mine-hierarchy-heading"><div><strong>我的技能分支</strong><span>{roots.length} 个上层技能 · 点击展开查看子技能</span></div><button onClick={() => setExpanded((current) => current.size ? new Set() : new Set(mine.map((item) => item.id)))}>{expanded.size ? '全部收起' : '全部展开'}</button></div>{roots.map((skill) => renderBranch(skill, 0))}</div> : <div className="empty-state"><GraduationCap size={34} /><strong>你的技能页还是一张白纸</strong><p>去 Skill Hub 选一个感兴趣的技能吧。</p><button className="button button-dark" onClick={onExplore}>探索技能 <ArrowRight size={17} /></button></div>}
    </>}
    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><div className="form-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => setSelected(null)}><X size={20} /></button>
      <span className="section-kicker">TRACK YOUR GROWTH</span><h2>更新 {selected.name}</h2>
      {selected.parents?.length > 0 && <p className="modal-subtitle">所属分支：{selected.parents.map((parent) => parent.name).join(' · ')}</p>}
      <label className="field-label">学习状态</label><div className="status-choice">{statuses.map((item) => <button key={item.value} className={status === item.value ? 'active' : ''} onClick={() => setStatus(item.value)}><i style={{ backgroundColor: item.color }} />{item.label}</button>)}</div>
      <label className="field-label">熟练度 <span>{level} / 5</span></label><input className="level-slider" type="range" min="1" max="5" value={level} onChange={(event) => setLevel(Number(event.target.value))} />
      <div className="range-labels"><span>刚开始</span><span>得心应手</span></div>
      <label className="field-label" htmlFor="note">学习笔记</label><textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="最近学到了什么？下一步想尝试什么？" rows={4} />
      <div className="modal-actions"><button className="text-danger" onClick={remove} disabled={(children.get(selected.id)?.length || 0) > 0} title={(children.get(selected.id)?.length || 0) > 0 ? '请先移除子技能' : undefined}><Trash2 size={16} /> 移除技能</button><button className="button button-dark" onClick={save}>保存进度 <Check size={17} /></button></div>
    </div></div>}
  </div>
}
