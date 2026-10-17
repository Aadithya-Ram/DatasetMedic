import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Activity, ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Columns3, Download, ExternalLink, FileCheck2, FileSpreadsheet, FlaskConical, FolderOpen, Github, Layers3, Leaf, LoaderCircle, LockKeyhole, Plus, ScanLine, Search, Settings2, ShieldCheck, Sparkles, Trash2, TriangleAlert, Upload, WandSparkles, X } from 'lucide-react';
import type { components } from './schema';

type Config = components['schemas']['AuditConfig'];
type Step = components['schemas']['Step'];
type Kind = 'audit' | 'preview' | 'export';
type Dataset = { id: string; name: string; size: number };
type Row = Record<string, unknown>;
type Column = { name: string; dtype: string; missing: number; unique: number; examples: unknown[]; stats?: Record<string, number | null>; top?: {value: unknown; count: number}[] };
type Profile = { rows: number; columns: Column[]; sample: Row[] };
type Finding = { id: string; kind: string; title: string; detail: string; datasets: string[]; count: number; examples: Row[]; severity: string; columns: string[] };
type Change = {step: number; dataset: string; op: string; affected_rows: number; conversion_failures: Record<string, number>; before_rows: number; after_rows: number};
type Result = {profiles: Record<string, Profile>; finding_count?: number; changes?: Change[]; fitted_values?: Record<string, Row>; comparisons?: { datasets: string[]; columns: {name: string; left: Column; right: Column}[] }[]; notice?: string};
const EMPTY_CONFIG: Config = {roles: {}, target: null, groups: [], features: []};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'X-DatasetMedic': '1', ...(init?.body instanceof FormData ? {} : {'Content-Type': 'application/json'}), ...init?.headers } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === 'string' ? data.detail : 'The request could not be completed. Check your input and try again.');
  }
  return response.json();
}
function show(value: unknown) { return value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value); }
function pretty(value: number) { return new Intl.NumberFormat('en').format(value); }
function Reveal({children, className = '', delay = 0}: {children: ReactNode; className?: string; delay?: number}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    // Reveal on entry even when a wide dataset creates a panel taller than the viewport.
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.unobserve(el); } }, {threshold: 0, rootMargin:'0px 0px -24px 0px'});
    el.classList.add('will-reveal');
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{'--delay': `${delay}ms`} as CSSProperties}>{children}</div>;
}
function DataTable({rows}: {rows: Row[]}) {
  if (!rows.length) return <p className="muted">No example rows for this finding.</p>;
  const columns = Object.keys(rows[0]);
  return <div className="table-wrap" tabIndex={0} aria-label="Scrollable data table"><table><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{columns.map(c => <td key={c} className={row[c] == null ? 'null-cell' : ''}>{show(row[c])}</td>)}</tr>)}</tbody></table></div>;
}
function Logo({small = false}: {small?: boolean}) {
  return <span className={`brand ${small ? 'small' : ''}`}><span className="brand-mark"><Plus strokeWidth={3} /></span><span>Dataset<span className="brand-light">Medic</span><span className="brand-dot">.</span></span></span>;
}
function Constellation() {
  return <div className="constellation" aria-hidden="true"><svg viewBox="0 0 440 310"><defs><pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" opacity=".16" /></pattern></defs><rect width="440" height="310" fill="url(#grid)" />
    <path className="orbit orbit-one" d="M25 179C72 40 329 26 405 155S202 328 89 251S54 65 247 68" />
    <path className="orbit orbit-two" d="M47 84C241 5 424 244 293 282S12 215 147 68" />
    <path className="connection" d="M80 172L146 99L235 153L328 89M235 153L300 237M146 99L171 241L300 237M328 89L366 193L235 153L80 172L171 241" />
    {[[80,172],[146,99],[235,153],[328,89],[300,237],[171,241],[366,193]].map(([cx,cy],i) => <g key={i} className={`node node-${i}`}><circle cx={cx} cy={cy} r={i===2?23:13} fill={i===2?'#c8f29a':'#f9fbf4'} stroke="#679381" strokeWidth="1"/><path d={`M${cx-4} ${cy}l3 3 6-7`} stroke="#285547" strokeWidth="1.5" fill="none"/></g>)}
    </svg><div className="floating-label label-one"><span className="status-dot"/> Your data. Your device.</div><div className="floating-label label-two"><CheckCheck size={14}/> A healthier starting point</div></div>;
}

export default function App() {
  const [sid, setSid] = useState('');
  const sidRef = useRef('');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG);
  const [auditResult, setAuditResult] = useState<Result | null>(null);
  const [auditId, setAuditId] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [openFinding, setOpenFinding] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeDataset, setActiveDataset] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [preview, setPreview] = useState<Result | null>(null);
  const [previewKey, setPreviewKey] = useState('');
  const [exportId, setExportId] = useState('');
  const [format, setFormat] = useState<'csv'|'parquet'>('parquet');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<{id: string; kind: Kind; percent: number; message: string} | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [separator, setSeparator] = useState(',');
  const [dropActive, setDropActive] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [scrolled, setScrolled] = useState(false);
  const [op, setOp] = useState<Step['op']>('deduplicate');
  const [stepColumns, setStepColumns] = useState<string[]>([]);
  const [castType, setCastType] = useState<NonNullable<Step['dtype']>>('decimal');
  const [fillMethod, setFillMethod] = useState<NonNullable<Step['method']>>('median');
  const [fillValue, setFillValue] = useState('');
  const [search, setSearch] = useState('');
  const [confirmExport, setConfirmExport] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const currentRecipeKey = JSON.stringify({steps, config, datasets:datasets.map(d=>d.id)});
  const previewCurrent = preview && previewKey === currentRecipeKey;
  const base = `/api/sessions/${sid}`;
  const profiles = auditResult?.profiles || {};
  const profile = profiles[activeDataset] || Object.values(profiles)[0];
  const columnNames = profile?.columns.map(c => c.name) || [];
  const names = Object.fromEntries(datasets.map(d => [d.id, d.name]));
  const numberRows = Object.values(profiles).reduce((n,p) => n+p.rows,0);
  const riskCount = findings.filter(f => f.severity === 'danger').length;

  useEffect(() => {
    let disposed = false;
    api<{id:string}>('/api/sessions', {method:'POST'}).then(s => {
      if (disposed) { void api(`/api/sessions/${s.id}`, {method:'DELETE'}); return; }
      setSid(s.id); sidRef.current = s.id;
    }).catch(e => setError(e.message));
    const heartbeat = window.setInterval(() => { if (sidRef.current) void api(`/api/sessions/${sidRef.current}/heartbeat`, {method:'POST'}).catch(() => {}); }, 60_000);
    const close = () => { if (sidRef.current) void fetch(`/api/sessions/${sidRef.current}`, {method:'DELETE', keepalive:true}); };
    window.addEventListener('pagehide', close);
    return () => { disposed = true; clearInterval(heartbeat); window.removeEventListener('pagehide',close); close(); };
  }, []);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 25);
    window.addEventListener('scroll',scroll,{passive:true});
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) setActiveSection(entry.target.id); }), {rootMargin:'-15% 0px -65% 0px'});
    document.querySelectorAll('main section[id]').forEach(el => observer.observe(el));
    return () => {window.removeEventListener('scroll',scroll); observer.disconnect();};
  }, []);
  useEffect(() => { setExportId(''); setConfirmExport(false); }, [currentRecipeKey, format]);
  function navigate(id: string) {document.getElementById(id)?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}); setActiveSection(id);}
  function changeConfig(next: Config) {setConfig(next); setNotice(auditResult ? 'Settings changed. Run the audit again to update findings.' : '');}
  async function loadFindings(id: string, start = 0) {
    const data = await api<{total:number;items:Finding[]}>(`${base}/jobs/${id}/findings?offset=${start}&limit=20`);
    setFindings(data.items);setTotal(data.total);setOffset(start);
  }
  async function run(kind: Kind, useConfig = config) {
    if (!sid || busy) return;
    setError(''); setNotice('');setBusy(true);cancelled.current=false;
    try {
      const created = await api<{id:string}>(`${base}/jobs`, {method:'POST',body:JSON.stringify({kind, config:useConfig, recipe:{steps}, output_format:format})});
      setJob({id:created.id,kind,percent:0,message:'Starting local worker'});
      for (;;) {
        await new Promise(r => setTimeout(r,350));
        if (cancelled.current) return;
        const status = await api<{status:string;percent:number;message:string;error?:string}>(`${base}/jobs/${created.id}`);
        if (status.status === 'failed') throw new Error(status.error || 'The analysis could not finish.');
        if (status.status === 'cancelled') {setNotice('Job cancelled. Your source files are unchanged.');return;}
        setJob({id:created.id,kind,percent:status.percent,message:status.message});
        if (status.status === 'complete') break;
      }
      if (cancelled.current) return;
      const result = await api<Result>(`${base}/jobs/${created.id}/result`);
      if (kind === 'audit') {setAuditResult(result);setAuditId(created.id);await loadFindings(created.id);setActiveDataset(datasets[0]?.id || Object.keys(result.profiles)[0]);navigate('findings');}
      else if (kind === 'preview') {setPreview(result);setPreviewKey(JSON.stringify({steps, config:useConfig, datasets:datasets.map(d=>d.id)}));setNotice('Preview ready. Review the changes below before exporting.');}
      else {setExportId(created.id);setNotice('Your export is ready. Download it below.');}
    } catch(e) {setError((e as Error).message);}
    finally {setBusy(false);setJob(null);}
  }
  async function cancelJob() {
    if (!job) return;
    try {await api(`${base}/jobs/${job.id}`,{method:'DELETE'});cancelled.current=true;setNotice('Job cancelled. Your source files are unchanged.');} catch(e) {setError((e as Error).message);}
  }
  async function upload(files: FileList | File[]) {
    if (busy || !sid) return;
    setBusy(true);setError('');
    try {
      let next = [...datasets];
      for (const file of Array.from(files)) {
        const body = new FormData();body.append('file',file);body.append('separator',separator);
        const data = await api<Dataset>(`${base}/imports`,{method:'POST',body});
        next = [...next,data];setDatasets(next);
        setAuditResult(null);setAuditId('');setFindings([]);setTotal(0);setPreview(null);setExportId('');
      }
      setAuditResult(null);setAuditId('');setFindings([]);setTotal(0);setPreview(null);setExportId('');
      setNotice('Files imported. Choose split roles below, then run your audit.');
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);if(fileInput.current) fileInput.current.value='';}
  }
  async function demo() {
    if (busy || !sid || datasets.length) {navigate('workspace');return;}
    setBusy(true);setError('');
    try {
      const data = await api<Dataset[]>(`${base}/demo`,{method:'POST'});
      setDatasets(data);setConfig({roles:{[data[0].id]:'train',[data[1].id]:'test'},target:'label',groups:['subject_id'],features:['age','city']});
      setActiveDataset(data[0].id);setNotice('Demo loaded with known data issues. Run the audit to explore.');navigate('workspace');
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function clear() {
    if (busy) return;
    setBusy(true);setError('');
    try {
      await api(base,{method:'DELETE'});
      const next = await api<{id:string}>('/api/sessions',{method:'POST'});
      setSid(next.id);sidRef.current=next.id;setDatasets([]);setConfig(EMPTY_CONFIG);setAuditResult(null);setAuditId('');setFindings([]);setTotal(0);setSteps([]);setPreview(null);setExportId('');setNotice('Session cleared. Temporary copies and results have been deleted.');
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  function addStep() {
    setError('');
    if (op !== 'deduplicate' && !stepColumns.length) {setError('Choose at least one column for this operation.');return;}
    // Preserve text such as "001"; the engine validates values against each selected column type.
    const value = fillValue;
    setSteps([...steps,{op, method:fillMethod, columns:op==='deduplicate'?[]:stepColumns, ...(op==='cast'?{dtype:castType}:{}), ...(op==='fill'?{value}: {})}]);
    setStepColumns([]);
  }
  const filteredFindings = findings.filter(f => (filter==='all'|| f.severity===filter) && `${f.title} ${f.detail}`.toLowerCase().includes(search.toLowerCase()));
  const failedConversions = preview?.changes?.reduce((sum,c) => sum + Object.values(c.conversion_failures).reduce((a,b)=>a+b,0),0) || 0;

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#overview" className="brand-link" aria-label="DatasetMedic home"><Logo/></a>
      <div className="workspace-label">YOUR WORKBENCH <span>LOCAL</span></div>
      <nav aria-label="Main navigation">{[{id:'overview',label:'Overview',Icon:Layers3},{id:'workspace',label:'Datasets',Icon:FolderOpen},{id:'findings',label:'Health report',Icon:Activity},{id:'cleaning',label:'Cleaning studio',Icon:WandSparkles},{id:'export',label:'Export & reproduce',Icon:ArrowDownToLine}].map(({id,label,Icon}) => <button key={id} onClick={()=>navigate(id)} className={activeSection===id?'nav-item active':'nav-item'}><Icon size={18}/><span>{label}</span>{id==='findings'&&total>0&&<span className="nav-count">{total}</span>}</button>)}</nav>
      <div className="sidebar-note"><div className="note-icon"><ShieldCheck size={19}/></div><strong>A private practice.</strong><p>Your datasets stay on your device. Always.</p><span><span className="status-dot"/> Local processing</span></div>
      <div className="sidebar-bottom"><a href="https://github.com/Aadithya-Ram/DatasetMedic" target="_blank" rel="noreferrer"><Github size={17}/> Built in the open <ArrowUpRight size={14}/></a><span>v0.1.0 <span className="tiny-separator">/</span> made for better data</span></div>
    </aside>
    <div className="main-shell">
      <header className={scrolled?'topbar scrolled':'topbar'}><div className="breadcrumb"><span>Workbench</span><ChevronRight size={13}/><strong>{activeSection==='overview'?'Overview':activeSection==='workspace'?'Datasets':activeSection==='findings'?'Health report':activeSection==='cleaning'?'Cleaning studio':'Export & reproduce'}</strong></div><div className="topbar-right"><span className="local-badge"><span className="status-dot"/> Running locally</span><a className="icon-button" aria-label="Documentation on GitHub" href="https://github.com/Aadithya-Ram/DatasetMedic#readme" target="_blank" rel="noreferrer"><CircleHelp size={18}/></a><span className="avatar">DM</span></div></header>
      <main>
        <section id="overview" className="overview-section">
          <Reveal><div className="eyebrow"><span className="eyebrow-line"/> GOOD MODELS START WITH GOOD DATA</div></Reveal>
          <div className="hero"><div className="hero-copy"><Reveal delay={60}><h1>A little clarity.<br/>Before you <em>train.</em></h1></Reveal><Reveal delay={140}><p className="hero-description">Meet your dataset’s second opinion. Spot the hidden issues,<br className="desktop-break"/> catch split leakage, and give your next model a healthier start.</p></Reveal><Reveal delay={220}><div className="hero-actions"><button className="button primary" onClick={()=>navigate('workspace')}><Plus size={17}/> Check a dataset <ArrowRight size={16}/></button><button className="text-button" onClick={demo} disabled={busy||!sid}>{datasets.length?'Open workbench':'Explore the demo'} <ArrowUpRight size={16}/></button></div><div className="hero-trust"><LockKeyhole size={13}/><span>No uploads to the cloud.</span><span className="trust-dot">·</span><span>No API keys. Just your data.</span></div></Reveal></div><Reveal className="hero-art" delay={180}><Constellation/></Reveal></div>
          <Reveal delay={260}><div className="stats-grid">{[{label:'DATASETS IN SESSION',value:datasets.length.toString().padStart(2,'0'),sub:datasets.length?'Ready for a closer look':'A fresh start',Icon:Layers3,color:'sage'},{label:'ROWS INSPECTED',value:pretty(numberRows),sub:numberRows?'Every record counts':'Your next discovery awaits',Icon:ScanLine,color:'blue'},{label:'FINDINGS TO EXPLORE',value:pretty(total),sub:total?'A little attention goes a long way':'Clarity is a check away',Icon:Activity,color:'peach'},{label:'PROCESSING LOCATION',value:'On your device',sub:'Private by design',Icon:ShieldCheck,color:'lime'}].map(({label,value,sub,Icon,color},i) => <div className={`stat-card stat-${i}`} key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon size={17}/></span></div><div className={`stat-value ${i===3?'stat-text':''}`}>{value}</div><div className="stat-sub">{i===3&&<span className="status-dot"/>}{sub}</div></div>)}</div></Reveal>
        </section>

        <section id="workspace" className="content-section">
          <Reveal><div className="section-heading"><div><div className="section-kicker">01 <span>/</span> THE STARTING POINT</div><h2>Let’s meet your data<span>.</span></h2><p>One dataset for a health check. Two or three to look between the splits.</p></div><span className="pill"><FileSpreadsheet size={13}/> CSV & Parquet</span></div></Reveal>
          <Reveal><div className={`import-panel ${dropActive?'drag-active':''}`} onDragOver={e=>{e.preventDefault();setDropActive(true);}} onDragLeave={()=>setDropActive(false)} onDrop={e=>{e.preventDefault();setDropActive(false);void upload(e.dataTransfer.files);}}>
            <div className="upload-orbit"><div className="upload-icon"><Upload size={25} strokeWidth={1.5}/></div><span className="orbit-dot"/></div><h3>Drop in a little possibility.</h3><p>Drag your datasets here, or choose files to get started.</p><input ref={fileInput} type="file" accept=".csv,.parquet" multiple onChange={e=>{if(e.target.files)void upload(e.target.files);}} className="visually-hidden" id="file-import" aria-label="Import CSV or Parquet datasets" disabled={busy||!sid||datasets.length>=3}/><button className="button primary" onClick={()=>fileInput.current?.click()} disabled={busy||!sid||datasets.length>=3}><FolderOpen size={16}/> Choose files</button><div className="import-hint">Up to 3 files <span>·</span> 250 MiB per file <span>·</span> Originals stay untouched</div>
            <div className="separator-control"><label htmlFor="separator">CSV delimiter</label><select id="separator" value={separator} onChange={e=>setSeparator(e.target.value)} disabled={busy}><option value=",">Comma (,)</option><option value=";">Semicolon (;)</option><option value={'\t'}>Tab</option><option value="|">Pipe (|)</option></select></div>
          </div></Reveal>
          {datasets.length===0&&<Reveal><div className="demo-strip"><div className="demo-badge"><FlaskConical size={21}/></div><div><strong>Just looking around?</strong><p>Try a tiny dataset with a few carefully planted problems.</p></div><button className="text-button" onClick={demo} disabled={busy||!sid}>Load sample datasets <ArrowRight size={16}/></button></div></Reveal>}
          {datasets.length>0&&<div className="dataset-list">{datasets.map(d=><div className="dataset-row" key={d.id}><span className="file-icon"><FileSpreadsheet size={21}/></span><div className="dataset-name"><strong>{d.name}</strong><span>{(d.size/1024).toFixed(1)} KiB <span>·</span> Local session copy</span></div><label className="role-label">Split role<select aria-label={`Split role for ${d.name}`} value={config.roles?.[d.id]||'dataset'} onChange={e=>changeConfig({...config,roles:{...config.roles,[d.id]:e.target.value as 'train'|'test'|'validation'|'dataset'}})} disabled={busy}><option value="dataset">Unassigned</option><option value="train">Training</option><option value="validation">Validation</option><option value="test">Test</option></select></label></div>)}<div className="dataset-actions"><button className="text-button muted" onClick={clear} disabled={busy}><Trash2 size={15}/> Clear session</button><button className="button primary" onClick={()=>run('audit')} disabled={busy}><ScanLine size={16}/> Run health check <ArrowRight size={16}/></button></div></div>}
          {profile&&<Reveal><details className="settings-panel" open><summary><Settings2 size={17}/> Make the check yours <ChevronDown size={15}/></summary><div className="settings-grid"><label>Target column<select value={config.target||''} onChange={e=>changeConfig({...config,target:e.target.value||null})} disabled={busy}><option value="">No target selected</option>{columnNames.map(c=><option key={c}>{c}</option>)}</select><small>Used for class balance. Excluded from default feature matching.</small></label><fieldset disabled={busy}><legend>Subject / group columns</legend><div className="chip-picker">{columnNames.map(c=><button className={config.groups?.includes(c)?'chip selected':'chip'} key={c} onClick={()=>changeConfig({...config,groups:config.groups?.includes(c)?config.groups.filter(x=>x!==c):[...(config.groups||[]),c]})}>{config.groups?.includes(c)&&<Check size={12}/>} {c}</button>)}</div><small>Find subjects shared between splits.</small></fieldset><fieldset disabled={busy}><legend>Feature columns for exact matching</legend><div className="chip-picker">{columnNames.map(c=><button className={config.features?.includes(c)?'chip selected':'chip'} key={c} onClick={()=>changeConfig({...config,features:config.features?.includes(c)?config.features.filter(x=>x!==c):[...(config.features||[]),c]})}>{config.features?.includes(c)&&<Check size={12}/>} {c}</button>)}</div><small>Leave empty to compare common columns, excluding target and groups.</small></fieldset></div><div className="settings-footer"><button className="button secondary" onClick={()=>run('audit')} disabled={busy}><ScanLine size={15}/> Update health check</button></div></details></Reveal>}
        </section>

        <section id="findings" className="content-section">
          <Reveal><div className="section-heading"><div><div className="section-kicker">02 <span>/</span> A CLOSER LOOK</div><h2>Small signals. Better decisions<span>.</span></h2><p>Understand what’s happening, with the actual records behind every finding.</p></div>{auditResult&&<span className="pill"><Activity size={13}/>{total} findings</span>}</div></Reveal>
          {!auditResult?<Reveal><div className="empty-report"><div className="empty-illustration"><div/><div/><div/><span><Activity size={23}/></span></div><h3>Every dataset has a story.</h3><p>Run your first health check to see missing values, repeated<br/>records, mixed types, and potential split contamination.</p><button className="text-button" onClick={()=>navigate('workspace')}>Start with a dataset <ArrowRight size={15}/></button></div></Reveal>:<>
            <div className="report-toolbar"><div className="segmented">{[['all','All findings'],['danger','Split risks'],['warning','Attention'],['info','Observations']].map(([value,label])=><button key={value} className={filter===value?'selected':''} onClick={()=>setFilter(value)}>{label}</button>)}</div><label className="search-box"><Search size={15}/><input placeholder="Search this page…" aria-label="Search findings on this page" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
            <div className="findings-list">{filteredFindings.map((f,i)=><Reveal key={`${auditId}-${f.id}`} delay={Math.min(i*35,150)}><article className={`finding-card ${f.severity}`}><button className="finding-toggle" aria-expanded={openFinding===f.id} onClick={()=>setOpenFinding(openFinding===f.id?'':f.id)}><span className="finding-icon">{f.severity==='danger'?<ShieldCheck size={19}/>:f.severity==='warning'?<TriangleAlert size={19}/>:<Activity size={19}/>}</span><span className="finding-title"><strong>{f.title}</strong><span>{f.datasets.map(k=>names[k]).join(' ↔ ')}</span></span><span className="count-badge">{pretty(f.count)}</span><ChevronDown size={17} className={openFinding===f.id?'rotated':''}/></button>{openFinding===f.id&&<div className="finding-detail"><p>{f.detail}</p>{f.columns.length>0&&<p className="muted">Columns: {f.columns.join(', ')}</p>}<DataTable rows={f.examples}/><small>Up to 12 examples shown. Source row numbers, when present, are 1-based data rows after the header.</small></div>}</article></Reveal>)}</div>
            {!filteredFindings.length&&<div className="no-findings"><CheckCheck size={24}/><p>{total?'No findings match this page’s filters.':'No findings from the selected checks.'}</p></div>}
            {total>20&&<div className="pagination"><span>{offset+1}–{Math.min(offset+20,total)} of {total} findings · Filters apply to this page</span><button className="icon-button" disabled={offset===0} onClick={()=>void loadFindings(auditId,Math.max(0,offset-20)).catch(e=>setError(e.message))} aria-label="Previous findings page"><ChevronLeft size={17}/></button><button className="icon-button" disabled={offset+20>=total} onClick={()=>void loadFindings(auditId,offset+20).catch(e=>setError(e.message))} aria-label="Next findings page"><ChevronRight size={17}/></button></div>}
            <div className="info-note"><CircleHelp size={16}/><p>{auditResult.notice} {riskCount>0&&'Review split findings before training.'}</p></div>
            <Reveal><div className="profile-panel"><div className="panel-title"><span><Columns3 size={18}/> The shape of your data</span><select aria-label="Dataset to inspect" value={activeDataset} onChange={e=>setActiveDataset(e.target.value)}>{datasets.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div><div className="column-grid">{profile?.columns.map(col=><div className="column-card" key={col.name}><div><strong>{col.name}</strong><span>{col.dtype}</span></div><div className="missing-meter"><span style={{width:`${Math.max(col.missing/profile.rows*100,0)}%`}}/></div><p><span>{pretty(col.missing)} missing</span><span>{pretty(col.unique)} distinct</span></p>{col.stats?<div className="column-stat"><span>MEAN</span><strong>{col.stats.mean==null?'—':Number(col.stats.mean.toFixed(2))}</strong><span>MEDIAN</span><strong>{show(col.stats.median)}</strong></div>:<div className="mini-bars">{col.top?.slice(0,3).map((v,i)=><div key={i}><span title={show(v.value)}>{show(v.value)}</span><div><i style={{width:`${v.count/profile.rows*100}%`}}/></div><small>{v.count}</small></div>)}</div>}</div>)}</div><details className="sample-details"><summary>Preview source records <ChevronDown size={15}/></summary><DataTable rows={profile?.sample||[]}/></details></div></Reveal>
            {!!auditResult.comparisons?.length&&<Reveal><div className="profile-panel"><div className="panel-title"><span><Layers3 size={18}/> Between the splits</span><span className="muted">Descriptive comparisons</span></div>{auditResult.comparisons.map((pair,i)=><div className="comparison" key={i}><h4>{pair.datasets.map(k=>names[k]).join(' ↔ ')}</h4><div className="table-wrap"><table><thead><tr><th>Column</th><th>Left missing</th><th>Right missing</th><th>Left mean / top value</th><th>Right mean / top value</th></tr></thead><tbody>{pair.columns.map(c=><tr key={c.name}><td>{c.name}</td><td>{c.left.missing}</td><td>{c.right.missing}</td><td>{show(c.left.stats?.mean ?? c.left.top?.[0]?.value)}</td><td>{show(c.right.stats?.mean ?? c.right.top?.[0]?.value)}</td></tr>)}</tbody></table></div></div>)}<p className="muted comparison-disclaimer">These summaries describe differences; they are not statistical drift tests.</p></div></Reveal>}
          </>}
        </section>

        <section id="cleaning" className="content-section">
          <Reveal><div className="section-heading"><div><div className="section-kicker">03 <span>/</span> A DELIBERATE NEXT STEP</div><h2>A fresh start. On your terms<span>.</span></h2><p>Build a recipe, preview the effect, and keep every decision reproducible.</p></div><span className="pill"><Leaf size={13}/> Preview first</span></div></Reveal>
          <Reveal><div className="cleaning-layout"><div className="recipe-builder"><div className="panel-title"><span><WandSparkles size={18}/> Your cleaning recipe</span><span className="pill">{steps.length} steps</span></div><div className="builder-body"><label>What would you like to do?<select value={op} disabled={busy} onChange={e=>{setOp(e.target.value as Step['op']);setStepColumns([]);}}><option value="deduplicate">Remove repeated rows within each split</option><option value="drop">Drop selected columns</option><option value="trim">Trim text whitespace</option><option value="cast">Convert column types</option><option value="fill">Fill missing values</option></select></label>{op!=='deduplicate'&&<fieldset disabled={busy||!profile}><legend>Choose columns</legend><div className="chip-picker">{columnNames.map(c=><button key={c} className={stepColumns.includes(c)?'chip selected':'chip'} onClick={()=>setStepColumns(stepColumns.includes(c)?stepColumns.filter(x=>x!==c):[...stepColumns,c])}>{stepColumns.includes(c)&&<Check size={12}/>} {c}</button>)}</div></fieldset>}{op==='cast'&&<label>Convert to<select value={castType} onChange={e=>setCastType(e.target.value as typeof castType)}><option value="decimal">Decimal number</option><option value="integer">Integer</option><option value="text">Text</option><option value="boolean">Boolean (true / false / 1 / 0)</option><option value="date">Date (YYYY-MM-DD)</option></select></label>}{op==='fill'&&<><label>Fill strategy<select value={fillMethod} onChange={e=>setFillMethod(e.target.value as typeof fillMethod)}><option value="median">Training median (numeric columns)</option><option value="mode">Training mode (most frequent)</option><option value="constant">Constant value</option></select></label>{fillMethod==='constant'&&<label>Fill value<input value={fillValue} onChange={e=>setFillValue(e.target.value)} placeholder="e.g. 0 or Unknown"/></label>}</>}
            <button className="button secondary full-width" onClick={addStep} disabled={busy||!profile||steps.length>=50}><Plus size={16}/> Add recipe step</button><div className="recipe-steps">{steps.length===0?<div className="recipe-empty"><Layers3 size={25}/><p>Your next steps go here.<br/><span>Nothing changes until you export.</span></p></div>:steps.map((step,i)=><div className="recipe-step" key={i}><span className="step-number">{i+1}</span><div><strong>{{deduplicate:'Remove repeated rows',drop:'Drop columns',trim:'Trim text',cast:'Convert types',fill:'Fill missing values'}[step.op]}</strong><span>{step.columns?.join(', ')||'Within each dataset'}{step.dtype?` → ${step.dtype}`:''}{step.op==='fill'?` · ${step.method}`:''}</span></div><button className="icon-button" aria-label={`Remove recipe step ${i+1}`} disabled={busy} onClick={()=>setSteps(steps.filter((_,j)=>j!==i))}><X size={14}/></button></div>)}</div><button className="button primary full-width" disabled={busy||!datasets.length||!auditResult} onClick={()=>run('preview')}><ScanLine size={16}/> Preview changes <ArrowRight size={16}/></button></div></div><div className="cleaning-aside"><div className="mint-card"><span className="round-icon"><ShieldCheck size={25} strokeWidth={1.4}/></span><h3>Careful by<br/><em>design.</em></h3><p>Your original files stay untouched. Every operation is explicit, previewed, and recorded.</p><ul><li><Check size={14}/> No automatic split deletion</li><li><Check size={14}/> Training-only learned values</li><li><Check size={14}/> The same engine, every time</li></ul><div className="mint-card-art" aria-hidden="true"><div/><div/><div/></div></div><div className="info-note"><CircleHelp size={16}/><p>With multiple datasets, learned filling requires exactly one training split. Without split roles, a single dataset fits its own values.</p></div></div></div></Reveal>
          {preview&&<div className="preview-panel"><div className="panel-title"><span><FileCheck2 size={18}/> Cleaning preview</span><span className={`pill ${previewCurrent?'':'stale'}`}>{previewCurrent?'Up to date':'Recipe or settings changed — preview again'}</span></div><div className="table-wrap"><table><thead><tr><th>Step</th><th>Dataset</th><th>Operation</th><th>Affected rows</th><th>Rows after</th><th>Failed conversions</th></tr></thead><tbody>{preview.changes?.map((c,i)=><tr key={i}><td>{c.step}</td><td>{names[c.dataset]}</td><td>{c.op}</td><td>{pretty(c.affected_rows)}</td><td>{pretty(c.after_rows)}</td><td className={Object.values(c.conversion_failures).some(n=>n>0)?'failure-cell':''}>{Object.entries(c.conversion_failures).map(([col,n])=>`${col}: ${n}`).join(', ')||'—'}</td></tr>)}</tbody></table></div>{!preview.changes?.length&&<p className="preview-note">No cleaning operations selected. Export will preserve the imported data values.</p>}<details className="sample-details"><summary>See the resulting records and fitted values <ChevronDown size={15}/></summary>{Object.entries(preview.profiles).map(([id,p])=><div className="preview-records" key={id}><h4>{names[id]} · {pretty(p.rows)} rows</h4><DataTable rows={p.sample}/></div>)}<pre>{JSON.stringify(preview.fitted_values,null,2)}</pre></details></div>}
        </section>

        <section id="export" className="content-section">
          <Reveal><div className="export-panel"><div className="export-copy"><div className="section-kicker">04 <span>/</span> TAKE THE CLARITY WITH YOU</div><h2>Good data.<br/><em>A clear paper trail.</em></h2><p>Your cleaned datasets, a readable report, and the exact recipe to do it all again. In one neat little bundle.</p><div className="export-tags"><span><FileSpreadsheet size={14}/> Cleaned data</span><span><FileCheck2 size={14}/> HTML report</span><span><CheckCheck size={14}/> Python script</span></div></div><div className="export-controls"><div className="export-file-icon"><Download size={30} strokeWidth={1.3}/><span>.zip</span></div><label>Dataset output format<select value={format} onChange={e=>setFormat(e.target.value as typeof format)} disabled={busy}><option value="parquet">Parquet — preserve types</option><option value="csv">CSV — broad compatibility</option></select></label>{failedConversions>0&&previewCurrent&&<label className="acknowledge"><input type="checkbox" checked={confirmExport} onChange={e=>setConfirmExport(e.target.checked)}/><span>I reviewed {failedConversions} failed conversions that create null values.</span></label>}<button className="button lime full-width" onClick={()=>run('export')} disabled={busy||!previewCurrent||(failedConversions>0&&!confirmExport)}><Download size={16}/> Prepare export <ArrowDown size={16}/></button>{exportId&&<a className="button download-link full-width" href={`${base}/jobs/${exportId}/download`} download><CheckCheck size={16}/> Download your bundle</a>}<small>{previewCurrent?'Ready when you are. Source files are never included.':'Preview your recipe first to enable export.'}</small></div></div></Reveal>
        </section>
        <Reveal><div className="closing-note"><span className="closing-line"/><Leaf size={18}/><p>A healthier dataset. A more thoughtful model.</p><span className="closing-line"/></div></Reveal>
        <footer><Logo small/><span>Local by nature. Open by choice.</span><a href="https://github.com/Aadithya-Ram/DatasetMedic" target="_blank" rel="noreferrer">MIT licensed <ExternalLink size={12}/></a></footer>
      </main>
    </div>
    {(error||notice)&&<div className={`toast ${error?'error':'success'}`} role={error?'alert':'status'}><span>{error?<TriangleAlert size={19}/>:<Check size={19}/>}</span><p>{error||notice}</p><button className="icon-button" onClick={()=>{setError('');setNotice('');}} aria-label="Dismiss notification"><X size={17}/></button></div>}
    {busy&&<div className="job-bar" role="status"><LoaderCircle className="spin" size={21}/><div><strong>{job?.message||'Working locally…'}</strong><div className="progress-track"><span style={{width:`${job?.percent||8}%`}}/></div></div><span>{job?`${job.percent}%`:''}</span>{job&&<button className="text-button" onClick={cancelJob}>Cancel <X size={14}/></button>}</div>}
  </div>;
}
