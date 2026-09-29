import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowRight, BookOpen, Check, ChevronRight, Compass, GitBranch, GraduationCap, LayoutDashboard, LockKeyhole, LogOut, Menu, Plus, Search, Send, Settings2, Sparkles, UserRound, X } from 'lucide-react'
import { api, authenticate, errorMessage } from './api'
import TreeEditor from './TreeEditor'
import MySkills from './MySkills'
import TreeGallery from './TreeGallery'
import type { Category, MySkill, Page, Skill, SkillDetail, Submission, TreeSummary, User } from './types'

const categoryGlyph = (icon: string) => ({ code: '⌘', palette: '◈', languages: '文', sparkles: '✦', briefcase: '▣', heart: '♡', activity: '◉', users: '♧' }[icon] || '◈')

function App() {
  const [page, setPage] = useState<Page>('home')
  const [user, setUser] = useState<User | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [categories, setCategories] = useState<Category[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [mine, setMine] = useState<MySkill[]>([])
  const [trees, setTrees] = useState<TreeSummary[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [pending, setPending] = useState<Submission[]>([])
  const [selectedTreeId, setSelectedTreeId] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const [mobileNav, setMobileNav] = useState(false)

  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 4000) }, [])
  const loadPublic = useCallback(async () => {
    const [cat, skill] = await Promise.all([api.get<Category[]>('/categories'), api.get<Skill[]>('/skills', { params: { rootOnly: true } })])
    setCategories(cat.data); setSkills(skill.data)
  }, [])
  const loadPersonal = useCallback(async (who: User) => {
    const tasks = [api.get<MySkill[]>('/me/skills'), api.get<TreeSummary[]>('/trees'), api.get<Submission[]>('/me/submissions')]
    if (who.role === 'ADMIN') tasks.push(api.get<Submission[]>('/admin/submissions'))
    const results = await Promise.all(tasks)
    setMine(results[0].data as MySkill[]); setTrees(results[1].data as TreeSummary[]); setSubmissions(results[2].data as Submission[])
    if (who.role === 'ADMIN') setPending(results[3].data as Submission[])
  }, [])
  useEffect(() => {
    loadPublic().catch((error) => notify(errorMessage(error)))
    if (localStorage.getItem('skilltree_token')) {
      api.get<User>('/auth/me').then(({ data }) => { setUser(data); loadPersonal(data).catch((error) => notify(errorMessage(error))) })
        .catch(() => localStorage.removeItem('skilltree_token'))
    }
  }, [loadPublic, loadPersonal, notify])
  const navigate = (next: Page) => { setPage(next); setSelectedTreeId(null); setMobileNav(false) }
  const requireUser = () => { if (!user) { setAuthOpen(true); return false } return true }
  const afterAuth = (who: User) => { setUser(who); setAuthOpen(false); loadPersonal(who).catch((error) => notify(errorMessage(error))) }
  const logout = async () => {
    try { await api.post('/auth/logout') } catch { /* local session is still cleared */ }
    localStorage.removeItem('skilltree_token'); setUser(null); setMine([]); setTrees([]); setSubmissions([]); setSelectedTreeId(null); navigate('home'); notify('已退出登录')
  }
  const addToMine = async (skill: Skill) => {
    if (!requireUser()) return
    if (mine.some((item) => item.id === skill.id)) { notify(`「${skill.name}」已在我的技能中`); return }
    try { await api.put(`/me/skills/${skill.id}`, { level: 1, status: 'WANT_TO_LEARN', note: '' }); await loadPersonal(user!); notify(`已将「${skill.name}」加入我的技能`) }
    catch (error) { notify(errorMessage(error)) }
  }
  const nav = [
    { id: 'home', label: '概览', icon: LayoutDashboard },
    { id: 'hub', label: '探索技能', icon: Compass },
    { id: 'mine', label: '我的技能', icon: GraduationCap },
    { id: 'trees', label: '技能树', icon: GitBranch },
    { id: 'submissions', label: '技能投稿', icon: Send },
  ] as const
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <button className="brand" onClick={() => navigate('home')}><span className="brand-icon"><GitBranch size={22} strokeWidth={2.7} /></span><span>skilltree<span className="brand-dot">.</span></span></button>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="side-nav">
        {nav.map((item) => <button key={item.id} className={`side-link ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={19} strokeWidth={1.9} />{item.label}{page === item.id && <span className="active-indicator" />}</button>)}
        {user?.role === 'ADMIN' && <button className={`side-link ${page === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')}><Settings2 size={19} />审核管理</button>}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-help"><Sparkles size={20} /><strong>每一步，都算成长。</strong><span>把每一次学习，种成自己的技能树。</span></div>
      <div className="sidebar-bottom">{user ? <><div className="user-avatar">{user.username.slice(0, 1).toUpperCase()}</div><div className="user-meta"><strong>{user.username}</strong><small>{user.email}</small></div><button className="icon-button" onClick={logout} title="退出登录"><LogOut size={18} /></button></> : <button className="sidebar-login" onClick={() => setAuthOpen(true)}><UserRound size={18} /> 登录 / 注册 <ArrowRight size={16} /></button>}</div>
    </aside>

    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)}><Menu size={22} /></button><div className="breadcrumb"><span>SkillTree</span><ChevronRight size={15} /><strong>{selectedTreeId ? '技能树编辑器' : nav.find((item) => item.id === page)?.label || '审核管理'}</strong></div><div className="top-actions"><span className="top-date">持续成长，保持好奇 ✦</span>{user ? <button className="top-avatar" onClick={() => navigate('mine')}>{user.username.slice(0, 1).toUpperCase()}</button> : <button className="button button-dark small" onClick={() => setAuthOpen(true)}>开始使用 <ArrowRight size={15} /></button>}</div></header>
      <div className={`content ${selectedTreeId ? 'editor-content' : ''}`}>
        {page === 'home' && <Home categories={categories} skills={skills} mine={mine} trees={trees} user={user} onNavigate={navigate} onAdd={addToMine} onOpenAuth={() => setAuthOpen(true)} />}
        {page === 'hub' && <Hub categories={categories} mine={mine} onAdd={addToMine} onSubmit={() => navigate('submissions')} notify={notify} />}
        {page === 'mine' && <MySkills user={user} mine={mine} onLogin={() => setAuthOpen(true)} onExplore={() => navigate('hub')} onRefresh={() => user && loadPersonal(user)} notify={notify} />}
        {page === 'trees' && (selectedTreeId ? <TreeEditor treeId={selectedTreeId} ownerName={user?.username || '我'} onBack={() => { setSelectedTreeId(null); if (user) loadPersonal(user) }} notify={notify} /> : <TreeGallery user={user} trees={trees} onLogin={() => setAuthOpen(true)} onOpen={setSelectedTreeId} onRefresh={() => user && loadPersonal(user)} notify={notify} />)}
        {page === 'submissions' && <Submissions user={user} categories={categories} submissions={submissions} onLogin={() => setAuthOpen(true)} onRefresh={() => { if (user) loadPersonal(user); loadPublic() }} notify={notify} />}
        {page === 'admin' && user?.role === 'ADMIN' && <Admin pending={pending} onRefresh={() => loadPersonal(user)} notify={notify} />}
      </div>
      <footer className="site-footer"><span>开发者：<strong>宇崎崎</strong> · 联系方式：<a href="mailto:yuqigf@qq.com">yuqigf@qq.com</a></span><span>© 2026 宇崎崎 · MIT License</span></footer>
    </main>
    {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} onSuccess={afterAuth} notify={notify} />}
    {toast && <div className="toast"><Sparkles size={17} />{toast}<button onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>
}

function Home({ categories, skills, mine, trees, user, onNavigate, onAdd, onOpenAuth }: { categories: Category[]; skills: Skill[]; mine: MySkill[]; trees: TreeSummary[]; user: User | null; onNavigate: (page: Page) => void; onAdd: (skill: Skill) => void; onOpenAuth: () => void }) {
  return <div className="page home-page">
    <div className="home-intro"><div><div className="eyebrow"><span className="eyebrow-dot" /> GROW YOUR SKILL TREE</div><h1>把技能<br /><em>种成大树</em></h1><p>从一粒好奇开始，挑选想学的技能，<br />让每一次进步都长成自己的枝叶。</p><div className="hero-actions"><button className="button button-dark" onClick={() => user ? onNavigate('trees') : onOpenAuth()}>看看我的技能树 <ArrowRight size={18} /></button><button className="button button-light" onClick={() => onNavigate('hub')}>探索 Skill Hub <Compass size={18} /></button></div><div className="hero-footnote"><span className="tiny-orbit">✳</span> 差点忘了，原来我也能学skill？！</div></div><div className="hero-art"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" /><div className="hero-center"><GitBranch size={31} /><span>我的技能树</span></div><div className="floating-skill float-one">✦ <strong>创意设计</strong></div><div className="floating-skill float-two">☕ <strong>Java</strong><small>学习中</small></div><div className="floating-skill float-three">⚛ <strong>React</strong><small>已掌握</small></div><div className="floating-skill float-four">▣ <strong>数据分析</strong></div><span className="art-star star-one">✦</span><span className="art-star star-two">✳</span></div></div>
    <div className="section-head"><div><span className="section-kicker">YOUR SPACE</span><h2>你的成长空间 <span>↗</span></h2></div><span className="muted">每一步都值得被看见</span></div>
    <div className="overview-grid"><div className="overview-card green"><div className="card-icon"><GraduationCap size={23} /></div><div><strong>{mine.length.toString().padStart(2, '0')}</strong><span>已收集的技能</span></div><button onClick={() => onNavigate('mine')}>查看我的技能 <ArrowRight size={17} /></button></div><div className="overview-card peach"><div className="card-icon"><GitBranch size={23} /></div><div><strong>{trees.length.toString().padStart(2, '0')}</strong><span>我的技能树</span></div><button onClick={() => onNavigate('trees')}>看看技能树 <ArrowRight size={17} /></button></div><div className="overview-card violet"><div className="card-icon"><Activity size={23} /></div><div><strong>{mine.filter((item) => item.status === 'LEARNING').length.toString().padStart(2, '0')}</strong><span>正在学习中</span></div><button onClick={() => onNavigate('mine')}>继续成长 <ArrowRight size={17} /></button></div></div>
    <div className="section-head discovery-head"><div><span className="section-kicker">EXPLORE MORE</span><h2>从好奇开始探索</h2></div><button className="text-link" onClick={() => onNavigate('hub')}>查看全部分类 <ArrowRight size={17} /></button></div>
    <div className="category-grid">{categories.map((category, index) => <button className={`category-card category-${index % 8}`} key={category.id} onClick={() => onNavigate('hub')}><span className="category-glyph">{categoryGlyph(category.icon)}</span><strong>{category.name}</strong><small>{category.groups.length} 个技能组</small><ArrowRight className="category-arrow" size={18} /></button>)}</div>
    <div className="section-head trending-head"><div><span className="section-kicker">PICKS FOR YOU</span><h2>发现热门技能 <span>✳</span></h2></div><button className="text-link" onClick={() => onNavigate('hub')}>去 Skill Hub <ArrowRight size={17} /></button></div>
    <div className="trending-grid">{skills.slice(0, 6).map((skill, index) => <div className="trending-card" key={skill.id}><div className={`skill-icon tint-${index % 5}`}>{skill.name.slice(0, 1).toUpperCase()}</div><div><strong>{skill.name}</strong><span>{skill.categoryName} · {skill.groupName}</span></div><button onClick={() => onAdd(skill)} title="加入我的技能"><Plus size={19} /></button></div>)}</div>
  </div>
}

function Hub({ categories, mine, onAdd, onSubmit, notify }: { categories: Category[]; mine: MySkill[]; onAdd: (skill: Skill) => void; onSubmit: () => void; notify: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [results, setResults] = useState<Skill[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selected, setSelected] = useState<SkillDetail | null>(null)
  useEffect(() => { setPage(0); setResults([]); setHasMore(false) }, [query, categoryId, groupId])
  useEffect(() => { let active = true; const timer = window.setTimeout(() => { api.get<Skill[]>('/skills', { params: { q: query || undefined, categoryId, groupId, rootOnly: true, page } }).then(({ data }) => { if (!active) return; setResults((items) => page === 0 ? data : [...items, ...data]); setHasMore(data.length === 60) }).catch((error) => { if (active) notify(errorMessage(error)) }) }, 220); return () => { active = false; window.clearTimeout(timer) } }, [query, categoryId, groupId, page, notify])
  const select = async (skillId: number) => { try { const { data } = await api.get<SkillDetail>(`/skills/${skillId}`); setSelected(data) } catch (error) { notify(errorMessage(error)) } }
  const activeCategory = categories.find((item) => item.id === categoryId)
  const mineIds = new Set(mine.map((item) => item.id))
  return <div className="page"><div className="page-heading"><div><span className="section-kicker">SKILL HUB</span><h1>探索技能<span className="heading-accent">.</span></h1><p>从公共技能库出发，找到下一个想要掌握的能力。</p></div><button className="button button-light" onClick={onSubmit}><Plus size={17} /> 创建新技能</button></div>
    <div className="hub-layout"><div className="hub-main"><div className="search-box"><Search size={21} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索技能或子技能，例如 Java / JUC..." /><span>⌘ K</span></div><div className="filter-header"><strong>按分类探索</strong><span>{results.length} 项上层技能</span></div><div className="filter-row"><button className={`filter-pill ${categoryId === null ? 'active' : ''}`} onClick={() => { setCategoryId(null); setGroupId(null) }}>全部技能</button>{categories.map((item) => <button className={`filter-pill ${categoryId === item.id ? 'active' : ''}`} key={item.id} onClick={() => { setCategoryId(item.id); setGroupId(null) }}>{categoryGlyph(item.icon)} {item.name}</button>)}</div>{activeCategory && <div className="group-row"><button className={groupId === null ? 'active' : ''} onClick={() => setGroupId(null)}>全部</button>{activeCategory.groups.map((group) => <button className={groupId === group.id ? 'active' : ''} key={group.id} onClick={() => setGroupId(group.id)}>{group.name}</button>)}</div>}
      <div className="hub-result-heading"><span>{query ? `「${query}」所在的技能分支` : activeCategory ? `${activeCategory.name}技能` : '为你推荐'}</span><small>打开上层技能，逐级查看子技能</small></div>
      <div className="skill-grid">{results.map((skill, index) => <button className="skill-card" key={skill.id} onClick={() => select(skill.id)}><span className={`skill-icon tint-${index % 5}`}>{skill.name.slice(0, 1).toUpperCase()}</span><span className="skill-card-body"><strong>{skill.name}</strong><small>{skill.groupName}{skill.subskillCount > 0 ? ` · ${skill.subskillCount} 个子技能` : ''}</small><span>{skill.description || '等待补充技能介绍'}</span></span><span className="skill-card-end"><ChevronRight size={19} /></span></button>)}</div>{hasMore && <button className="button button-light" onClick={() => setPage((current) => current + 1)}>加载更多技能</button>}{results.length === 0 && <div className="empty-state"><Search size={30} /><strong>还没有找到相关技能</strong><p>换个关键词试试，或者创建一个新技能。</p><button className="button button-dark" onClick={onSubmit}>创建技能</button></div>}
    </div><aside className="hub-aside"><div className="aside-heading"><Sparkles size={19} /><strong>关于 Skill Hub</strong></div><p>这里的每一项技能都可以成为你个人图谱的一部分。选择感兴趣的技能，记录你的成长状态。</p><div className="aside-divider" /><div className="aside-stat"><strong>{categories.length}</strong><span>技能分类</span></div><div className="aside-stat"><strong>{results.length}</strong><span>当前展示</span></div><div className="aside-note">✦ 你的成长没有标准路线，只有属于自己的连接方式。</div></aside></div>
    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}>
      <div className="detail-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={() => setSelected(null)}><X size={20} /></button>
        <div className="detail-mark">{selected.name.slice(0, 1).toUpperCase()}</div>
        <span className="section-kicker">SKILL DETAILS</span><h2>{selected.name}</h2>
        <div className="detail-path">{selected.categoryName} <ChevronRight size={14} /> {selected.groupName}</div>
        <p>{selected.description || '这个技能还没有简介。'}</p>
        {selected.aliases.length > 0 && <div className="detail-alias"><strong>常用别名</strong><div>{selected.aliases.map((alias) => <span key={alias}>{alias}</span>)}</div></div>}
        {selected.parents.length > 0 && <div className="hub-parent-hint">加入子技能时会一同加入上级技能。</div>}{selected.parents.length > 0 && <div className="skill-relations"><strong>上级技能</strong><div>{selected.parents.map((parent) => <button key={parent.id} onClick={() => select(parent.id)}>{parent.name}<ChevronRight size={14} /></button>)}</div></div>}
        {selected.subskills.length > 0 && <div className="skill-relations"><strong>细分技能 · {selected.subskills.length}</strong><div>{selected.subskills.map((child) => <button key={child.id} onClick={() => select(child.id)}>{child.name}<ChevronRight size={14} /></button>)}</div></div>}
        <div className="detail-footer"><span><UserRound size={16} /> {selected.usageCount || 0} 人已添加</span><button className="button button-dark" onClick={() => { onAdd(selected); setSelected(null) }}>{mineIds.has(selected.id) ? <><Check size={17} /> 已在我的技能</> : <><Plus size={17} /> 加入我的技能</>}</button></div>
      </div>
    </div>}
  </div>
}

