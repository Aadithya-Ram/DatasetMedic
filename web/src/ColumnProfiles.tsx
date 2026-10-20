import {useState} from 'react';
import {ChevronLeft, ChevronRight, Search} from 'lucide-react';

export type Column = {name: string; dtype: string; missing: number; unique: number; examples: unknown[]; stats?: Record<string, number | null>; top?: {value: unknown; count: number}[]};
const PAGE_SIZE = 24;
const pretty = (value: number) => new Intl.NumberFormat('en').format(value);
const show = (value: unknown) => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export function ColumnProfiles({columns, rows}: {columns: Column[]; rows: number}) {
  const [query, setQuery] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [page, setPage] = useState(0);
  const matches = columns.filter(column => column.name.toLowerCase().includes(query.toLowerCase()) && (!missingOnly || column.missing > 0));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matches.length / PAGE_SIZE) - 1));
  const start = currentPage * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  function reset() {setQuery('');setMissingOnly(false);setPage(0);}
  return <section className="column-profiles" aria-label="Column profiles">
    <div className="profile-tools">
      <label className="search-box"><Search size={15}/><input aria-label="Search column profiles" placeholder="Find a column…" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
      <button className="button secondary" aria-pressed={missingOnly} onClick={()=>{setMissingOnly(!missingOnly);setPage(0);}}>With missing values</button>
      <button className="text-button" onClick={reset}>Reset column filters</button>
    </div>
    <div className="profile-pagination">
      <p role="status">{matches.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, matches.length)} of ${matches.length} matching columns` : '0 matching columns'} · {columns.length} total</p>
      <div><button className="icon-button" aria-label="Previous column page" disabled={currentPage === 0} onClick={()=>setPage(currentPage - 1)}><ChevronLeft size={17}/></button>
        <button className="icon-button" aria-label="Next column page" disabled={start + PAGE_SIZE >= matches.length} onClick={()=>setPage(currentPage + 1)}><ChevronRight size={17}/></button></div>
    </div>
    <div className="column-grid">{visible.map(column=><article className="column-card" aria-label={`Column ${column.name}`} key={column.name}>
      <div><strong>{column.name}</strong><span>{column.dtype}</span></div>
      <div className="missing-meter"><span style={{width:`${rows ? column.missing / rows * 100 : 0}%`}}/></div>
      <p><span>{pretty(column.missing)} missing</span><span>{pretty(column.unique)} distinct</span></p>
      {column.stats ? <div className="column-stat"><span>MEAN</span><strong>{column.stats.mean == null ? '—' : Number(column.stats.mean.toFixed(2))}</strong><span>MEDIAN</span><strong>{show(column.stats.median)}</strong></div> :
        <div className="mini-bars">{column.top?.slice(0,3).map((value,index)=><div key={index}><span title={show(value.value)}>{show(value.value)}</span><div><i style={{width:`${rows ? value.count / rows * 100 : 0}%`}}/></div><small>{value.count}</small></div>)}</div>}
    </article>)}</div>
    {!matches.length && <p className="profile-empty">No column names match these filters. Try a different name or reset the filters.</p>}
  </section>;
}
