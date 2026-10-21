import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Activity, ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Columns3, Download, ExternalLink, FileCheck2, FileSpreadsheet, FlaskConical, FolderOpen, Github, Layers3, Leaf, LoaderCircle, LockKeyhole, Plus, ScanLine, Search, Settings2, ShieldCheck, Sparkles, Trash2, TriangleAlert, Upload, WandSparkles, X } from 'lucide-react';
import type { components } from './schema';
import { version as appVersion } from '../package.json';
import { RecipeList, STEP_TITLES } from './RecipeList';
import { ColumnPicker } from './ColumnPicker';
import { importProblem, importSize } from './imports';
import { SplitComparisons } from './SplitComparisons';
import { ColumnProfiles } from './ColumnProfiles';
import { useFindings } from './useFindings';
import type { Column } from './ColumnProfiles';
import type { Comparison } from './SplitComparisons';

type Config = components['schemas']['AuditConfig'];
type Step = components['schemas']['Step'];
type JobStatus = components['schemas']['JobStatus'];
type Kind = 'audit' | 'preview' | 'export';
type Dataset = { id: string; name: string; size: number };
type Row = Record<string, unknown>;
type Profile = { rows: number; columns: Column[]; sample: Row[] };
type Change = {step: number; dataset: string; op: string; affected_rows: number; conversion_failures: Record<string, number>; before_rows: number; after_rows: number};
type Result = {profiles: Record<string, Profile>; finding_count?: number; changes?: Change[]; fitted_values?: Record<string, Row>; comparisons?: Comparison[]; notice?: string};
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
  const [offset, setOffset] = useState(0);
  const [openFinding, setOpenFinding] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeDataset, setActiveDataset] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [recipeAnnouncement, setRecipeAnnouncement] = useState('');
  const operationInput = useRef<HTMLSelectElement>(null);
  const saveStepButton = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [previewKey, setPreviewKey] = useState('');
  const [exportId, setExportId] = useState('');
  const [format, setFormat] = useState<'csv'|'parquet'>('parquet');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<{id: string; kind: Kind; percent: number; message: string} | null>(null);
  const [error, setError] = useState('');
  const [recipeFailure, setRecipeFailure] = useState<{step: number; key: string; message: string} | null>(null);
  const [notice, setNotice] = useState('');
  const [separator, setSeparator] = useState(',');
  const [dropActive, setDropActive] = useState(false);
  const [importing, setImporting] = useState<{name: string; size: number; index: number; total: number} | null>(null);
  const importInFlight = useRef(false);
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
  const total = auditResult?.finding_count || 0;
  const findingPage = useFindings(base, auditId, offset, search, filter);
  const findings = findingPage.items;

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
  async function run(kind: Kind, useConfig = config) {
    if (!sid || busy) return;
    setError('');setRecipeFailure(null);setNotice('');setBusy(true);cancelled.current=false;
    try {
      const created = await api<{id:string}>(`${base}/jobs`, {method:'POST',body:JSON.stringify({kind, config:useConfig, recipe:{steps}, output_format:format})});
      setJob({id:created.id,kind,percent:0,message:'Starting local worker'});
      for (;;) {
        await new Promise(r => setTimeout(r,350));
        if (cancelled.current) return;
        const status = await api<JobStatus>(`${base}/jobs/${created.id}`);
        if (status.status === 'failed') {
          const message=status.error || 'The analysis could not finish.';
          if (status.error_step && status.error_step<=steps.length) setRecipeFailure({step:status.error_step,key:currentRecipeKey,message});
          throw new Error(message);
        }
        if (status.status === 'cancelled') {setNotice('Job cancelled. Your source files are unchanged.');return;}
        setJob({id:created.id,kind,percent:status.percent??0,message:status.message||'Working locally'});
        if (status.status === 'complete') break;
      }
      if (cancelled.current) return;
      const result = await api<Result>(`${base}/jobs/${created.id}/result`);
      if (kind === 'audit') {setAuditResult(result);setAuditId(created.id);setOffset(0);setSearch('');setFilter('all');setOpenFinding('');setActiveDataset(datasets[0]?.id || Object.keys(result.profiles)[0]);navigate('findings');}
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
    if (busy || !sid || importInFlight.current) return;
    const batch = Array.from(files);
    if (!batch.length) return;
    setNotice('');setError('');
    const problem = importProblem(batch, datasets);
    if (problem) {
      setError(`No files from this batch were imported. ${problem}`);
      if (fileInput.current) fileInput.current.value='';
      return;
    }
    importInFlight.current=true;
    setBusy(true);
    let imported=0;
    let current='';
    try {
      let next = [...datasets];
      for (const [index,file] of batch.entries()) {
        current=file.name;
        setImporting({name:file.name,size:file.size,index:index+1,total:batch.length});
        const body = new FormData();body.append('file',file);body.append('separator',separator);
        const data = await api<Dataset>(`${base}/imports`,{method:'POST',body});
        next = [...next,data];setDatasets(next);imported++;
        setAuditResult(null);setAuditId('');setPreview(null);setExportId('');
      }
      setNotice(`${imported} ${imported===1?'file imported':'files imported'}. Choose split roles below, then run your audit.`);
    } catch(e) {
      setError(`${imported} of ${batch.length} files imported before “${current}” failed: ${(e as Error).message} Remaining files were not imported. Successfully imported files stay in this session.`);
    } finally {
      importInFlight.current=false;setImporting(null);setBusy(false);
      if(fileInput.current) fileInput.current.value='';
    }
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
      setSid(next.id);sidRef.current=next.id;setDatasets([]);setConfig(EMPTY_CONFIG);setAuditResult(null);setAuditId('');setSteps([]);resetStepForm();setPreview(null);setExportId('');setNotice('Session cleared. Temporary copies and results have been deleted.');
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  function resetStepForm() {
    setEditingIndex(null);setOp('deduplicate');setStepColumns([]);
    setCastType('decimal');setFillMethod('median');setFillValue('');
  }
  function focusStep(index: number, action: string) {
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(
      `[data-recipe-index="${index}"] [data-recipe-action="${action}"]`)?.focus());
  }
  function editStep(index: number) {
    if (busy || editingIndex !== null) return;
    const step = steps[index];
    setEditingIndex(index);setOp(step.op);setStepColumns([...(step.columns || [])]);
    setCastType(step.dtype || 'decimal');setFillMethod(step.method || 'median');
    setFillValue(step.value == null ? '' : String(step.value));setError('');
    setRecipeAnnouncement(`Editing step ${index + 1}: ${STEP_TITLES[step.op]}. Save or cancel to continue.`);
    requestAnimationFrame(() => operationInput.current?.focus());
  }
  function cancelEdit() {
    const index = editingIndex;
    resetStepForm();setRecipeAnnouncement('Editing cancelled. The recipe is unchanged.');
    if (index !== null) focusStep(index, 'edit');
  }
  function moveStep(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (busy || editingIndex !== null || destination < 0 || destination >= steps.length) return;
    const next = [...steps];
    [next[index], next[destination]] = [next[destination], next[index]];
    setSteps(next);
    setRecipeAnnouncement(`Moved ${STEP_TITLES[steps[index].op]} from step ${index + 1} to step ${destination + 1}. Preview again before export.`);
    // Keep keyboard focus on the moved step. The reverse direction is always enabled.
    focusStep(destination, direction === -1 ? 'down' : 'up');
  }
  function removeStep(index: number) {
    if (busy || editingIndex !== null) return;
    setSteps(steps.filter((_, i) => i !== index));
    setRecipeAnnouncement(`Removed step ${index + 1}. Preview again before export.`);
    if (steps.length > 1) focusStep(Math.min(index, steps.length - 2), 'remove');
    else requestAnimationFrame(() => saveStepButton.current?.focus());
  }
  function addStep() {
    if (busy || (editingIndex === null && steps.length >= 50)) return;
    setError('');
    if (op !== 'deduplicate' && !stepColumns.length) {setError('Choose at least one column for this operation.');return;}
    const step: Step = {op, method:fillMethod, columns:op==='deduplicate'?[]:[...stepColumns],
      ...(op==='cast'?{dtype:castType}:{}), ...(op==='fill'?{value:fillValue}: {})};
    if (editingIndex === null) {
      setSteps([...steps, step]);setStepColumns([]);
      setRecipeAnnouncement(`Added step ${steps.length + 1}: ${STEP_TITLES[op]}.`);
    } else {
      const index = editingIndex;
      setSteps(steps.map((existing, i) => i === index ? step : existing));
      resetStepForm();setRecipeAnnouncement(`Saved step ${index + 1}. Preview again before export.`);
      focusStep(index, 'edit');
    }
  }
  const filteredFindings = findings;
  const failedConversions = preview?.changes?.reduce((sum,c) => sum + Object.values(c.conversion_failures).reduce((a,b)=>a+b,0),0) || 0;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to workbench</a>
    <aside className="sidebar">
      <a href="#overview" className="brand-link" aria-label="DatasetMedic home"><Logo/></a>
      <div className="workspace-label">YOUR WORKBENCH <span>LOCAL</span></div>
      <nav aria-label="Main navigation">{[{id:'overview',label:'Overview',Icon:Layers3},{id:'workspace',label:'Datasets',Icon:FolderOpen},{id:'findings',label:'Health report',Icon:Activity},{id:'cleaning',label:'Cleaning studio',Icon:WandSparkles},{id:'export',label:'Export & reproduce',Icon:ArrowDownToLine}].map(({id,label,Icon}) => <button key={id} onClick={()=>navigate(id)} aria-current={activeSection===id?'location':undefined} className={activeSection===id?'nav-item active':'nav-item'}><Icon size={18}/><span>{label}</span>{id==='findings'&&total>0&&<span className="nav-count">{total}</span>}</button>)}</nav>
      <div className="sidebar-note"><div className="note-icon"><ShieldCheck size={19}/></div><strong>A private practice.</strong><p>Your datasets stay on your device. Always.</p><span><span className="status-dot"/> Local processing</span></div>
      <div className="sidebar-bottom"><a href="https://github.com/Aadithya-Ram/DatasetMedic" target="_blank" rel="noreferrer"><Github size={17}/> Built in the open <ArrowUpRight size={14}/></a><span>v{appVersion} <span className="tiny-separator">/</span> made for better data</span></div>
    </aside>
    <div className="main-shell">
      <header className={scrolled?'topbar scrolled':'topbar'}><div className="breadcrumb"><span>Workbench</span><ChevronRight size={13}/><strong>{activeSection==='overview'?'Overview':activeSection==='workspace'?'Datasets':activeSection==='findings'?'Health report':activeSection==='cleaning'?'Cleaning studio':'Export & reproduce'}</strong></div><div className="topbar-right"><span className="local-badge"><span className="status-dot"/> Running locally</span><a className="icon-button" aria-label="Documentation on GitHub" href="https://github.com/Aadithya-Ram/DatasetMedic#readme" target="_blank" rel="noreferrer"><CircleHelp size={18}/></a><span className="avatar">DM</span></div></header>
      <main id="main-content" tabIndex={-1}>
        <section id="overview" className="overview-section">
          <Reveal><div className="eyebrow"><span className="eyebrow-line"/> GOOD MODELS START WITH GOOD DATA</div></Reveal>
          <div className="hero"><div className="hero-copy"><Reveal delay={60}><h1>A little clarity.<br/>Before you <em>train.</em></h1></Reveal><Reveal delay={140}><p className="hero-description">Meet your dataset’s second opinion. Spot the hidden issues,<br className="desktop-break"/> catch split leakage, and give your next model a healthier start.</p></Reveal><Reveal delay={220}><div className="hero-actions"><button className="button primary" onClick={()=>navigate('workspace')}><Plus size={17}/> Check a dataset <ArrowRight size={16}/></button><button className="text-button" onClick={demo} disabled={busy||!sid}>{datasets.length?'Open workbench':'Explore the demo'} <ArrowUpRight size={16}/></button></div><div className="hero-trust"><LockKeyhole size={13}/><span>No uploads to the cloud.</span><span className="trust-dot">·</span><span>No API keys. Just your data.</span></div></Reveal></div><Reveal className="hero-art" delay={180}><Constellation/></Reveal></div>
          <Reveal delay={260}><div className="stats-grid">{[{label:'DATASETS IN SESSION',value:datasets.length.toString().padStart(2,'0'),sub:datasets.length?'Ready for a closer look':'A fresh start',Icon:Layers3,color:'sage'},{label:'ROWS INSPECTED',value:pretty(numberRows),sub:numberRows?'Every record counts':'Your next discovery awaits',Icon:ScanLine,color:'blue'},{label:'FINDINGS TO EXPLORE',value:pretty(total),sub:total?'A little attention goes a long way':'Clarity is a check away',Icon:Activity,color:'peach'},{label:'PROCESSING LOCATION',value:'On your device',sub:'Private by design',Icon:ShieldCheck,color:'lime'}].map(({label,value,sub,Icon,color},i) => <div className={`stat-card stat-${i}`} key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon size={17}/></span></div><div className={`stat-value ${i===3?'stat-text':''}`}>{value}</div><div className="stat-sub">{i===3&&<span className="status-dot"/>}{sub}</div></div>)}</div></Reveal>
        </section>

        <section id="workspace" className="content-section">
          <Reveal><div className="section-heading"><div><div className="section-kicker">01 <span>/</span> THE STARTING POINT</div><h2>Let’s meet your data<span>.</span></h2><p>One dataset for a health check. Two or three to look between the splits.</p></div><span className="pill"><FileSpreadsheet size={13}/> CSV & Parquet</span></div></Reveal>
          <Reveal><div className={`import-panel ${dropActive?'drag-active':''}`} onDragOver={e=>{e.preventDefault();setDropActive(true);}} onDragLeave={()=>setDropActive(false)} onDrop={e=>{e.preventDefault();setDropActive(false);void upload(e.dataTransfer.files);}}>
            <div className="upload-orbit"><div className="upload-icon"><Upload size={25} strokeWidth={1.5}/></div><span className="orbit-dot"/></div><h3>Drop in a little possibility.</h3><p>Drag your datasets here, or choose files to get started.</p><input ref={fileInput} type="file" accept=".csv,.parquet" multiple onChange={e=>{if(e.target.files)void upload(e.target.files);}} className="visually-hidden" id="file-import" aria-label="Import CSV or Parquet datasets" disabled={busy||!sid||datasets.length>=3}/><button className="button primary" onClick={()=>fileInput.current?.click()} disabled={busy||!sid||datasets.length>=3}><FolderOpen size={16}/> Choose files</button><div className="import-hint">Up to 3 files <span>·</span> 250 MiB per file <span>·</span> Originals stay untouched</div>
            {importing&&<div className="import-progress" role="status"><LoaderCircle size={18} className="spin" aria-hidden="true"/><div><span>Importing file {importing.index} of {importing.total}</span><strong>{importing.name}</strong><small>{importSize(importing.size)} · Copying to temporary session storage on this device</small></div></div>}
            <div className="separator-control"><label htmlFor="separator">CSV delimiter</label><select id="separator" value={separator} onChange={e=>setSeparator(e.target.value)} disabled={busy}><option value=",">Comma (,)</option><option value=";">Semicolon (;)</option><option value={'\t'}>Tab</option><option value="|">Pipe (|)</option></select></div>
          </div></Reveal>
          {datasets.length===0&&<Reveal><div className="demo-strip"><div className="demo-badge"><FlaskConical size={21}/></div><div><strong>Just looking around?</strong><p>Try a tiny dataset with a few carefully planted problems.</p></div><button className="text-button" onClick={demo} disabled={busy||!sid}>Load sample datasets <ArrowRight size={16}/></button></div></Reveal>}
          {datasets.length>0&&<div className="dataset-list">{datasets.map(d=><div className="dataset-row" key={d.id}><span className="file-icon"><FileSpreadsheet size={21}/></span><div className="dataset-name"><strong>{d.name}</strong><span>{(d.size/1024).toFixed(1)} KiB <span>·</span> Local session copy</span></div><label className="role-label">Split role<select aria-label={`Split role for ${d.name}`} value={config.roles?.[d.id]||'dataset'} onChange={e=>changeConfig({...config,roles:{...config.roles,[d.id]:e.target.value as 'train'|'test'|'validation'|'dataset'}})} disabled={busy}><option value="dataset">Unassigned</option><option value="train">Training</option><option value="validation">Validation</option><option value="test">Test</option></select></label></div>)}<div className="dataset-actions"><button className="text-button muted" onClick={clear} disabled={busy}><Trash2 size={15}/> Clear session</button><button className="button primary" onClick={()=>run('audit')} disabled={busy}><ScanLine size={16}/> Run health check <ArrowRight size={16}/></button></div></div>}
          {profile&&<Reveal><details className="settings-panel" open><summary><Settings2 size={17}/> Make the check yours <ChevronDown size={15}/></summary><div className="settings-grid"><label>Target column<select value={config.target||''} onChange={e=>changeConfig({...config,target:e.target.value||null})} disabled={busy}><option value="">No target selected</option>{columnNames.map(c=><option key={c}>{c}</option>)}</select><small>Used for class balance. Excluded from default feature matching.</small></label><ColumnPicker key={`groups-${activeDataset}`} label="Subject / group columns" columns={columnNames} selected={config.groups||[]} disabled={busy} onChange={groups=>changeConfig({...config,groups})} hint="Find subjects shared between splits."/><ColumnPicker key={`features-${activeDataset}`} label="Feature columns for exact matching" columns={columnNames} selected={config.features||[]} disabled={busy} onChange={features=>changeConfig({...config,features})} hint="Leave empty to compare common columns, excluding target and groups."/></div><div className="settings-footer"><button className="button secondary" onClick={()=>run('audit')} disabled={busy}><ScanLine size={15}/> Update health check</button></div></details></Reveal>}
        </section>

        <section id="findings" className="content-section">
          <Reveal><div className="section-heading"><div><div className="section-kicker">02 <span>/</span> A CLOSER LOOK</div><h2>Small signals. Better decisions<span>.</span></h2><p>Understand what’s happening, with the actual records behind every finding.</p></div>{auditResult&&<span className="pill"><Activity size={13}/>{total} findings</span>}</div></Reveal>
          {!auditResult?<Reveal><div className="empty-report"><div className="empty-illustration"><div/><div/><div/><span><Activity size={23}/></span></div><h3>Every dataset has a story.</h3><p>Run your first health check to see missing values, repeated<br/>records, mixed types, and potential split contamination.</p><button className="text-button" onClick={()=>navigate('workspace')}>Start with a dataset <ArrowRight size={15}/></button></div></Reveal>:<>
            <div className="report-toolbar"><div className="segmented">{[['all','All findings'],['danger','Split risks'],['warning','Attention'],['info','Observations']].map(([value,label])=><button key={value} className={filter===value?'selected':''} aria-pressed={filter===value} onClick={()=>{setFilter(value);setOffset(0);setOpenFinding('');}}>{label}</button>)}</div><label className="search-box"><Search size={15}/><input placeholder="Search all findings…" aria-label="Search all findings" maxLength={200} value={search} onChange={e=>{setSearch(e.target.value);setOffset(0);setOpenFinding('');}}/></label></div>
            <div className="findings-list" aria-busy={findingPage.loading}>{filteredFindings.map((f,i)=><Reveal key={`${auditId}-${f.id}`} delay={Math.min(i*35,150)}><article className={`finding-card ${f.severity}`}><button className="finding-toggle" aria-expanded={openFinding===f.id} onClick={()=>setOpenFinding(openFinding===f.id?'':f.id)}><span className="finding-icon">{f.severity==='danger'?<ShieldCheck size={19}/>:f.severity==='warning'?<TriangleAlert size={19}/>:<Activity size={19}/>}</span><span className="finding-title"><strong>{f.title}</strong><span>{f.datasets.map(k=>names[k]).join(' ↔ ')}</span></span><span className="count-badge">{pretty(f.count)}</span><ChevronDown size={17} className={openFinding===f.id?'rotated':''}/></button>{openFinding===f.id&&<div className="finding-detail"><p>{f.detail}</p>{f.columns.length>0&&<p className="muted">Columns: {f.columns.join(', ')}</p>}<DataTable rows={f.examples}/><small>Up to 12 examples shown. Source row numbers, when present, are 1-based data rows after the header.</small></div>}</article></Reveal>)}</div>
            {findingPage.error&&<div role="alert" className="findings-status"><p>{findingPage.error}</p><button className="text-button" onClick={findingPage.retry}>Retry findings</button></div>}
            {!findingPage.loading&&!findingPage.error&&!filteredFindings.length&&<div className="no-findings"><CheckCheck size={24}/><p>{total?'No findings match these filters.':'No findings from the selected checks.'}</p></div>}
            <div className="pagination"><span role="status">{findingPage.loading ? 'Loading findings…' : findingPage.error ? 'Findings unavailable' : `${findingPage.total ? `${offset+1}–${Math.min(offset+20,findingPage.total)} of ${findingPage.total}` : '0'} matching findings`} · {total} total · Filters cover the full audit</span><button className="icon-button" disabled={findingPage.loading||!!findingPage.error||offset===0} onClick={()=>{setOffset(Math.max(0,offset-20));setOpenFinding('');}} aria-label="Previous findings page"><ChevronLeft size={17}/></button><button className="icon-button" disabled={findingPage.loading||!!findingPage.error||offset+20>=findingPage.total} onClick={()=>{setOffset(offset+20);setOpenFinding('');}} aria-label="Next findings page"><ChevronRight size={17}/></button></div>
            <div className="info-note"><CircleHelp size={16}/><p>{auditResult.notice}</p></div>
            <Reveal><div className="profile-panel"><div className="panel-title"><span><Columns3 size={18}/> The shape of your data</span><select aria-label="Dataset to inspect" value={activeDataset} onChange={e=>setActiveDataset(e.target.value)}>{datasets.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>{profile&&<ColumnProfiles key={`${auditId}-${activeDataset}`} columns={profile.columns} rows={profile.rows}/>}<details className="sample-details"><summary>Preview source records <ChevronDown size={15}/></summary><DataTable rows={profile?.sample||[]}/></details></div></Reveal>
            {!!auditResult.comparisons?.length&&<Reveal><SplitComparisons pairs={auditResult.comparisons} profiles={auditResult.profiles} names={names}/></Reveal>}
          </>}
        </section>

        <section id="cleaning" className="content-section">
          <Reveal><div className="section-heading"><div><div className="section-kicker">03 <span>/</span> A DELIBERATE NEXT STEP</div><h2>A fresh start. On your terms<span>.</span></h2><p>Build a recipe, preview the effect, and keep every decision reproducible.</p></div><span className="pill"><Leaf size={13}/> Preview first</span></div></Reveal>
          <Reveal><div className="cleaning-layout"><div className={`recipe-builder ${editingIndex !== null ? 'editing' : ''}`}><div className="panel-title"><span><WandSparkles size={18}/> Your cleaning recipe</span><span className="pill">{steps.length} {steps.length === 1 ? 'step' : 'steps'}</span></div><div className="builder-body">{editingIndex !== null && <div className="recipe-edit-note"><span>Editing step {editingIndex + 1}. Changes apply when saved.</span><button className="text-button" onClick={cancelEdit} disabled={busy}>Cancel editing</button></div>}<label>What would you like to do?<select ref={operationInput} value={op} disabled={busy} onChange={e=>{setOp(e.target.value as Step['op']);setStepColumns([]);}}><option value="deduplicate">Remove repeated rows within each split</option><option value="drop">Drop selected columns</option><option value="trim">Trim text whitespace</option><option value="cast">Convert column types</option><option value="fill">Fill missing values</option></select></label>{op!=='deduplicate'&&<ColumnPicker key={`${activeDataset}-${op}-${editingIndex}`} label="Choose columns" columns={columnNames} selected={stepColumns} disabled={busy||!profile} onChange={setStepColumns}/>}{op==='cast'&&<label>Convert to<select value={castType} disabled={busy} onChange={e=>setCastType(e.target.value as typeof castType)}><option value="decimal">Decimal number</option><option value="integer">Integer</option><option value="text">Text</option><option value="boolean">Boolean (true / false / 1 / 0)</option><option value="date">Date (YYYY-MM-DD)</option></select></label>}{op==='fill'&&<><label>Fill strategy<select value={fillMethod} disabled={busy} onChange={e=>setFillMethod(e.target.value as typeof fillMethod)}><option value="median">Training median (numeric columns)</option><option value="mode">Training mode (most frequent)</option><option value="constant">Constant value</option></select></label>{fillMethod==='constant'&&<label>Fill value<input value={fillValue} disabled={busy} onChange={e=>setFillValue(e.target.value)} placeholder="e.g. 0, true, or Unknown"/></label>}</>}
            <button ref={saveStepButton} className="button secondary full-width" onClick={addStep} disabled={busy||!profile||(editingIndex===null&&steps.length>=50)}><Plus size={16}/>{editingIndex===null?'Add recipe step':'Save step changes'}</button>
            <p className="recipe-order-hint">Steps run from top to bottom. Changing the order can change your results.</p>
            <RecipeList steps={steps} busy={busy} editing={editingIndex!==null} onEdit={editStep} onMove={moveStep} onRemove={removeStep}/>
            <span className="visually-hidden" role="status" aria-live="polite">{recipeAnnouncement}</span>
            <button className="button primary full-width" disabled={busy||editingIndex!==null||!datasets.length||!auditResult} onClick={()=>run('preview')}><ScanLine size={16}/> Preview changes <ArrowRight size={16}/></button></div></div><div className="cleaning-aside"><div className="mint-card"><span className="round-icon"><ShieldCheck size={25} strokeWidth={1.4}/></span><h3>Careful by<br/><em>design.</em></h3><p>Your original files stay untouched. Every operation is explicit, previewed, and recorded.</p><ul><li><Check size={14}/> No automatic split deletion</li><li><Check size={14}/> Training-only learned values</li><li><Check size={14}/> The same engine, every time</li></ul><div className="mint-card-art" aria-hidden="true"><div/><div/><div/></div></div><div className="info-note"><CircleHelp size={16}/><p>With multiple datasets, learned filling requires exactly one training split. Without split roles, a single dataset fits its own values.</p></div></div></div></Reveal>
          {preview&&<div className="preview-panel"><div className="panel-title"><span><FileCheck2 size={18}/> Cleaning preview</span><span className={`pill ${previewCurrent?'':'stale'}`}>{previewCurrent?'Up to date':'Recipe or settings changed — preview again'}</span></div><div className="table-wrap"><table><thead><tr><th>Step</th><th>Dataset</th><th>Operation</th><th>Affected rows</th><th>Rows after</th><th>Failed conversions</th></tr></thead><tbody>{preview.changes?.map((c,i)=><tr key={i}><td>{c.step}</td><td>{names[c.dataset]}</td><td>{c.op}</td><td>{pretty(c.affected_rows)}</td><td>{pretty(c.after_rows)}</td><td className={Object.values(c.conversion_failures).some(n=>n>0)?'failure-cell':''}>{Object.entries(c.conversion_failures).map(([col,n])=>`${col}: ${n}`).join(', ')||'—'}</td></tr>)}</tbody></table></div>{!preview.changes?.length&&<p className="preview-note">No cleaning operations selected. Export will preserve the imported data values.</p>}<details className="sample-details"><summary>See the resulting records and fitted values <ChevronDown size={15}/></summary>{Object.entries(preview.profiles).map(([id,p])=><div className="preview-records" key={id}><h4>{names[id]} · {pretty(p.rows)} rows</h4><DataTable rows={p.sample}/></div>)}<pre>{JSON.stringify(preview.fitted_values,null,2)}</pre></details></div>}
        </section>

        <section id="export" className="content-section">
          <Reveal><div className="export-panel"><div className="export-copy"><div className="section-kicker">04 <span>/</span> TAKE THE CLARITY WITH YOU</div><h2>Good data.<br/><em>A clear paper trail.</em></h2><p>Your cleaned datasets, a readable report, and the exact recipe to do it all again. In one neat little bundle.</p><div className="export-tags"><span><FileSpreadsheet size={14}/> Cleaned data</span><span><FileCheck2 size={14}/> HTML report</span><span><CheckCheck size={14}/> Python script</span></div></div><div className="export-controls"><div className="export-file-icon"><Download size={30} strokeWidth={1.3}/><span>.zip</span></div><label>Dataset output format<select value={format} onChange={e=>setFormat(e.target.value as typeof format)} disabled={busy}><option value="parquet">Parquet — preserve types</option><option value="csv">CSV — broad compatibility</option></select></label>{failedConversions>0&&previewCurrent&&<label className="acknowledge"><input type="checkbox" checked={confirmExport} onChange={e=>setConfirmExport(e.target.checked)}/><span>I reviewed {failedConversions} failed conversions that create null values.</span></label>}<button className="button lime full-width" onClick={()=>run('export')} disabled={busy||editingIndex!==null||!previewCurrent||(failedConversions>0&&!confirmExport)}><Download size={16}/> Prepare export <ArrowDown size={16}/></button>{exportId&&<a className="button download-link full-width" href={`${base}/jobs/${exportId}/download`} download><CheckCheck size={16}/> Download your bundle</a>}<small>{previewCurrent?'Ready when you are. Source files are never included.':'Preview your recipe first to enable export.'}</small></div></div></Reveal>
        </section>
        <Reveal><div className="closing-note"><span className="closing-line"/><Leaf size={18}/><p>A healthier dataset. A more thoughtful model.</p><span className="closing-line"/></div></Reveal>
        <footer><Logo small/><span>Local by nature. Open by choice.</span><a href="https://github.com/Aadithya-Ram/DatasetMedic" target="_blank" rel="noreferrer">MIT licensed <ExternalLink size={12}/></a></footer>
      </main>
    </div>
    {(error||notice)&&<div className={`toast ${error?'error':'success'}`} role={error?'alert':'status'}><span>{error?<TriangleAlert size={19}/>:<Check size={19}/>}</span><p>{error||notice}</p>{error&&recipeFailure&&recipeFailure.message===error&&recipeFailure.key===currentRecipeKey&&editingIndex===null&&<button className="text-button" disabled={busy} onClick={()=>{navigate('cleaning');editStep(recipeFailure.step-1);}}>Edit step {recipeFailure.step}</button>}<button className="icon-button" onClick={()=>{setError('');setRecipeFailure(null);setNotice('');}} aria-label="Dismiss notification"><X size={17}/></button></div>}
    {busy&&!importing&&<div className="job-bar" role="status"><LoaderCircle className="spin" size={21}/><div><strong>{job?.message||'Working locally…'}</strong><div className="progress-track"><span style={{width:`${job?.percent||8}%`}}/></div></div><span>{job?`${job.percent}%`:''}</span>{job&&<button className="text-button" onClick={cancelJob}>Cancel <X size={14}/></button>}</div>}
  </div>;
}
