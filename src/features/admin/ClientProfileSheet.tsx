import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, FormSection, ListField, SelectField, TextArea, TextField } from '@/components/form/fields';
import { setClientArchived, updateClientProfile } from '@/data/adminMutations';
import { CLIENT_STATUS_LABELS } from '@/domain/labels';
import type { Client, ClientStatus } from '@/domain/types';
import { run } from '@/state/actions';

export function ClientProfileSheet({ client, currentClientId, onClose }: { client: Client; currentClientId: string; onClose(): void }) {
  const navigate = useNavigate();
  const [c, setC] = useState<Client>(() => structuredClone(client));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const set = (patch: Partial<Client>) => (setC((x) => ({ ...x, ...patch })), setDirty(true));
  const archived = client.status === 'archived';

  const save = () => {
    const r = run((d) => updateClientProfile(d, c), { clientId: c.id, entity: 'client', entityId: c.id, summary: `Updated client profile "${c.name.trim()}"` });
    if (r.ok) {
      onClose();
      if (c.status === 'archived' && c.id === currentClientId) navigate('/');
    } else setError(r.error ?? '');
  };

  return (
    <Sheet
      open
      onClose={onClose}
      confirmClose={dirty}
      title={`Client profile — ${client.name}`}
      description="Shown on the Client Overview and in reports."
      footer={
        <>
          {error && <span className="mr-auto"><FieldError>{error}</FieldError></span>}
          <Button
            size="sm"
            variant="ghost"
            className="mr-auto"
            icon={archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            onClick={() => {
              if (!archived && !window.confirm(`Archive the ${client.name} workspace? It disappears from the client selector; all records are kept and it can be restored here.`)) return;
              const r = run((d) => setClientArchived(d, client.id, !archived), { clientId: client.id, entity: 'client', entityId: client.id, summary: `${archived ? 'Restored' : 'Archived'} client workspace "${client.name}"` });
              if (r.ok) {
                onClose();
                if (!archived && client.id === currentClientId) navigate('/');
              } else setError(r.error ?? '');
            }}
          >
            {archived ? 'Restore workspace' : 'Archive workspace'}
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save profile</Button>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <FormSection title="Identity">
          <TextField label="Client name" required value={c.name} onChange={(v) => set({ name: v })} className="sm:col-span-2" />
          <TextField label="Short name" value={c.shortName} onChange={(v) => set({ shortName: v })} />
          <TextField label="Monogram" value={c.monogram} onChange={(v) => set({ monogram: v })} hint="1–3 letters or numbers" />
          <TextField label="Sector" value={c.sector} onChange={(v) => set({ sector: v })} />
          <TextField label="Client code" value={c.clientCode} onChange={(v) => set({ clientCode: v })} hint="Used to validate project numbers on import." />
          <SelectField label="Status" value={c.status} onChange={(v) => set({ status: v as ClientStatus })} options={Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
        </FormSection>
        <FormSection title="Strategic profile">
          <TextArea label="Summary" rows={4} value={c.summary} onChange={(v) => set({ summary: v })} className="sm:col-span-2" hint="Internal. Not included in client-facing reports." />
          <ListField label="Strategic priorities" value={c.strategicPriorities} onChange={(v) => set({ strategicPriorities: v })} rows={5} className="sm:col-span-2" />
        </FormSection>
      </div>
    </Sheet>
  );
}
