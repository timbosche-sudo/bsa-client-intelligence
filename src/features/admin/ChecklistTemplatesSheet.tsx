import { useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, ListField, SelectField, TextArea, TextField } from '@/components/form/fields';
import { blankChecklistTemplate, setChecklistTemplateArchived, upsertChecklistTemplate } from '@/data/strategyMutations';
import { newId } from '@/domain/ids';
import type { ChecklistTemplate, Client, Dataset } from '@/domain/types';
import { run } from '@/state/actions';

/** Manage project readiness checklist templates for a client (and shared templates). */
export function ChecklistTemplatesSheet({ client, data, onClose }: { client: Client; data: Dataset; onClose(): void }) {
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [error, setError] = useState('');
  const templates = data.checklistTemplates.filter((t) => t.clientId === null || t.clientId === client.id);
  const usage = (id: string) => data.checklists.filter((c) => c.templateId === id).length;

  if (editing) {
    const t = editing;
    const setT = (patch: Partial<ChecklistTemplate>) => setEditing({ ...t, ...patch });
    const move = (i: number, d: number) => {
      const items = [...t.items];
      const [x] = items.splice(i, 1);
      items.splice(i + d, 0, x);
      setT({ items });
    };
    const isNew = !data.checklistTemplates.some((x) => x.id === t.id);
    return (
      <Sheet
        open
        onClose={onClose}
        title={isNew ? 'New checklist template' : 'Edit template'}
        description="Changes apply to future checklists. Checklists already applied to projects keep their items."
        footer={
          <>
            {error && <span className="mr-auto"><FieldError>{error}</FieldError></span>}
            <Button variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => (setEditing(null), setError(''))}>Back</Button>
            <Button
              variant="primary"
              onClick={() => {
                const r = run((d) => upsertChecklistTemplate(d, t), { clientId: client.id, entity: 'template', entityId: t.id, summary: `${isNew ? 'Created' : 'Updated'} checklist template "${t.name}"` });
                if (r.ok) (setEditing(null), setError(''));
                else setError(r.error ?? '');
              }}
            >
              Save template
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Template name" required value={t.name} onChange={(v) => setT({ name: v })} />
          <TextArea label="Description" rows={2} value={t.description} onChange={(v) => setT({ description: v })} />
          <TextField label="Source" value={t.source} onChange={(v) => setT({ source: v })} placeholder="e.g. Preparation document by …" />
          <SelectField label="Available to" value={t.clientId ?? ''} onChange={(v) => setT({ clientId: v || null })} options={[{ value: client.id, label: `${client.name} only` }, { value: '', label: 'All clients' }]} />
          <p className="eyebrow mt-2 text-ink">Items</p>
          <ol className="flex flex-col gap-3">
            {t.items.map((item, i) => (
              <li key={item.id} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-center gap-1">
                  <span className="tabular flex size-7 items-center justify-center rounded-full border border-line-strong text-xs font-bold">{i + 1}</span>
                  <span className="flex-1" />
                  <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp size={15} />} aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
                  <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown size={15} />} aria-label="Move down" disabled={i === t.items.length - 1} onClick={() => move(i, 1)} />
                  <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={15} />} aria-label="Remove item" onClick={() => setT({ items: t.items.filter((x) => x.id !== item.id) })} />
                </div>
                <div className="grid gap-3">
                  <TextField label="Consideration" value={item.title} onChange={(v) => setT({ items: t.items.map((x) => (x.id === item.id ? { ...x, title: v } : x)) })} />
                  <ListField label="Guidance prompts" rows={3} value={item.guidance} onChange={(v) => setT({ items: t.items.map((x) => (x.id === item.id ? { ...x, guidance: v } : x)) })} />
                </div>
              </li>
            ))}
          </ol>
          <Button className="self-start" icon={<Plus size={16} />} onClick={() => setT({ items: [...t.items, { id: newId('tpi'), title: '', guidance: [] }] })}>Add item</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Readiness checklist templates" description={`Templates available in ${client.name}. Apply them from a project’s Scope & Readiness tab.`} footer={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(blankChecklistTemplate(client.id))}>New template</Button>}>
      {templates.length === 0 ? (
        <p className="text-sm text-subtle">No templates yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-lg border border-line p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{t.name}</p>
                <p className="text-xs text-subtle">{t.items.length} items · used on {usage(t.id)} project(s){t.clientId === null ? ' · all clients' : ''}</p>
              </div>
              {t.archivedAt && <Badge tone="outline">Archived</Badge>}
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEditing(structuredClone(t))}>Edit</Button>
                <Button size="sm" variant="ghost" icon={t.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />} onClick={() => run((d) => setChecklistTemplateArchived(d, t.id, !t.archivedAt), { clientId: client.id, entity: 'template', entityId: t.id, summary: `${t.archivedAt ? 'Restored' : 'Archived'} template "${t.name}"` })}>
                  {t.archivedAt ? 'Restore' : 'Archive'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
