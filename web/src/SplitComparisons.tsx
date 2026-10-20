import { Layers3 } from 'lucide-react';

type Summary = {
  dtype: string;
  missing: number;
  stats?: Record<string, number | null>;
  top?: {value: unknown; count: number}[];
};
export type Comparison = {datasets: string[]; columns: {name: string; left: Summary; right: Summary}[]};
type Props = {pairs: Comparison[]; profiles: Record<string, {rows: number}>; names: Record<string, string>};

const number = (value: number) => new Intl.NumberFormat('en', {maximumFractionDigits: 3}).format(value);
function statistic(value: number): string {
  const magnitude = Math.abs(value);
  return new Intl.NumberFormat('en', {
    maximumSignificantDigits: 6,
    notation: magnitude > 0 && (magnitude < 0.0001 || magnitude >= 1e9) ? 'scientific' : 'standard',
  }).format(value);
}
function rate(count: number, rows: number): string {
  if (!rows) return 'Not available';
  if (count > 0 && count / rows < 0.001) return '<0.1%';
  return new Intl.NumberFormat('en', {style: 'percent', maximumFractionDigits: 1}).format(count / rows);
}
function Missing({column, rows}: {column: Summary; rows: number}) {
  return <><strong>{rate(column.missing, rows)}</strong><small>{number(column.missing)} / {number(rows)} rows</small></>;
}
function Description({column, rows}: {column: Summary; rows: number}) {
  if (column.stats) {
    return column.stats.mean == null ? <span>No finite numeric values</span> : <>
      <span>Mean: {statistic(column.stats.mean)}</span>
      <small>Median: {column.stats.median == null ? 'Not available' : statistic(column.stats.median)}</small>
    </>;
  }
  const top = column.top?.[0];
  if (!top) return <span>No values</span>;
  const label = top.value == null ? 'Missing value' : typeof top.value === 'string' ? JSON.stringify(top.value) : String(top.value);
  return <><span className="comparison-value" title={label}>Most frequent: {label}</span><small>{number(top.count)} / {number(rows)} rows · {rate(top.count, rows)}</small></>;
}

export function SplitComparisons({pairs, profiles, names}: Props) {
  return <div className="profile-panel split-comparisons">
    <div className="panel-title"><span><Layers3 size={18}/> Between the splits</span><span className="muted">Descriptive comparisons</span></div>
    {pairs.map((pair, index) => {
      const [left, right] = pair.datasets;
      const leftName = names[left] || left, rightName = names[right] || right;
      const leftRows = profiles[left]?.rows || 0, rightRows = profiles[right]?.rows || 0;
      const title = `${leftName} ↔ ${rightName}`;
      return <div className="comparison" key={index}>
        <h4>{title}</h4>
        <p className="comparison-sizes">{leftName}: {number(leftRows)} rows · {rightName}: {number(rightRows)} rows · {pair.columns.length} common columns</p>
        <div className="table-wrap" role="region" aria-label={`${title} comparison`} tabIndex={0}>
          <table><caption className="visually-hidden">{title}: missingness and descriptive summaries</caption>
            <thead><tr><th scope="col">Column / type</th><th scope="col">{leftName} missing</th><th scope="col">{rightName} missing</th><th scope="col">{leftName} summary</th><th scope="col">{rightName} summary</th></tr></thead>
            <tbody>{pair.columns.map(column => <tr key={column.name}>
              <th scope="row"><strong>{column.name}</strong><small>{column.left.dtype === column.right.dtype ? column.left.dtype : <span className="comparison-type-difference">Types differ: {column.left.dtype} / {column.right.dtype}</span>}</small></th>
              <td><Missing column={column.left} rows={leftRows}/></td><td><Missing column={column.right} rows={rightRows}/></td>
              <td><Description column={column.left} rows={leftRows}/></td><td><Description column={column.right} rows={rightRows}/></td>
            </tr>)}</tbody>
          </table>
          {!pair.columns.length && <p className="comparison-sizes">No common columns to summarize.</p>}
        </div>
      </div>;
    })}
    <p className="comparison-disclaimer">Rates use each dataset’s own row count. Numeric summaries use finite values; the most frequent value may be missing or tied. Percentages and numeric summaries are rounded for display. These summaries describe differences; they are not statistical drift tests.</p>
  </div>;
}
