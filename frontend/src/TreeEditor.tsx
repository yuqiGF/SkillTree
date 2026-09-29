import { useCallback, useEffect, useState } from 'react'
import {
  Background, Controls, MarkerType, MiniMap, ReactFlow,
  useEdgesState, useNodesState,
  type Connection, type Edge, type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Check, ChevronDown, ChevronRight, CircleHelp, GitBranch, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'
import { api, errorMessage } from './api'
import AutoTree from './AutoTree'
import { BubbleNode } from './GraphNodes'
import type { RelatedSkill, Skill, SkillDetail, TreeDetail, TreeNode } from './types'

const statuses = [
  { value: 'WANT_TO_LEARN', label: '想学习', color: '#9cadb4' },
  { value: 'LEARNING', label: '学习中', color: '#e6a660' },
  { value: 'MASTERED', label: '已掌握', color: '#68b6a6' },
  { value: 'PROFICIENT', label: '熟练', color: '#4a9e88' },
  { value: 'EXPERT', label: '专精', color: '#267966' },
]
const nodeTypes = { bubble: BubbleNode }
type AddableSkill = Pick<Skill, 'id' | 'name'> | RelatedSkill

export default function TreeEditor({ treeId, ownerName, onBack, notify }: { treeId: number; ownerName: string; onBack: () => void; notify: (message: string) => void }) {
  const [detail, setDetail] = useState<TreeDetail | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Skill[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)
  const [catalogDetail, setCatalogDetail] = useState<SkillDetail | null>(null)
  const [childFilter, setChildFilter] = useState('')
  const [childrenExpanded, setChildrenExpanded] = useState(true)
  const [status, setStatus] = useState('WANT_TO_LEARN')
  const [level, setLevel] = useState(1)
  const [busy, setBusy] = useState(false)
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(() => new Set())

  const reload = useCallback(async () => {
    const { data } = await api.get<TreeDetail>(`/trees/${treeId}`)
    setDetail(data)
    const childNodes = new Set(data.edges.map((edge) => edge.targetNodeId))
    setNodes(data.nodes.map((node) => ({
      id: String(node.id), type: 'bubble', position: { x: node.x, y: node.y },
      data: { name: node.name, status: node.status || 'WANT_TO_LEARN', level: node.level || 1, isChild: childNodes.has(node.id) },
    })))
    setEdges(data.edges.map((edge) => ({
      id: String(edge.id), source: String(edge.sourceNodeId), target: String(edge.targetNodeId),
      type: 'default', interactionWidth: 24,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#83b5a0', width: 15, height: 15 },
      style: { stroke: '#83b5a0', strokeWidth: 2.5 },
    })))
  }, [treeId, setNodes, setEdges])

  useEffect(() => { reload().catch((error) => notify(errorMessage(error))) }, [reload, notify])
  useEffect(() => {
    if (!addOpen) return
    let active = true
    const timer = window.setTimeout(() => {
      api.get<Skill[]>('/skills', { params: { q: query || undefined, rootOnly: true } })
        .then(({ data }) => { if (active) setResults(data) })
        .catch((error) => { if (active) notify(errorMessage(error)) })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [addOpen, query, notify])

  const selectedNode = detail?.nodes.find((item) => item.id === selectedNodeId)
  useEffect(() => {
    if (!selectedNode) { setCatalogDetail(null); return }
    let active = true
    setCatalogDetail(null)
    setChildFilter('')
    setChildrenExpanded(true)
    api.get<SkillDetail>(`/skills/${selectedNode.skillId}`)
      .then(({ data }) => { if (active) setCatalogDetail(data) })
      .catch((error) => { if (active) notify(errorMessage(error)) })
    return () => { active = false }
  }, [selectedNode?.skillId, notify])

  const chooseNode = (node: TreeNode) => {
    setSelectedNodeId(node.id)
    setStatus(node.status || 'WANT_TO_LEARN')
    setLevel(node.level || 1)
  }
  const connect = async (connection: Connection) => {
    try {
      await api.post(`/trees/${treeId}/edges`, { sourceNodeId: Number(connection.source), targetNodeId: Number(connection.target) })
      await reload()
      notify('技能关系已连接')
    } catch (error) { notify(errorMessage(error)) }
  }
  const placeChild = (parent: TreeNode) => {
    const existing = detail?.edges.filter((edge) => edge.sourceNodeId === parent.id).length || 0
    let y = parent.y + existing * 118 - (existing ? 48 : 0)
    const x = parent.x + 280
    while (detail?.nodes.some((node) => Math.abs(node.x - x) < 180 && Math.abs(node.y - y) < 85)) y += 118
    return { x, y }
  }
  const addSkill = async (skill: AddableSkill, parent?: TreeNode) => {
    if (busy) return
    const existing = detail?.nodes.find((node) => node.skillId === skill.id)
    if (existing) {
      if (parent && !detail?.edges.some((edge) => edge.sourceNodeId === parent.id && edge.targetNodeId === existing.id)) {
        try { await api.post(`/trees/${treeId}/edges`, { sourceNodeId: parent.id, targetNodeId: existing.id }); await reload() }
        catch (error) { notify(errorMessage(error)); return }
      }
      chooseNode(existing)
      setAddOpen(false)
      return
    }
    setBusy(true)
    try {
      const count = detail?.nodes.length || 0
      const position = parent ? placeChild(parent) : { x: 90 + (count % 3) * 280, y: 90 + Math.floor(count / 3) * 155 }
      const { data } = await api.post<TreeNode>(`/trees/${treeId}/nodes`, { skillId: skill.id, ...position, parentNodeId: parent?.id || null })
      await reload()
      setSelectedNodeId(data.id)
      setStatus('WANT_TO_LEARN')
      setLevel(1)
      setAddOpen(false)
      setQuery('')
      notify(parent ? `已添加「${skill.name}」并连接到「${parent.name}」` : `已添加「${skill.name}」，可在右侧展开子技能`)
    } catch (error) { notify(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const saveProgress = async () => {
    if (!selectedNode) return
    try {
      await api.put(`/me/skills/${selectedNode.skillId}`, { status, level, note: selectedNode.note || '' })
      await reload()
      notify('技能状态已更新')
    } catch (error) { notify(errorMessage(error)) }
  }
  const removeNode = async () => {
    if (!selectedNodeId || !window.confirm('删除这个节点及其连线？技能本身仍会保留在「我的技能」中。')) return
    try {
      await api.delete(`/trees/${treeId}/nodes/${selectedNodeId}`)
      setSelectedNodeId(null)
      await reload()
      notify('节点已删除')
    } catch (error) { notify(errorMessage(error)) }
  }
  const existingIds = new Set(detail?.nodes.map((node) => node.skillId))
  const visibleChildren = catalogDetail?.subskills.filter((child) => child.name.toLocaleLowerCase().includes(childFilter.trim().toLocaleLowerCase())) || []
  const childCounts = new Map<number, number>()
  for (const edge of detail?.edges || []) childCounts.set(edge.sourceNodeId, (childCounts.get(edge.sourceNodeId) || 0) + 1)
  const hiddenNodes = new Set<number>()
  const hideDescendants = (parentId: number) => {
    for (const edge of detail?.edges || []) if (edge.sourceNodeId === parentId && !hiddenNodes.has(edge.targetNodeId)) {
      hiddenNodes.add(edge.targetNodeId)
      hideDescendants(edge.targetNodeId)
    }
  }
  for (const id of collapsedNodes) hideDescendants(id)
  const shownNodes = nodes.filter((node) => !hiddenNodes.has(Number(node.id))).map((node) => ({ ...node, data: {
    ...node.data, childCount: childCounts.get(Number(node.id)) || 0, collapsed: collapsedNodes.has(Number(node.id)),
    onToggle: () => setCollapsedNodes((current) => { const next = new Set(current); const id = Number(node.id); if (next.has(id)) next.delete(id); else next.add(id); return next }),
  } }))
  const shownEdges = edges.filter((edge) => !hiddenNodes.has(Number(edge.source)) && !hiddenNodes.has(Number(edge.target)))

  if (detail?.tree.visibility === 'AUTO' || detail?.tree.visibility === 'AUTO_CATEGORY')
    return <AutoTree ownerName={ownerName} categoryId={detail.tree.visibility === 'AUTO_CATEGORY' ? -treeId : undefined} onBack={onBack} notify={notify} />

  return <div className="tree-editor">
    <div className="editor-toolbar">
      <button className="back-button" onClick={onBack}><ArrowLeft size={19} /> 返回图谱</button>
      <div><span className="section-kicker">SKILL GRAPH EDITOR</span><h2>{detail?.tree.name || '加载中...'}</h2></div>
      <div className="editor-toolbar-actions"><span className="saved-label"><Check size={15} /> 自动保存</span><button className="button button-dark small" onClick={() => setAddOpen(true)}><Plus size={17} /> 添加主技能</button></div>
    </div>
    <div className="editor-workspace">
      <div className="flow-canvas">
        <ReactFlow
          nodes={shownNodes} edges={shownEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes} onConnect={connect}
          onNodeClick={(_, node) => { const item = detail?.nodes.find((entry) => entry.id === Number(node.id)); if (item) chooseNode(item) }}
          onPaneClick={() => setSelectedNodeId(null)}
          onNodeDragStop={(_, node) => api.patch(`/trees/${treeId}/nodes/${node.id}`, node.position).catch((error) => notify(errorMessage(error)))}
          onNodesDelete={(deleted) => Promise.all(deleted.map((node) => api.delete(`/trees/${treeId}/nodes/${node.id}`))).then(reload).catch((error) => notify(errorMessage(error)))}
          onEdgesDelete={(deleted) => Promise.all(deleted.map((edge) => api.delete(`/trees/${treeId}/edges/${edge.id}`))).then(reload).catch((error) => notify(errorMessage(error)))}
          fitView fitViewOptions={{ padding: 0.3 }} deleteKeyCode={['Delete', 'Backspace']}
        >
          <Background color="#d9e7df" gap={25} size={1.3} /><Controls showInteractive={false} />
          <MiniMap zoomable pannable nodeColor={(node) => node.data.isChild ? '#a2c8bd' : '#6aaa90'} maskColor="rgba(244,248,246,.62)" />
        </ReactFlow>
        {nodes.length === 0 && <div className="canvas-empty"><div><GitBranch size={30} /></div><strong>从一个主技能开始</strong><p>添加后点选节点，在右侧展开并挑选子技能。</p><button className="button button-dark" onClick={() => setAddOpen(true)}><Plus size={17} /> 添加主技能</button></div>}
      </div>
      <aside className="editor-side">
        <div className="editor-side-head"><span className="section-kicker">SKILL INSPECTOR</span><h3>{selectedNode ? selectedNode.name : '图谱指南'}</h3></div>
        {selectedNode ? <>
          <p className="editor-side-desc">{selectedNode.description || '记录这个技能的成长状态。'}</p>
          {catalogDetail?.parents.length ? <div className="inspector-parent-path">上级技能：{catalogDetail.parents.map((parent) => parent.name).join(' · ')}</div> : null}
          <div className="inspector-section-label">学习进度</div>
          <div className="inspector-status-row"><select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><span>{level}/5</span></div>
          <input type="range" min="1" max="5" value={level} onChange={(event) => setLevel(Number(event.target.value))} />
          <button className="button button-light full inspector-save" onClick={saveProgress}>保存进度 <Check size={16} /></button>
          <div className="inspector-divider" />
          <button className="inspector-branch-toggle" onClick={() => setChildrenExpanded((value) => !value)} aria-expanded={childrenExpanded}>
            <span><GitBranch size={17} /><strong>细分技能</strong><small>{catalogDetail?.subskills.length ?? '…'}</small></span>
            <ChevronDown size={17} className={childrenExpanded ? 'open' : ''} />
          </button>
          {childrenExpanded && <div className="inspector-branch-body">
            <p>选择要学习的子技能，节点与连线会一起添加。</p>
            {(catalogDetail?.subskills.length || 0) > 8 && <div className="inspector-child-search"><Search size={15} /><input value={childFilter} onChange={(event) => setChildFilter(event.target.value)} placeholder="筛选子技能" /></div>}
            <div className="inspector-child-list">
              {visibleChildren.map((child) => {
                const existing = detail?.nodes.find((node) => node.skillId === child.id)
                return <button key={child.id} onClick={() => addSkill(child, selectedNode)} disabled={busy}>
                  <span className="child-list-icon">{child.name.slice(0, 1).toUpperCase()}</span>
                  <span className="child-list-name">{child.name}</span>
                  <span className={existing ? 'child-list-added' : 'child-list-add'}>{existing ? <Check size={15} /> : <Plus size={16} />}</span>
                </button>
              })}
              {catalogDetail && visibleChildren.length === 0 && <div className="inspector-child-empty">{childFilter ? '没有匹配的子技能' : '暂无子技能，可在「创建新技能」中补充'}</div>}
            </div>
          </div>}
          <button className="remove-node" onClick={removeNode}><Trash2 size={16} /> 从图谱移除</button>
        </> : <>
          <div className="instruction"><span>01</span><div><strong>选择主技能</strong><p>搜索并添加一个技能分支。</p></div></div>
          <div className="instruction"><span>02</span><div><strong>展开子技能</strong><p>点选图中的技能，从右侧挑选具体技能，自动生成曲线连接。</p></div></div>
          <div className="instruction"><span>03</span><div><strong>记录学习进度</strong><p>每个技能都能独立设置状态和熟练度。</p></div></div>
          <div className="editor-hint"><CircleHelp size={17} /> 点击节点上的箭头收起或展开下级；也可拖动节点和手工连线。</div>
        </>}
      </aside>
    </div>
    {addOpen && <div className="modal-backdrop" onMouseDown={() => setAddOpen(false)}><div className="form-modal add-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => setAddOpen(false)}><X size={20} /></button>
      <span className="section-kicker">START A BRANCH</span><h2>先选择主技能</h2>
      <p className="modal-subtitle">添加后点选图中的节点，即可展开子技能列表并逐个加入。</p>
      <div className="search-box"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Java、MySQL、设计…" /></div>
      <div className="add-results">{results.map((skill, index) => <button key={skill.id} onClick={() => addSkill(skill)} disabled={busy}>
        <span className={`skill-icon tint-${index % 5}`}>{skill.name.slice(0, 1)}</span>
        <span><strong>{skill.name}</strong><small>{skill.groupName} · {skill.subskillCount} 个子技能</small></span>
        {existingIds.has(skill.id) ? <Check size={18} /> : <ChevronRight size={18} />}
      </button>)}{results.length === 0 && <p className="muted">没有匹配的主技能，试试其他关键词。</p>}</div>
      <div className="add-modal-tip"><Sparkles size={16} /> 搜索子技能名称也会找到它所属的主技能。</div>
    </div></div>}
  </div>
}