function Submissions({ user, categories, submissions, onLogin, onRefresh, notify }: { user: User | null; categories: Category[]; submissions: Submission[]; onLogin: () => void; onRefresh: () => void; notify: (message: string) => void }) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [aliases, setAliases] = useState('')
  const [visibility, setVisibility] = useState<'PRIVATE' | 'COMMUNITY'>('PRIVATE')
  const [suggestions, setSuggestions] = useState<Skill[]>([])
  const [parentQuery, setParentQuery] = useState('')
  const [parentSkill, setParentSkill] = useState<Skill | null>(null)
  const [parentSuggestions, setParentSuggestions] = useState<Skill[]>([])
  const [busy, setBusy] = useState(false)
  const groups = categories.find((category) => category.id === categoryId)?.groups || []
  useEffect(() => { if (name.trim().length < 2) { setSuggestions([]); return } const timer = window.setTimeout(() => api.get<Skill[]>('/skills', { params: { q: name.trim() } }).then(({ data }) => setSuggestions(data.slice(0, 4))).catch(() => setSuggestions([])), 240); return () => window.clearTimeout(timer) }, [name])
  useEffect(() => { if (parentSkill || parentQuery.trim().length < 2) { setParentSuggestions([]); return } const timer = window.setTimeout(() => api.get<Skill[]>('/skills', { params: { q: parentQuery.trim() } }).then(({ data }) => setParentSuggestions(data.slice(0, 6))).catch(() => setParentSuggestions([])), 240); return () => window.clearTimeout(timer) }, [parentQuery, parentSkill])
  const chooseParent = (skill: Skill) => { setParentSkill(skill); setParentQuery(skill.name); setParentSuggestions([]); setCategoryId(skill.categoryId); setGroupId(skill.groupId) }
  const submit = async () => { if (!user) return onLogin(); if (!name.trim() || !groupId) return notify('请填写技能名称并选择技能组'); setBusy(true); try { const { data } = await api.post<Skill>('/skills/submissions', { name, groupId, description, aliases: aliases.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean), visibility, parentSkillId: parentSkill?.id || null }); setName(''); setDescription(''); setAliases(''); setCategoryId(null); setGroupId(null); setParentQuery(''); setParentSkill(null); onRefresh(); notify(data.status === 'APPROVED' ? '技能已创建并通过自动审核，已发布到 Skill Hub' : data.status === 'PENDING' ? '技能已加入「我的技能」，公开发布等待人工审核' : '技能已加入「我的技能」，立即可用') } catch (error) { notify(errorMessage(error)) } finally { setBusy(false) } }
  return <div className="page"><div className="page-heading"><div><span className="section-kicker">CONTRIBUTE & CREATE</span><h1>创建新技能<span className="heading-accent">.</span></h1><p>创建后立即加入「我的技能」，你可以直接使用。</p></div></div>{!user ? <AuthEmpty onLogin={onLogin} /> : <div className="submission-layout"><div className="submission-form"><div className="form-intro"><div className="form-intro-icon"><Plus size={23} /></div><div><h2>描述你的技能</h2><p>先搜索是否已有相同技能，再填写基本信息。</p></div></div><label className="field-label" htmlFor="skill-name">技能名称 <b>*</b></label><input id="skill-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="例如：交互设计" />{suggestions.length > 0 && <div className="suggestion-box"><strong><Search size={15} /> Skill Hub 中可能已有</strong>{suggestions.map((skill) => <div key={skill.id}>{skill.name}<span>{skill.groupName}</span></div>)}</div>}<div className="form-row"><div><label className="field-label" htmlFor="category">技能分类 <b>*</b></label><select id="category" value={categoryId || ''} onChange={(event) => { setCategoryId(Number(event.target.value) || null); setGroupId(null) }}><option value="">选择分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div><label className="field-label" htmlFor="group">技能组 <b>*</b></label><select id="group" value={groupId || ''} onChange={(event) => setGroupId(Number(event.target.value) || null)} disabled={!categoryId}><option value="">选择技能组</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div></div>
        <label className="field-label" htmlFor="parent-skill">上级技能 <span>选填，创建子技能时选择</span></label>
        <input id="parent-skill" value={parentQuery} onChange={(event) => { setParentQuery(event.target.value); setParentSkill(null) }} placeholder="搜索上级技能，例如 MySQL、Java" />
        {parentSkill && <div className="parent-selected"><span>已关联：{parentSkill.name}</span><button onClick={() => { setParentSkill(null); setParentQuery('') }}>取消关联</button></div>}
        {!parentSkill && parentSuggestions.length > 0 && <div className="parent-suggestions">{parentSuggestions.map((skill) => <button key={skill.id} onClick={() => chooseParent(skill)}>{skill.name}<small>{skill.groupName}</small></button>)}</div>}
        <label className="field-label" htmlFor="skill-description">技能说明</label><textarea id="skill-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} rows={4} placeholder="这项技能是什么？可以用它做什么？" /><label className="field-label" htmlFor="skill-aliases">别名 <span>选填，用逗号分隔</span></label><input id="skill-aliases" value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="例如：JS, ECMAScript" /><label className="field-label">发布方式</label><div className="visibility-row"><button className={visibility === 'PRIVATE' ? 'active' : ''} onClick={() => setVisibility('PRIVATE')}><LockKeyhole size={21} /><strong>仅自己可见</strong><small>创建后立即可用，仅自己可见</small></button><button className={visibility === 'COMMUNITY' ? 'active' : ''} onClick={() => setVisibility('COMMUNITY')}><Send size={21} /><strong>提交 Skill Hub</strong><small>创建后立即可用，公开发布会自动审核</small></button></div><button className="button button-dark submit-button" onClick={submit} disabled={busy}>{busy ? '正在提交...' : visibility === 'PRIVATE' ? '创建并使用' : '创建并申请发布'} <ArrowRight size={17} /></button></div><aside className="submission-aside"><div className="aside-heading"><BookOpen size={20} /><strong>我的创建记录</strong></div>{submissions.length ? submissions.map((item) => <div className="submission-item" key={item.id}><div><strong>{item.name}</strong><small>{item.groupName}</small>{item.reviewReason && <small>{item.reviewReason}</small>}</div><span className={`review-chip review-${item.status.toLowerCase()}`}>{({ PRIVATE: '私有', PENDING: '待审核', APPROVED: '已公开', REJECTED: '未通过' } as Record<string, string>)[item.status] || item.status}</span></div>) : <p className="muted">你还没有创建过技能。</p>}<div className="aside-note">✦ 写清技能用途有助于自动审核通过。</div></aside></div>}</div>
}

