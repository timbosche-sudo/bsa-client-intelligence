import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, TextArea, TextField } from '@/components/form/fields';
import { updateReadinessDimensions } from '@/data/adminMutations';
import { newId } from '@/domain/ids';
import type { Client, Dataset, ReadinessDimensionDef } from '@/domain/types';
import { run } from '@/state/actions';

export function ReadinessDimensionsSheet({ client, data, onClose }: { client: Client; data: Dataset; onClose(): void }) {
  const [dims, setDims] = useState<ReadinessDimensionDef[]>(() => [...client.config.readinessDimensions].sort((a, b) => a.order - b.order));
  const [error, setError] = useState('');
  const assessed = (id: string) => data.projects.filter((p) => p.clientId === client.id && p.readiness[id] && p.readiness[id].status !== 'not_assessed').length;
  const move = (i: number, d: number) => {
    const n = [...dims];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    setDims(n);
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Readiness dimensions"
      description={`Dimensions assessed on ${client.name} projects. Overall readiness is always a separate human judgment.`}
      footer={
        <>
          {error && <span className="mr-auto"><FieldError>{error}</FieldError></span>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              const r = run((d) => updateReadinessDimensions(d, client.id, dims), { clientId: client.id, entity: 'client', entityId: client.id, summary: 'Updated readiness dimensions' });
              if (r.ok) onClose();
              else setError(r.error ?? '');
            }}
          >
            Save dimensions
          </Button>
        </>
      }
    >
      <ol className="flex flex-col gap-3">
        {dims.map((x, i) => {
          const n = assessed(x.id);
          return (
            <li key={x.id} className="rounded-lg border border-line p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="tabular flex size-8 items-center justify-center rounded-full border border-line-strong text-xs font-bold">{i + 1}</span>
                <span className="flex-1 text-xs text-subtle">{n ? `${n} project assessment(s)` : 'No assessments yet'}</span>
                <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp size={16} />} aria-label={`Move ${x.label} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown size={16} />} aria-label={`Move ${x.label} down`} disabled={i === dims.length - 1} onClick={() => move(i, 1)} />
                <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={16} />} aria-label={`Remove ${x.label}`} disabled={n > 0} title={n ? 'Has assessments — rename instead' : undefined} onClick={() => setDims(dims.filter((y) => y.id !== x.id))} />
              </div>
              <div className="grid gap-3">
                <TextField label="Dimension" required value={x.label} onChange={(v) => setDims(dims.map((y) => (y.id === x.id ? { ...y, label: v } : y)))} />
                <TextArea label="Guidance for assessors" rows={2} value={x.guidance} onChange={(v) => setDims(dims.map((y) => (y.id === x.id ? { ...y, guidance: v } : y)))} />
              </div>
            </li>
          );
        })}
      </ol>
      <Button className="mt-4" icon={<Plus size={16} />} onClick={() => setDims([...dims, { id: newId('dim'), label: 'New dimension', guidance: '', order: dims.length + 1 }])}>Add dimension</Button>
    </Sheet>
  );
}
