import { useEffect, useState } from 'react'
import { ArrowRight, Check, ChevronDown, GitBranch, Layers3, Plus, Settings2, Sparkles, X } from 'lucide-react'
import { api, errorMessage } from './api'
import type { TreeSummary, User } from './types'

export default function TreeGallery({ user, trees, onLogin, onOpen, onRefresh, notify }: {
  user: User | null; trees: TreeSummary[]; onLogin: () => void; onOpen: (id: number) => void;
  onRefresh: () => void; notify: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)
  const [visibleIds, setVisibleIds] = useState<Set<number>>(() => new Set())
  const [loadedFor, setLoadedFor] = useState<number | null>(null)
  const preferenceKey = user ? `skilltree-tree-visibility-${user.id}` : ''

  useEffect(() => {
    if (!user || !trees.length) return
    try {
      const saved = localStorage.getItem(preferenceKey)
      if (loadedFor === user.id && saved) return
      if (saved) {
        const ids = JSON.parse(saved) as number[]
        setVisibleIds(new Set(ids.filter((id) => typeof id === 'number')))
      } else setVisibleIds(new Set(trees.filter((tree) => tree.visibility !== 'AUTO_CATEGORY' || tree.nodeCount > 0).map((tree) => tree.id)))
    } catch { setVisibleIds(new Set(trees.map((tree) => tree.id))) }
    setLoadedFor(user.id)
  }, [user, trees, loadedFor, preferenceKey])

  const changeVisibility = (id: number) => {
    const next = new Set(visibleIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setVisibleIds(next)
    if (preferenceKey) localStorage.setItem(preferenceKey, JSON.stringify([...next]))
  }
  const create = async () => {
    if (!name.trim()) return notify('请先填写图谱名称')
    try {
      const { data } = await api.post<TreeSummary>('/trees', { name, description })
      const next = new Set(visibleIds).add(data.id)
      setVisibleIds(next)
      if (preferenceKey) localStorage.setItem(preferenceKey, JSON.stringify([...next]))
      setCreating(false); setName(''); setDescription('')
      onRefresh(); onOpen(data.id); notify('自定义图谱已创建')
    } catch (error) { notify(errorMessage(error)) }
  }
  const shown = trees.filter((tree) => visibleIds.has(tree.id))

  return <div className="page">
    <div className="page-heading"><div><span className="section-kicker">MY SKILL GRAPHS</span><h1>技能图谱<span className="heading-accent">.</span></h1><p>总体树与分类树从下向上生长，你可以选择要展示的树。</p></div><button className="button button-dark" onClick={() => user ? setCreating(true) : onLogin()}><Plus size={18} /> 新建图谱</button></div>
    {!user ? <div className="empty-state auth-empty"><GitBranch size={34} /><strong>登录后查看你的技能树</strong><p>你的树根会自动出现，技能从这里向上生长。</p><button className="button button-dark" onClick={onLogin}>登录 / 注册 <ArrowRight size={17} /></button></div> : <>
      <div className="tree-tip"><div className="tree-tip-icon"><GitBranch size={22} /></div><div><strong>技能树随你的学习自动生长</strong><span>总体树显示完整路径；分类树只显示对应方向。点节点上的箭头可展开或收起下级。</span></div><Sparkles size={22} /></div>
      <div className="tree-gallery-toolbar"><div><strong>已展示 {shown.length} / {trees.length} 棵树</strong><span>添加技能后，对应的分类树会自动更新</span></div><button onClick={() => setManaging((value) => !value)} aria-expanded={managing}><Settings2 size={16} /> 管理显示 <ChevronDown size={15} className={managing ? 'open' : ''} /></button></div>
      {managing && <div className="tree-visibility-panel"><div><strong>选择展示的技能树</strong><span>取消勾选只会隐藏卡片，树和学习记录仍会保留。</span></div><div className="tree-visibility-options">{trees.map((tree) => <label key={tree.id}><input type="checkbox" checked={visibleIds.has(tree.id)} onChange={() => changeVisibility(tree.id)} /><span className="tree-visibility-check"><Check size={13} /></span><span><strong>{tree.name}</strong><small>{tree.visibility === 'AUTO' ? '总体树' : tree.visibility === 'AUTO_CATEGORY' ? '分类树' : '自定义'} · {tree.nodeCount} 个技能</small></span></label>)}</div></div>}
      {shown.length ? <div className="tree-grid">{shown.map((tree, index) => <button className={`tree-card tree-card-new ${tree.visibility === 'AUTO' ? 'tree-card-overall' : ''}`} key={tree.id} onClick={() => onOpen(tree.id)}>
        <div className={`tree-card-art art-${index % 4}`}><svg viewBox="0 0 320 145" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="M160 124 C160 100 160 95 160 80" /><path d="M160 80 C155 58 103 70 87 35" /><path d="M160 80 C165 57 218 68 236 34" /><path d="M87 35 C80 22 65 23 54 16" /><path d="M236 34 C244 21 261 23 272 15" /><circle cx="160" cy="124" r="13" /><circle cx="160" cy="80" r="8" /><circle cx="87" cy="35" r="8" /><circle cx="236" cy="34" r="8" /><circle cx="54" cy="16" r="5" /><circle cx="272" cy="15" r="5" /></svg><span className="tree-art-badge">{tree.visibility === 'AUTO' ? '总体技能树' : tree.visibility === 'AUTO_CATEGORY' ? '分类技能树' : '自定义图谱'}</span></div>
        <div className="tree-card-body"><div><strong>{tree.name}</strong><p>{tree.visibility === 'AUTO' ? '个人 → 大分类 → 技能组 → 技能 → 子技能' : tree.visibility === 'AUTO_CATEGORY' ? '分类 → 技能组 → 技能 → 子技能' : tree.description || '一张正在生长的技能图谱'}</p></div><span className="tree-card-arrow"><ArrowRight size={19} /></span></div>
        <div className="tree-card-footer"><span><Layers3 size={15} /> {tree.nodeCount} 个技能</span><span>{tree.visibility.startsWith('AUTO') ? '自动生长' : '继续编辑'}</span></div>
      </button>)}</div> : <div className="empty-state"><GitBranch size={34} /><strong>当前没有展示的技能树</strong><p>通过「管理显示」选择想看的总体树或分类树。</p><button className="button button-dark" onClick={() => setManaging(true)}>管理显示 <Settings2 size={17} /></button></div>}
    </>}
    {creating && <div className="modal-backdrop" onMouseDown={() => setCreating(false)}><div className="form-modal compact" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCreating(false)}><X size={20} /></button><span className="section-kicker">NEW SKILL GRAPH</span><h2>给图谱起个名字</h2><p className="modal-subtitle">自定义图谱可自由摆放和连接技能节点。</p><label className="field-label" htmlFor="tree-name">图谱名称</label><input id="tree-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="我的技能图谱" /><label className="field-label" htmlFor="tree-description">一句话介绍 <span>选填</span></label><textarea id="tree-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} placeholder="这张图谱记录了..." /><button className="button button-dark full" onClick={create}>创建并开始编辑 <ArrowRight size={17} /></button></div></div>}
  </div>
}
