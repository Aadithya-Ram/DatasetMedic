import { useId, useState } from 'react';
import { Check, Search } from 'lucide-react';

type Props = {
  label: string;
  columns: string[];
  selected: string[];
  onChange: (columns: string[]) => void;
  disabled?: boolean;
  hint?: string;
};

export function ColumnPicker({label, columns, selected, onChange, disabled, hint}: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const visible = columns.filter(column => column.toLowerCase().includes(query.toLowerCase()) && (!selectedOnly || selected.includes(column)));
  return <fieldset className="column-picker" disabled={disabled}>
    <legend>{label}</legend>
    <div className="column-search"><Search size={14} aria-hidden="true"/><input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Find a column…" value={query} onChange={event => setQuery(event.target.value)} aria-controls={`${id}-options`}/></div>
    <div className="column-picker-tools">
      <button type="button" className="text-button" aria-pressed={selectedOnly} onClick={() => setSelectedOnly(!selectedOnly)}>Selected only ({selected.length})</button>
      <button type="button" className="text-button" disabled={!selected.length} onClick={() => onChange([])}>Clear selection</button>
    </div>
    <div className="chip-picker column-options" id={`${id}-options`} role="region" aria-label={`${label} options`} tabIndex={0}>
      {visible.map(column => <button type="button" key={column} className={selected.includes(column) ? 'chip selected' : 'chip'} aria-pressed={selected.includes(column)} onClick={() => onChange(selected.includes(column) ? selected.filter(value => value !== column) : [...selected, column])}>{selected.includes(column) && <Check size={12} aria-hidden="true"/>} {column}</button>)}
      {!visible.length && <p className="column-empty">{selectedOnly && !selected.length ? 'No columns selected. Turn off “Selected only” to browse.' : 'No matching columns. Try another search.'}</p>}
    </div>
    <p className="column-picker-count" role="status">{visible.length} of {columns.length} columns shown · {selected.length} selected</p>
    {hint && <small>{hint}</small>}
  </fieldset>;
}
