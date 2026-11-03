import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, FormSection, ListField, SelectField, TextArea, TextField, Toggle } from '@/components/form/fields';
import {
  addMembership,
  blankSeat,
  removeMembership,
  removeSeat,
  setClientLeadership,
  updateLeadershipTiers,
  updateMembership,
  upsertSeat,
} from '@/data/mutations';
import { assignablePeople, type ClientWorkspace } from '@/data/repository';
import { newId } from '@/domain/ids';
import type { LeadershipTierDef } from '@/domain/types';
import { run } from '@/state/actions';
import { useDataStore } from '@/state/store';
import { PersonSheet } from './PersonSheet';

const clean = (xs: string[]) => xs.map((s) => s.trim()).filter(Boolean);

/* ───────────────────────── Membership ───────────────────────── */

export function MemberSheet({ ws, open, onClose, membershipId, presetTierId }: { ws: ClientWorkspace; open: boolean; onClose(): void; membershipId: string | null; presetTierId?: string }) {
  const data = useDataStore((s) => s.data)!;
  const existing = membershipId ? ws.memberships.find((m) => m.id === membershipId) ?? null : null;
  const tiers = [...ws.client.config.leadershipTiers].sort((a, b) => a.order - b.order);
  const [personId, setPersonId] = useState(existing?.personId ?? '');
  const [tierId, setTierId] = useState(existing?.tierId ?? presetTierId ?? tiers[0]?.id ?? '');
  const [role, setRole] = useState(existing?.role ?? '');
  const [responsibilities, setResponsibilities] = useState<string[]>(existing?.responsibilities ?? []);
  const [confirmed, setConfirmed] = useState(existing?.confirmed ?? false);
  const currentSeat = existing ? ws.seats.find((s) => s.membershipId === existing.id) : undefined;
  const [seatId, setSeatId] = useState(currentSeat?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const people = useMemo(() => assignablePeople(data, ws.client.id).filter((p) => p.active || p.id === personId), [data, ws.client.id, personId]);
  const openSeats = ws.seats.filter((s) => !s.archivedAt && s.tierId === tierId && (!s.membershipId || s.id === currentSeat?.id));

  const save = () => {
    const errs: Record<string, string> = {};
    if (!personId) errs.person = 'Choose a person, or add a new one.';
    if (!role.trim()) errs.role = 'Describe this person’s role on the Client Team.';
    if (!tierId) errs.tier = 'Choose a leadership tier.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const person = data.people.find((p) => p.id === personId)!;
    const r = run(
      (d) => {
        let id = existing?.id;
        if (existing) updateMembership(d, { ...existing, personId, tierId, role: role.trim(), responsibilities: clean(responsibilities), confirmed });
        else id = addMembership(d, { clientId: ws.client.id, personId, tierId, role: role.trim(), responsibilities: clean(responsibilities), confirmed }).id;
        // Seat assignment: vacate previous seat, fill the chosen one.
        d.seats.forEach((s) => {
          if (s.membershipId === id && s.id !== seatId) upsertSeat(d, { ...s, membershipId: null });
        });
        const seat = d.seats.find((s) => s.id === seatId);
        if (seat) upsertSeat(d, { ...seat, membershipId: id! });
      },
      { clientId: ws.client.id, entity: 'membership', entityId: existing?.id ?? null, summary: `${existing ? 'Updated' : 'Added'} ${person.fullName} as ${role.trim()}` },
    );
    if (r.ok) onClose();
  };

  const remove = () => {
    if (!existing) return;
    const name = data.people.find((p) => p.id === existing.personId)?.fullName ?? 'Member';
    const r = run((d) => removeMembership(d, existing.id), { clientId: ws.client.id, entity: 'membership', entityId: existing.id, summary: `Removed ${name} (${existing.role}) from the Client Team` });
    if (r.ok) {
      setConfirmRemove(false);
      onClose();
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        width="md"
        title={existing ? 'Edit team role' : 'Add to Client Team'}
        description={`${ws.client.name} Client Team`}
        footer={
          <>
            {existing && (
              <Button variant="ghost" size="sm" className="mr-auto" icon={<Trash2 size={15} />} onClick={() => setConfirmRemove(true)}>
                Remove from team
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save}>{existing ? 'Save' : 'Add to team'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <SelectField
              label="Person"
              required
              value={personId}
              onChange={setPersonId}
              placeholder="Select a person…"
              options={people.map((p) => ({ value: p.id, label: `${p.fullName}${p.title ? ` — ${p.title}` : ''}${p.affiliation === 'client' ? ' (client)' : p.affiliation === 'external' ? ' (external)' : ''}` }))}
              error={errors.person}
            />
            <Button size="sm" variant="ghost" className="self-start" icon={<UserPlus size={15} />} onClick={() => setCreatingPerson(true)}>
              New person
            </Button>
          </div>
          <SelectField label="Leadership tier" required value={tierId} onChange={(v) => (setTierId(v), setSeatId(''))} options={tiers.map((t) => ({ value: t.id, label: t.label }))} error={errors.tier} />
          <TextField label="Role on the Client Team" required value={role} onChange={setRole} placeholder="e.g. Portfolio Delivery Lead" error={errors.role} />
          <SelectField
            label="Fills leadership seat"
            value={seatId}
            onChange={setSeatId}
            placeholder="No seat"
            options={openSeats.map((s) => ({ value: s.id, label: s.role }))}
            hint={openSeats.length ? 'Optional — links this person to an open seat in the tier.' : 'No open seats in this tier.'}
          />
          <ListField label="Responsibilities" value={responsibilities} onChange={setResponsibilities} />
          <Toggle label="Confirmed" description="Only mark confirmed once leadership has agreed. Unconfirmed roles show as proposed." checked={confirmed} onChange={setConfirmed} />
        </div>
      </Sheet>
      {creatingPerson && (
        <PersonSheet
          open
          onClose={() => setCreatingPerson(false)}
          personId={null}
          clientId={ws.client.id}
          clientName={ws.client.name}
          onCreated={(p) => setPersonId(p.id)}
        />
      )}
      <ConfirmDialog open={confirmRemove} title="Remove from Client Team?" confirmLabel="Remove" tone="danger" onClose={() => setConfirmRemove(false)} onConfirm={remove}>
        The person record is kept. Any seat they filled becomes unassigned.
      </ConfirmDialog>
    </>
  );
}

/* ───────────────────────── Seat ───────────────────────── */

export function SeatSheet({ ws, open, onClose, seatId, presetTierId }: { ws: ClientWorkspace; open: boolean; onClose(): void; seatId: string | null; presetTierId?: string }) {
  const tiers = [...ws.client.config.leadershipTiers].sort((a, b) => a.order - b.order);
  const existing = seatId ? ws.seats.find((s) => s.id === seatId) ?? null : null;
  const [seat, setSeat] = useState(() => existing ?? blankSeat(ws.client.id, presetTierId ?? tiers[0]?.id ?? ''));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const members = ws.memberships.filter((m) => !m.archivedAt);
  const name = (personId: string) => ws.people.find((p) => p.id === personId)?.fullName ?? 'Unknown';

  const save = () => {
    if (!seat.role.trim()) return setError('Name this seat, e.g. "Executive Sponsor".');
    const r = run((d) => upsertSeat(d, { ...seat, role: seat.role.trim() }), { clientId: ws.client.id, entity: 'seat', entityId: seat.id, summary: `${existing ? 'Updated' : 'Added'} leadership seat "${seat.role.trim()}"` });
    if (r.ok) onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        width="md"
        title={existing ? 'Edit leadership seat' : 'Add leadership seat'}
        description="Seats describe roles the structure needs, whether or not someone is confirmed."
        footer={
          <>
            {existing && (
              <Button variant="ghost" size="sm" className="mr-auto" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>
                Delete seat
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save}>Save</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Seat / role" required value={seat.role} onChange={(v) => setSeat({ ...seat, role: v })} error={error} />
          <TextArea label="Description" value={seat.description} onChange={(v) => setSeat({ ...seat, description: v })} rows={3} />
          <SelectField label="Leadership tier" value={seat.tierId} onChange={(v) => setSeat({ ...seat, tierId: v })} options={tiers.map((t) => ({ value: t.id, label: t.label }))} />
          <SelectField
            label="Assigned to"
            value={seat.membershipId ?? ''}
            onChange={(v) => setSeat({ ...seat, membershipId: v || null })}
            placeholder="Unassigned"
            options={members.map((m) => ({ value: m.id, label: `${name(m.personId)} — ${m.role}` }))}
            hint="Add people to the Client Team first to assign them here."
          />
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this seat?"
        confirmLabel="Delete seat"
        tone="danger"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          const r = run((d) => removeSeat(d, seat.id), { clientId: ws.client.id, entity: 'seat', entityId: seat.id, summary: `Deleted leadership seat "${seat.role}"` });
          if (r.ok) {
            setConfirmDelete(false);
            onClose();
          }
        }}
      >
        The seat is removed from the structure. Team memberships are not affected.
      </ConfirmDialog>
    </>
  );
}

/* ───────────────────────── Structure (tiers) ───────────────────────── */

export function StructureSheet({ ws, open, onClose }: { ws: ClientWorkspace; open: boolean; onClose(): void }) {
  const [tiers, setTiers] = useState<LeadershipTierDef[]>(() => [...ws.client.config.leadershipTiers].sort((a, b) => a.order - b.order));
  const [error, setError] = useState('');
  const usage = (id: string) => ws.memberships.filter((m) => m.tierId === id).length + ws.seats.filter((s) => s.tierId === id).length;
  const move = (i: number, delta: number) => {
    const next = [...tiers];
    const [t] = next.splice(i, 1);
    next.splice(i + delta, 0, t);
    setTiers(next);
  };
  const save = () => {
    const r = run((d) => updateLeadershipTiers(d, ws.client.id, tiers), { clientId: ws.client.id, entity: 'client', entityId: ws.client.id, summary: 'Updated leadership structure' });
    if (r.ok) onClose();
    else setError(r.error ?? '');
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Leadership structure"
      description={`Tiers for the ${ws.client.name} Client Team, top to bottom.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save structure</Button>
        </>
      }
    >
      <ol className="flex flex-col gap-3">
        {tiers.map((t, i) => {
          const used = usage(t.id);
          return (
            <li key={t.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="tabular flex size-8 items-center justify-center rounded-full border border-line-strong text-xs font-bold">{i + 1}</span>
                <span className="flex-1 text-xs text-subtle">{used ? `${used} member(s)/seat(s)` : 'Empty'}</span>
                <Button size="sm" variant="ghost" iconOnly icon={<ArrowUp size={16} />} aria-label={`Move ${t.label} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                <Button size="sm" variant="ghost" iconOnly icon={<ArrowDown size={16} />} aria-label={`Move ${t.label} down`} disabled={i === tiers.length - 1} onClick={() => move(i, 1)} />
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={<Trash2 size={16} />}
                  aria-label={`Remove ${t.label}`}
                  disabled={used > 0}
                  title={used ? 'Move or remove its members and seats first' : undefined}
                  onClick={() => setTiers(tiers.filter((x) => x.id !== t.id))}
                />
              </div>
              <div className="grid gap-3">
                <TextField label="Tier name" required value={t.label} onChange={(v) => setTiers(tiers.map((x) => (x.id === t.id ? { ...x, label: v } : x)))} />
                <TextArea label="Description" rows={2} value={t.description} onChange={(v) => setTiers(tiers.map((x) => (x.id === t.id ? { ...x, description: v } : x)))} />
              </div>
            </li>
          );
        })}
      </ol>
      <Button className="mt-4" icon={<Plus size={16} />} onClick={() => setTiers([...tiers, { id: newId('tier'), label: 'New tier', description: '', order: tiers.length + 1 }])}>
        Add tier
      </Button>
      {error && (
        <div className="mt-4">
          <FieldError>{error}</FieldError>
        </div>
      )}
    </Sheet>
  );
}

/* ───────────────────────── Client-level leads ───────────────────────── */

export function ClientLeadsSheet({ ws, open, onClose }: { ws: ClientWorkspace; open: boolean; onClose(): void }) {
  const data = useDataStore((s) => s.data)!;
  const [lead, setLead] = useState(ws.client.relationshipLeadId ?? '');
  const [sponsor, setSponsor] = useState(ws.client.executiveSponsorId ?? '');
  const bsa = assignablePeople(data, ws.client.id).filter((p) => p.affiliation === 'bsa' && (p.active || p.id === lead || p.id === sponsor));
  const save = () => {
    const r = run((d) => setClientLeadership(d, ws.client.id, { relationshipLeadId: lead || null, executiveSponsorId: sponsor || null }), {
      clientId: ws.client.id,
      entity: 'client',
      entityId: ws.client.id,
      summary: 'Updated relationship lead / executive sponsor',
    });
    if (r.ok) onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="md"
      title="Client leadership"
      description="Shown on the Client Overview. Leave unassigned until confirmed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </>
      }
    >
      <FormSection title="Accountable leaders">
        <SelectField label="Relationship lead" value={lead} onChange={setLead} placeholder="Unassigned" options={bsa.map((p) => ({ value: p.id, label: p.fullName }))} className="sm:col-span-2" />
        <SelectField label="Executive sponsor" value={sponsor} onChange={setSponsor} placeholder="Not yet assigned" options={bsa.map((p) => ({ value: p.id, label: p.fullName }))} className="sm:col-span-2" hint="Only BSA personnel are listed." />
      </FormSection>
    </Sheet>
  );
}
