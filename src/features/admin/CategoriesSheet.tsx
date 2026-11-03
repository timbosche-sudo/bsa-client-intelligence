import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, TextField } from '@/components/form/fields';
import { updatePortfolioCategories } from '@/data/mutations';
import { newId } from '@/domain/ids';
import type { CategoryDef, Client, Dataset } from '@/domain/types';
import { run } from '@/state/actions';

export function CategoriesSheet({ client, data, onClose }: { client: Client; data: Dataset; onClose(): void }) {
  const [cats, setCats] = useState<CategoryDef[]>(() => [...client.config.portfolioCategories].sort((a, b) => a.order - b.order));
  const [error, setError] = useState('');
  const used = (id: string) => data.projects.filter((p) => p.clientId === client.id && p.categoryId === id).length;
  const move = (i: number, d: number) => {
    const next = [...cats];
    const [c] = next.splice(i, 1);
    next.splice(i + d, 0, c);
    setCats(next);
  };
  const save = () => {
    const r = run((d) => updatePortfolioCategories(d, client.id, cats), { clientId: client.id, entity: 'client', entityId: client.id, summary: `Updated portfolio categories for ${client.name}` });
    if (r.ok) onClose();
    else setError(r.error ?? '');
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title="Portfolio categories"
      description={`Lifecycle categories for ${client.name}. Projects move between categories without losing history.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save categories</Button>
        </>
      }
    >
      <ol className="flex flex-col gap-3">
        {cats.map((c, i) => {
          const n = used(c.id);
          return (
            <li key={c.id} className="rounded-lg border border-line p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="tabular flex size-8 items-center justify-center rounded-full border border-line-strong text-xs font-bold">{i + 1}</span>
                {c.builtIn && <Badge tone="outline">Built-in</Badge>}
                <span className="flex-1 text-xs text-subtle">{n} project(s)</span>
                <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp size={16} />} aria-label={`Move ${c.label} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown size={16} />} aria-label={`Move ${c.label} down`} disabled={i === cats.length - 1} onClick={() => move(i, 1)} />
                <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={16} />} aria-label={`Remove ${c.label}`} disabled={c.builtIn || n > 0} title={c.builtIn ? 'Built-in categories can be renamed but not removed' : n ? 'Move its projects first' : undefined} onClick={() => setCats(cats.filter((x) => x.id !== c.id))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Name" required value={c.label} onChange={(v) => setCats(cats.map((x) => (x.id === c.id ? { ...x, label: v } : x)))} />
                <TextField label="Description" value={c.description ?? ''} onChange={(v) => setCats(cats.map((x) => (x.id === c.id ? { ...x, description: v } : x)))} />
              </div>
            </li>
          );
        })}
      </ol>
      <Button className="mt-4" icon={<Plus size={16} />} onClick={() => setCats([...cats, { id: newId('cat'), label: 'New category', description: '', order: cats.length + 1 }])}>
        Add category
      </Button>
      {error && <div className="mt-4"><FieldError>{error}</FieldError></div>}
    </Sheet>
  );
}
