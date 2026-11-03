import { useState } from 'react';
import { Archive, ArchiveRestore, ChevronLeft, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, ListField, SelectField, TextArea, TextField } from '@/components/form/fields';
import { blankMeetingTemplate, setMeetingTemplateArchived, upsertMeetingTemplate } from '@/data/meetingMutations';
import { agendaMinutes } from '@/data/meetingSelectors';
import type { ClientWorkspace } from '@/data/repository';
import type { MeetingTemplate } from '@/domain/types';
import { run } from '@/state/actions';
import { AgendaEditor } from './AgendaEditor';

export function MeetingTemplatesSheet({ ws, onClose, onUse }: { ws: ClientWorkspace; onClose(): void; onUse(templateId: string): void }) {
  const [editing, setEditing] = useState<MeetingTemplate | null>(null);
  const [error, setError] = useState('');

  if (editing) {
    const t = editing;
    const isNew = !ws.meetingTemplates.some((x) => x.id === t.id);
    return (
      <Sheet
        open
        onClose={onClose}
        width="xl"
        title={isNew ? 'New meeting template' : 'Edit meeting template'}
        description="Meetings created from a template get their own copy of the agenda."
        footer={
          <>
            {error && <span className="mr-auto"><FieldError>{error}</FieldError></span>}
            <Button variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => (setEditing(null), setError(''))}>Back</Button>
            <Button
              variant="primary"
              onClick={() => {
                const r = run((d) => upsertMeetingTemplate(d, t), { clientId: ws.client.id, entity: 'template', entityId: t.id, summary: `${isNew ? 'Created' : 'Updated'} meeting template "${t.name}"` });
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
          <TextField label="Template name" required value={t.name} onChange={(v) => setEditing({ ...t, name: v })} />
          <TextArea label="Description" rows={2} value={t.description} onChange={(v) => setEditing({ ...t, description: v })} />
          <SelectField label="Available to" value={t.clientId ?? ''} onChange={(v) => setEditing({ ...t, clientId: v || null })} options={[{ value: ws.client.id, label: `${ws.client.name} only` }, { value: '', label: 'All clients' }]} />
          <ListField label="Default objectives" value={t.objectives} onChange={(v) => setEditing({ ...t, objectives: v })} />
          <div className="border-t border-line-strong pt-4">
            <AgendaEditor agenda={t.agenda} onChange={(agenda) => setEditing({ ...t, agenda })} />
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Meeting templates" description={`Reusable agendas for ${ws.client.name}.`} footer={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(blankMeetingTemplate(ws.client.id))}>New template</Button>}>
      <ul className="flex flex-col gap-3">
        {ws.meetingTemplates.map((t) => (
          <li key={t.id} className="flex flex-col gap-3 rounded-lg border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{t.name}</p>
                <p className="text-xs text-subtle">{t.agenda.length} items · {agendaMinutes(t.agenda)} min{t.clientId === null ? ' · all clients' : ''}</p>
                {t.description && <p className="mt-1 text-sm text-muted">{t.description}</p>}
              </div>
              {t.archivedAt && <Badge tone="outline">Archived</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              {!t.archivedAt && <Button size="sm" variant="primary" onClick={() => onUse(t.id)}>Use for new meeting</Button>}
              <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setEditing(structuredClone(t))}>Edit</Button>
              <Button size="sm" variant="ghost" icon={t.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />} onClick={() => run((d) => setMeetingTemplateArchived(d, t.id, !t.archivedAt), { clientId: ws.client.id, entity: 'template', entityId: t.id, summary: `${t.archivedAt ? 'Restored' : 'Archived'} meeting template "${t.name}"` })}>
                {t.archivedAt ? 'Restore' : 'Archive'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