function Admin({ pending, onRefresh, notify }: { pending: Submission[]; onRefresh: () => void; notify: (message: string) => void }) {
  const review = async (id: number, decision: 'approve' | 'reject') => { try { await api.post(`/admin/submissions/${id}/${decision}`); onRefresh(); notify(decision === 'approve' ? '已通过审核' : '已拒绝投稿') } catch (error) { notify(errorMessage(error)) } }
  return <div className="page"><div className="page-heading"><div><span className="section-kicker">MODERATION</span><h1>投稿审核<span className="heading-accent">.</span></h1><p>核对技能名称与分类，让公共技能库保持清晰。</p></div></div>{pending.length ? <div className="admin-list">{pending.map((item) => <div className="admin-card" key={item.id}><div><span className="section-kicker">#{item.id} · {item.groupName}</span><h3>{item.name}</h3><p>{item.description || '暂无说明'}</p><small>提交者：{item.creatorName}</small>{item.reviewReason && <small>审核提示：{item.reviewReason}</small>}</div><div><button className="button button-light" onClick={() => review(item.id, 'reject')}>拒绝</button><button className="button button-dark" onClick={() => review(item.id, 'approve')}><Check size={17} /> 通过</button></div></div>)}</div> : <div className="empty-state"><Check size={32} /><strong>当前没有待审核技能</strong><p>新的社区投稿会出现在这里。</p></div>}</div>
}

function AuthEmpty({ onLogin }: { onLogin: () => void }) { return <div className="empty-state auth-empty"><div className="empty-illustration"><LockKeyhole size={31} /></div><strong>登录后，开启你的个人空间</strong><p>收藏技能、建立图谱，进度会被认真保存。</p><button className="button button-dark" onClick={onLogin}>登录 / 注册 <ArrowRight size={17} /></button></div> }

function AuthModal({ mode, setMode, onClose, onSuccess, notify }: { mode: 'login' | 'register'; setMode: (mode: 'login' | 'register') => void; onClose: () => void; onSuccess: (user: User) => void; notify: (message: string) => void }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => { setBusy(true); try { const user = await authenticate(mode, mode === 'login' ? { email, password } : { username, email, password }); onSuccess(user); notify(`欢迎${mode === 'register' ? '加入' : '回来'}，${user.username}`) } catch (error) { notify(errorMessage(error)) } finally { setBusy(false) } }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="auth-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={20} /></button><div className="auth-brand"><GitBranch size={23} /> skilltree<span>.</span></div><span className="section-kicker">START YOUR JOURNEY</span><h2>{mode === 'login' ? '欢迎回来' : '从这里开始成长'}</h2><p className="modal-subtitle">{mode === 'login' ? '登录后继续绘制你的成长轨迹。' : '创建账号，收藏属于你的第一项技能。'}</p>{mode === 'register' && <><label className="field-label" htmlFor="auth-username">用户名</label><input id="auth-username" autoFocus value={username} onChange={(event) => setUsername(event.target.value)} minLength={2} maxLength={40} placeholder="给自己起个名字" /></>}<label className="field-label" htmlFor="auth-email">{mode === 'login' ? '邮箱或用户名' : '邮箱'}</label><input id="auth-email" type={mode === 'login' ? 'text' : 'email'} autoComplete="username" autoFocus={mode === 'login'} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={mode === 'login' ? '邮箱或用户名' : 'you@example.com'} /><label className="field-label" htmlFor="auth-password">密码</label><input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} placeholder="至少 8 位字符" /><button className="button button-dark full auth-submit" disabled={busy} onClick={submit}>{busy ? '请稍候...' : mode === 'login' ? '登录' : '创建账号'} <ArrowRight size={18} /></button><div className="auth-switch">{mode === 'login' ? '还没有账号？' : '已经有账号？'} <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '立即注册' : '去登录'}</button></div></div></div>
}

export default App
