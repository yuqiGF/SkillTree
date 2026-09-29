import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow,
  type Edge, type Node, type NodeProps, type ReactFlowInstance,
} from '@xyflow/react'
import { ArrowLeft, Check, ChevronDown, ChevronUp, GitBranch, Layers3, Plus, Search, Sparkles, UserRound, X } from 'lucide-react'
import { api, errorMessage } from './api'
import { BubbleNode } from './GraphNodes'
import type { Category, MySkill, Skill, SkillDetail } from './types'

type Branch = { id: string; name: string; kind: 'person' | 'category' | 'group' | 'skill'; skill?: MySkill; children: Branch[] }

function StageNode({ data }: NodeProps) {
  const kind = String(data.kind)
  const childCount = Number(data.childCount || 0)
  const toggle = data.onToggle as (() => void) | undefined
  return <div className={`auto-stage auto-stage-${kind} ${data.isRoot ? 'auto-stage-root' : ''}`}>
    <Handle type="target" position={Position.Bottom} className="auto-handle" />
    <span className="auto-stage-icon">{kind === 'person' ? <UserRound size={22} /> : kind === 'category' ? <Layers3 size={20} /> : <GitBranch size={19} />}</span>
    <span><small>{kind === 'person' ? '我的成长树根' : kind === 'category' ? data.isRoot ? '分类树根' : '大分类' : '技能组'}</small><strong>{String(data.name)}</strong></span>
    {childCount > 0 && toggle && <button className="node-collapse nodrag nopan" onClick={(event) => { event.stopPropagation(); toggle() }} title={data.collapsed ? `展开 ${childCount} 个分支` : `收起 ${childCount} 个分支`}>{data.collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
    <Handle type="source" position={Position.Top} className="auto-handle" />
  </div>
}

const nodeTypes = { stage: StageNode, bubble: BubbleNode }

export function buildAutoGraph(ownerName: string, categories: Category[], mine: MySkill[], categoryId?: number, collapsed = new Set<string>(), onToggle?: (id: string) => void): { nodes: Node[]; edges: Edge[] } {
  const personRoot: Branch = { id: 'person', name: ownerName, kind: 'person', children: [] }
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]))
  const groupNames = new Map(categories.flatMap((category) => category.groups.map((group) => [group.id, group.name] as const)))
  const byCategory = new Map<number, Map<number, MySkill[]>>()
  for (const skill of mine) {
    const groups = byCategory.get(skill.categoryId) || new Map<number, MySkill[]>()
    groups.set(skill.groupId, [...(groups.get(skill.groupId) || []), skill])
    byCategory.set(skill.categoryId, groups)
  }
  for (const [categoryId, groups] of [...byCategory].sort(([a], [b]) => a - b)) {
    const category: Branch = { id: `category-${categoryId}`, name: categoryNames.get(categoryId) || groups.values().next().value?.[0]?.categoryName || '其他分类', kind: 'category', children: [] }
    for (const [groupId, skills] of [...groups].sort(([a], [b]) => a - b)) {
      const group: Branch = { id: `group-${groupId}`, name: groupNames.get(groupId) || skills[0].groupName, kind: 'group', children: [] }
      const branchBySkill = new Map(skills.map((skill) => [skill.id, { id: `skill-${skill.id}`, name: skill.name, kind: 'skill' as const, skill, children: [] as Branch[] }]))
      for (const skill of skills) {
        const branch = branchBySkill.get(skill.id)!
        const parent = skill.parents?.find((item) => item.id !== skill.id && branchBySkill.has(item.id))
        if (parent) branchBySkill.get(parent.id)!.children.push(branch)
        else group.children.push(branch)
      }
      category.children.push(group)
    }
    personRoot.children.push(category)
  }

  const root = categoryId === undefined ? personRoot : personRoot.children.find((branch) => branch.id === `category-${categoryId}`)
    || { id: `category-${categoryId}`, name: categoryNames.get(categoryId) || '分类', kind: 'category' as const, children: [] }

  let maxDepth = 0
  const depthOf = (branch: Branch, depth: number, visited = new Set<string>()) => {
    if (visited.has(branch.id)) return
    visited.add(branch.id)
    maxDepth = Math.max(maxDepth, depth)
    for (const child of collapsed.has(branch.id) ? [] : branch.children) depthOf(child, depth + 1, new Set(visited))
  }
  depthOf(root, 0)
  let nextLeaf = 0
  const nodes: Node[] = []
  const edges: Edge[] = []
  const place = (branch: Branch, depth: number, ancestors = new Set<string>()): number => {
    if (ancestors.has(branch.id)) return nextLeaf++ * 270 + 110
    const nextAncestors = new Set(ancestors).add(branch.id)
    const visibleChildren = collapsed.has(branch.id) ? [] : branch.children
    const childXs = visibleChildren.map((child) => place(child, depth + 1, nextAncestors))
    const x = childXs.length ? (childXs[0] + childXs[childXs.length - 1]) / 2 : nextLeaf++ * 270 + 110
    const y = (maxDepth - depth) * 190 + 70
    nodes.push({
      id: branch.id, type: branch.kind === 'skill' ? 'bubble' : 'stage',
      position: { x: x - (branch.kind === 'skill' ? 110 : 112), y },
      draggable: false,
      data: branch.kind === 'skill'
        ? { name: branch.name, status: branch.skill?.status, level: branch.skill?.level, isChild: depth > (categoryId === undefined ? 3 : 2), vertical: true, childCount: branch.children.length, collapsed: collapsed.has(branch.id), onToggle: onToggle ? () => onToggle(branch.id) : undefined }
        : { name: branch.name, kind: branch.kind, isRoot: branch.id === root.id, childCount: branch.children.length, collapsed: collapsed.has(branch.id), onToggle: onToggle ? () => onToggle(branch.id) : undefined },
    })
    for (const child of visibleChildren) edges.push({
      id: `${branch.id}-${child.id}`, source: branch.id, target: child.id,
      type: 'default', interactionWidth: 0,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#80ae98', width: 14, height: 14 },
      style: { stroke: branch.kind === 'person' ? '#69a985' : '#91bda7', strokeWidth: branch.kind === 'person' ? 3 : 2.3 },
    })
    return x
  }
  place(root, 0)
  return { nodes, edges }
}

