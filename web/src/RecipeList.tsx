import { ChevronDown, ChevronUp, Layers3, Pencil, X } from 'lucide-react';
import type { components } from './schema';

type Step = components['schemas']['Step'];
export const STEP_TITLES: Record<Step['op'], string> = {
  deduplicate: 'Remove repeated rows', drop: 'Drop columns', trim: 'Trim text',
  cast: 'Convert types', fill: 'Fill missing values',
};

export function RecipeList({steps, busy, editing, onEdit, onMove, onRemove}: {
  steps: Step[];
  busy: boolean;
  editing: boolean;
  onEdit: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  if (!steps.length) return <div className="recipe-empty"><Layers3 size={25}/>
    <p>Your next steps go here.<br/><span>Nothing changes until you export.</span></p></div>;

  return <ol className="recipe-steps" aria-label="Ordered cleaning recipe">{steps.map((step, index) =>
    <li className="recipe-step" data-recipe-index={index} key={index}>
      <span className="step-number" aria-hidden="true">{index + 1}</span>
      <div className="recipe-description"><strong>{STEP_TITLES[step.op]}</strong>
        <span>{step.columns?.join(', ') || 'Within each dataset'}{step.dtype ? ` → ${step.dtype}` : ''}
          {step.op === 'fill' ? ` · ${step.method}${step.method === 'constant' ? `: ${String(step.value ?? '')}` : ''}` : ''}</span>
      </div>
      <div className="recipe-actions">
        <button className="icon-button" data-recipe-action="up" aria-label={`Move recipe step ${index + 1} up`}
          title="Move earlier" disabled={busy || editing || index === 0} onClick={() => onMove(index, -1)}><ChevronUp size={15}/></button>
        <button className="icon-button" data-recipe-action="down" aria-label={`Move recipe step ${index + 1} down`}
          title="Move later" disabled={busy || editing || index === steps.length - 1} onClick={() => onMove(index, 1)}><ChevronDown size={15}/></button>
        <button className="icon-button" data-recipe-action="edit" aria-label={`Edit recipe step ${index + 1}`}
          title="Edit step" disabled={busy || editing} onClick={() => onEdit(index)}><Pencil size={14}/></button>
        <button className="icon-button" data-recipe-action="remove" aria-label={`Remove recipe step ${index + 1}`}
          title="Remove step" disabled={busy || editing} onClick={() => onRemove(index)}><X size={14}/></button>
      </div>
    </li>)}</ol>;
}