export default function AutoTree({ ownerName, categoryId, onBack, notify }: { ownerName: string; categoryId?: number; onBack: () => void; notify: (message: string) => void }) {
  const [mine, setMine] = useState<MySkill[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null)
  const [catalogDetail, setCatalogDetail] = useState<SkillDetail | null>(null)
  const [childrenExpanded, setChildrenExpanded] = useState(true)
  const [childFilter, setChildFilter] = useState('')
  const [status, setStatus] = useState('WANT_TO_LEARN')
  const [level, setLevel] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Skill[]>([])
  const [busy, setBusy] = useState(false)
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const reload = useCallback(async () => {
    const [skillResult, categoryResult] = await Promise.all([api.get<MySkill[]>('/me/skills'), api.get<Category[]>('/categories')])
    setMine(skillResult.data)
    setCategories(categoryResult.data)
  }, [])
  useEffect(() => { reload().catch((error) => notify(errorMessage(error))) }, [reload, notify])
  const visibleMine = useMemo(() => categoryId === undefined ? mine : mine.filter((skill) => skill.categoryId === categoryId), [mine, categoryId])
  const categoryName = categories.find((category) => category.id === categoryId)?.name
  const toggleNode = useCallback((id: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }), [])
  const { nodes, edges } = useMemo(() => buildAutoGraph(ownerName, categories, visibleMine, categoryId, collapsed, toggleNode), [ownerName, categories, visibleMine, categoryId, collapsed, toggleNode])
  useEffect(() => { if (flow && nodes.length) window.requestAnimationFrame(() => flow.fitView({ padding: 0.18, duration: 350, maxZoom: 1 })) }, [flow, nodes])
  const selectedSkill = visibleMine.find((skill) => skill.id === selectedSkillId)
  useEffect(() => {
    if (!selectedSkillId) { setCatalogDetail(null); return }
    let active = true
    setCatalogDetail(null); setChildFilter(''); setChildrenExpanded(true)
    api.get<SkillDetail>(`/skills/${selectedSkillId}`).then(({ data }) => { if (active) setCatalogDetail(data) }).catch((error) => { if (active) notify(errorMessage(error)) })
    return () => { active = false }
  }, [selectedSkillId, notify])
  useEffect(() => {
    if (!addOpen) return
    let active = true
    const timer = window.setTimeout(() => api.get<Skill[]>('/skills', { params: { q: query || undefined, categoryId, rootOnly: true } })
      .then(({ data }) => { if (active) setResults(data) }).catch((error) => { if (active) notify(errorMessage(error)) }), 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [addOpen, query, categoryId, notify])
  const addSkill = async (id: number, name: string) => {
    if (busy) return
    setBusy(true)
    try {
      await api.put(`/me/skills/${id}`, { status: 'WANT_TO_LEARN', level: 1, note: '' })
      await reload()
      setSelectedSkillId(id)
      setAddOpen(false); setQuery('')
      notify(`已将「${name}」加入技能树，所属分类和上级技能已自动排列`)
    } catch (error) { notify(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const saveProgress = async () => {
    if (!selectedSkill) return
    try {
      await api.put(`/me/skills/${selectedSkill.id}`, { status, level, note: selectedSkill.note || '' })
      await reload(); notify('学习进度已保存')
    } catch (error) { notify(errorMessage(error)) }
  }
  const chooseSkill = (id: number) => {
    const skill = visibleMine.find((item) => item.id === id)
    if (!skill) return
    setSelectedSkillId(id); setStatus(skill.status); setLevel(skill.level); setAddOpen(false)
  }
  const visibleChildren = catalogDetail?.subskills.filter((child) => child.name.toLocaleLowerCase().includes(childFilter.trim().toLocaleLowerCase())) || []
  const ownedIds = new Set(visibleMine.map((skill) => skill.id))

  return <div className="tree-editor auto-tree-editor">
    <div className="editor-toolbar"><button className="back-button" onClick={onBack}><ArrowLeft size={19} /> 返回图谱</button><div><span className="section-kicker">AUTOMATIC SKILL TREE</span><h2>{categoryId === undefined ? `${ownerName}的总体技能树` : `${categoryName || '分类'}技能树`}</h2></div><div className="editor-toolbar-actions"><span className="saved-label"><Check size={15} /> 随我的技能自动更新</span><button className="button button-dark small" onClick={() => setAddOpen(true)}><Plus size={17} /> 添加技能</button></div></div>
    <div className="editor-workspace"><div className="flow-canvas">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onInit={setFlow} nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} elementsSelectable onNodeClick={(_, node) => node.id.startsWith('skill-') ? chooseSkill(Number(node.id.slice(6))) : setSelectedSkillId(null)} onPaneClick={() => setSelectedSkillId(null)} fitView minZoom={0.15} maxZoom={1.5}>
        <Background color="#d9e7df" gap={25} size={1.3} /><Controls showInteractive={false} /><MiniMap zoomable pannable nodeColor={(node) => node.id === 'person' || node.id === `category-${categoryId}` ? '#327c60' : node.id.startsWith('skill-') ? '#79b797' : '#a7d2b8'} maskColor="rgba(244,248,246,.62)" />
      </ReactFlow>
      {visibleMine.length === 0 && <div className="canvas-empty auto-empty"><strong>{categoryId === undefined ? '你的技能树已经生根' : `${categoryName || '分类'}技能树已经生根`}</strong><p>添加技能后，技能组和技能枝叶会自动向上生长。</p><button className="button button-dark" onClick={() => setAddOpen(true)}><Plus size={17} /> 添加第一个技能</button></div>}
    </div><aside className="editor-side">
      <div className="editor-side-head"><span className="section-kicker">GROWTH PATH</span><h3>{selectedSkill ? selectedSkill.name : '自下而上生长'}</h3></div>
      {selectedSkill ? <>
        <p className="editor-side-desc">{selectedSkill.categoryName} → {selectedSkill.groupName} → {selectedSkill.name}</p>
        {selectedSkill.parents?.length > 0 && <div className="inspector-parent-path">上级技能：{selectedSkill.parents.map((parent) => parent.name).join(' · ')}</div>}
        <div className="inspector-section-label">学习进度</div><div className="inspector-status-row"><select value={status} onChange={(event) => setStatus(event.target.value)}>{[{ value: 'WANT_TO_LEARN', label: '想学习' }, { value: 'LEARNING', label: '学习中' }, { value: 'MASTERED', label: '已掌握' }, { value: 'PROFICIENT', label: '熟练' }, { value: 'EXPERT', label: '专精' }].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span>{level}/5</span></div>
        <input type="range" min="1" max="5" value={level} onChange={(event) => setLevel(Number(event.target.value))} /><button className="button button-light full inspector-save" onClick={saveProgress}>保存进度 <Check size={16} /></button>
        <div className="inspector-divider" /><button className="inspector-branch-toggle" onClick={() => setChildrenExpanded((value) => !value)} aria-expanded={childrenExpanded}><span><GitBranch size={17} /><strong>继续生长：子技能</strong><small>{catalogDetail?.subskills.length ?? '…'}</small></span><ChevronDown size={17} className={childrenExpanded ? 'open' : ''} /></button>
        {childrenExpanded && <div className="inspector-branch-body"><p>选择子技能后，它会沿当前技能向上生长，父技能会一同保留。</p>{(catalogDetail?.subskills.length || 0) > 8 && <div className="inspector-child-search"><Search size={15} /><input value={childFilter} onChange={(event) => setChildFilter(event.target.value)} placeholder="筛选子技能" /></div>}
          <div className="inspector-child-list">{visibleChildren.map((child) => <button key={child.id} onClick={() => ownedIds.has(child.id) ? chooseSkill(child.id) : addSkill(child.id, child.name)} disabled={busy}><span className="child-list-icon">{child.name.slice(0, 1).toUpperCase()}</span><span className="child-list-name">{child.name}</span><span className={ownedIds.has(child.id) ? 'child-list-added' : 'child-list-add'}>{ownedIds.has(child.id) ? <Check size={15} /> : <Plus size={16} />}</span></button>)}{catalogDetail && visibleChildren.length === 0 && <div className="inspector-child-empty">{childFilter ? '没有匹配的子技能' : '暂无子技能'}</div>}</div>
        </div>}
      </> : <><div className="instruction"><span>01</span><div><strong>{categoryId === undefined ? '个人树根' : '分类树根'}</strong><p>树根始终在底部，{categoryId === undefined ? '代表你自己' : `代表${categoryName || '当前分类'}`}。</p></div></div><div className="instruction"><span>02</span><div><strong>{categoryId === undefined ? '分类与技能组' : '技能组'}</strong><p>上方依次长出具体方向和技能。</p></div></div><div className="instruction"><span>03</span><div><strong>技能与子技能</strong><p>从「我的技能」添加后自动出现，每项学习进度单独记录。</p></div></div><div className="editor-hint"><Sparkles size={17} /> 点击技能节点可继续添加子技能。</div></>}
    </aside></div>
    {addOpen && <div className="modal-backdrop" onMouseDown={() => setAddOpen(false)}><div className="form-modal add-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setAddOpen(false)}><X size={20} /></button><span className="section-kicker">GROW YOUR TREE</span><h2>添加一个技能分支</h2><p className="modal-subtitle">选择主技能，系统会自动放在对应的技能组上方。</p><div className="search-box"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Java、MySQL、设计…" /></div><div className="add-results">{results.map((skill, index) => <button key={skill.id} onClick={() => ownedIds.has(skill.id) ? chooseSkill(skill.id) : addSkill(skill.id, skill.name)} disabled={busy}><span className={`skill-icon tint-${index % 5}`}>{skill.name.slice(0, 1)}</span><span><strong>{skill.name}</strong><small>{skill.categoryName} / {skill.groupName} · {skill.subskillCount} 个子技能</small></span>{ownedIds.has(skill.id) ? <Check size={18} /> : <Plus size={18} />}</button>)}{results.length === 0 && <p className="muted">没有匹配的技能，试试其他关键词。</p>}</div></div></div>}
  </div>
}
