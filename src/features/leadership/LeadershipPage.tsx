import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Pencil, Phone, Plus, Search, Settings2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PersonAvatar } from '@/components/PersonAvatar';
import { assignablePeople, type ClientWorkspace } from '@/data/repository';
import type { Person } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useDataStore } from '@/state/store';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { PersonSheet } from './PersonSheet';
import { ClientLeadsSheet, MemberSheet, SeatSheet, StructureSheet } from './TeamSheets';

type SheetState =
  | { kind: 'person'; id: string | null }
  | { kind: 'member'; id: string | null; tierId?: string }
  | { kind: 'seat'; id: string | null; tierId?: string }
  | { kind: 'structure' }
  | { kind: 'leads' }
  | null;

const AFFILIATION_LABEL = { bsa: 'BSA', client: 'Client contact', external: 'External' } as const;

export function LeadershipPage() {
  const ws = useRequiredWorkspace();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [nonce, setNonce] = useState(0);
  const open = (s: SheetState) => {
    setNonce((n) => n + 1);
    setSheet(s);
  };
  const close = () => setSheet(null);
  const [scope, setScope] = useState<'workspace' | 'all'>('workspace');
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('newPerson') === '1') {
      open({ kind: 'person', id: null });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  return (
    <>
      <PageHeader
        eyebrow={ws.client.name}
        title="Leadership"
        description="Who is accountable for the relationship, the portfolio and each project. Roles stay unassigned until confirmed."
        actions={
          <>
            <Button icon={<Settings2 size={16} />} onClick={() => open({ kind: 'structure' })}>Edit structure</Button>
            <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => open({ kind: 'member', id: null })}>Add to team</Button>
          </>
        }
      />

      <ClientLeads ws={ws} onEdit={() => open({ kind: 'leads' })} />
      <Structure ws={ws} onOpen={open} />
      <Directory ws={ws} scope={scope} setScope={setScope} onOpenPerson={(id) => open({ kind: 'person', id })} />

      {sheet?.kind === 'person' && (
        <PersonSheet
          key={nonce}
          open
          onClose={close}
          personId={sheet.id}
          clientId={ws.client.id}
          clientName={ws.client.name}
          // A new person isn't part of this workspace until assigned a role, so show the full directory.
          onCreated={(p) => !ws.people.some((x) => x.id === p.id) && setScope('all')}
        />
      )}
      {sheet?.kind === 'member' && <MemberSheet key={nonce} open onClose={close} ws={ws} membershipId={sheet.id} presetTierId={sheet.tierId} />}
      {sheet?.kind === 'seat' && <SeatSheet key={nonce} open onClose={close} ws={ws} seatId={sheet.id} presetTierId={sheet.tierId} />}
      {sheet?.kind === 'structure' && <StructureSheet key={nonce} open onClose={close} ws={ws} />}
      {sheet?.kind === 'leads' && <ClientLeadsSheet key={nonce} open onClose={close} ws={ws} />}
    </>
  );
}

function ClientLeads({ ws, onEdit }: { ws: ClientWorkspace; onEdit(): void }) {
  const lead = ws.people.find((p) => p.id === ws.client.relationshipLeadId);
  const sponsor = ws.people.find((p) => p.id === ws.client.executiveSponsorId);
  return (
    <Card className="mb-8 flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
      {[
        { label: 'Relationship lead', person: lead, empty: 'Unassigned' },
        { label: 'Executive sponsor', person: sponsor, empty: 'Not yet assigned' },
      ].map(({ label, person, empty }) => (
        <div key={label} className="flex flex-1 items-center gap-3">
          <PersonAvatar person={person} size="lg" />
          <div>
            <p className="eyebrow">{label}</p>
            <p className={cn('font-bold', !person && 'font-normal text-subtle')}>{person?.fullName ?? empty}</p>
            {person && <p className="text-xs text-subtle">{[person.title, person.studio].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>
      ))}
      <Button size="sm" icon={<Pencil size={15} />} onClick={onEdit} className="self-start sm:self-center">
        Edit
      </Button>
    </Card>
  );
}

function Structure({ ws, onOpen }: { ws: ClientWorkspace; onOpen(s: SheetState): void }) {
  const tiers = [...ws.client.config.leadershipTiers].sort((a, b) => a.order - b.order);
  const members = ws.memberships.filter((m) => !m.archivedAt);
  const seats = ws.seats.filter((s) => !s.archivedAt);
  const person = (id: string) => ws.people.find((p) => p.id === id);

  return (
    <section aria-labelledby="structure" className="mb-12">
      <div className="mb-4 flex items-center gap-3">
        <h2 id="structure" className="text-lg font-black tracking-tight">Leadership structure</h2>
        <span className="h-px flex-1 bg-line-strong" aria-hidden />
      </div>
      <ol className="relative flex flex-col gap-3 before:absolute before:bottom-8 before:left-[19px] before:top-8 before:w-px before:bg-line-strong md:before:left-[23px]">
        {tiers.map((t, i) => {
          const tierMembers = members.filter((m) => m.tierId === t.id);
          const openSeats = seats.filter((s) => s.tierId === t.id && !s.membershipId);
          const seatOf = (memberId: string) => seats.find((s) => s.membershipId === memberId);
          return (
            <li key={t.id} className="relative flex gap-3 md:gap-4">
              <span className="tabular relative z-10 mt-4 flex size-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-bg text-sm font-black md:size-12">{i + 1}</span>
              <Card className="min-w-0 flex-1 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black tracking-tight">{t.label}</h3>
                    <p className="mt-0.5 text-sm text-muted">{t.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => onOpen({ kind: 'seat', id: null, tierId: t.id })}>Seat</Button>
                    <Button size="sm" variant="ghost" icon={<UserPlus size={15} />} onClick={() => onOpen({ kind: 'member', id: null, tierId: t.id })}>Member</Button>
                  </div>
                </div>
                {tierMembers.length + openSeats.length > 0 ? (
                  <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                    {tierMembers.map((m) => {
                      const p = person(m.personId);
                      const seat = seatOf(m.id);
                      return (
                        <li key={m.id}>
                          <button type="button" onClick={() => onOpen({ kind: 'member', id: m.id })} className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-line bg-surface-2 p-3 text-left transition-colors hover:border-line-strong">
                            <PersonAvatar person={p} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold">{p?.fullName ?? 'Unknown person'}</p>
                              <p className="truncate text-xs text-subtle">{m.role}{seat && seat.role !== m.role ? ` · ${seat.role}` : ''}</p>
                            </div>
                            <Badge tone={m.confirmed ? 'accent' : 'outline'}>{m.confirmed ? 'Confirmed' : 'Proposed'}</Badge>
                          </button>
                        </li>
                      );
                    })}
                    {openSeats.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => onOpen({ kind: 'seat', id: s.id })} className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-dashed border-line-strong p-3 text-left transition-colors hover:bg-surface-2">
                          <PersonAvatar person={null} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-muted">{s.role}</p>
                            <p className="truncate text-xs text-subtle">Unassigned{s.description ? ` — ${s.description}` : ''}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-subtle">No members or seats in this tier.</p>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Directory({ ws, scope, setScope, onOpenPerson }: { ws: ClientWorkspace; scope: 'workspace' | 'all'; setScope(s: 'workspace' | 'all'): void; onOpenPerson(id: string | null): void }) {
  const data = useDataStore((s) => s.data)!;
  const [q, setQ] = useState('');
  const [affiliation, setAffiliation] = useState<'all' | Person['affiliation']>('all');
  const [showArchived, setShowArchived] = useState(false);

  const roles = (personId: string) => ws.memberships.filter((m) => m.personId === personId && !m.archivedAt).map((m) => m.role);

  const people = useMemo(() => {
    const pool = scope === 'workspace' ? data.people.filter((p) => ws.people.some((w) => w.id === p.id)) : data.people.filter((p) => p.homeClientId === null || p.homeClientId === ws.client.id);
    const needle = q.trim().toLowerCase();
    return pool
      .filter((p) => showArchived || !p.archivedAt)
      .filter((p) => affiliation === 'all' || p.affiliation === affiliation)
      .filter((p) => !needle || [p.fullName, p.title, p.studio, p.organization, p.discipline].some((f) => f?.toLowerCase().includes(needle)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [data.people, ws, scope, q, affiliation, showArchived]);

  const totalAvailable = assignablePeople(data, ws.client.id).length;

  return (
    <section aria-labelledby="people">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 id="people" className="text-lg font-black tracking-tight">People</h2>
        <span className="h-px flex-1 bg-line-strong" aria-hidden />
        <Button size="sm" icon={<UserPlus size={15} />} onClick={() => onOpenPerson(null)}>New person</Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div role="group" aria-label="Directory scope" className="flex shrink-0 rounded-lg border border-line p-0.5 text-sm">
          {[
            { v: 'workspace' as const, l: `This workspace (${ws.people.length})` },
            { v: 'all' as const, l: `All available (${totalAvailable})` },
          ].map((o) => (
            <button key={o.v} type="button" aria-pressed={scope === o.v} onClick={() => setScope(o.v)} className={cn('h-10 flex-1 rounded-md px-3 whitespace-nowrap', scope === o.v ? 'bg-surface-3 font-bold text-ink' : 'text-subtle hover:text-ink')}>
              {o.l}
            </button>
          ))}
        </div>
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-accent lg:min-w-[14rem]">
          <Search size={16} className="text-subtle" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, title, studio…" aria-label="Search people" className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-subtle sm:text-sm" />
        </label>
        <div className="flex gap-2">
          <select value={affiliation} onChange={(e) => setAffiliation(e.target.value as typeof affiliation)} aria-label="Affiliation" className="h-11 rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="all">All affiliations</option>
            <option value="bsa">BSA</option>
            <option value="client">Client contacts</option>
            <option value="external">External</option>
          </select>
          <label className="flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Archived
          </label>
        </div>
      </div>

      {people.length === 0 ? (
        <Card>
          <EmptyState title={q || affiliation !== 'all' ? 'No people match these filters' : 'No people yet'} action={<Button size="sm" variant="primary" onClick={() => onOpenPerson(null)}>Add a person</Button>} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => {
            const r = roles(p.id);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onOpenPerson(p.id)} className={cn('flex h-full w-full gap-4 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong', p.archivedAt && 'opacity-60')}>
                  <PersonAvatar person={p} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold">{p.fullName}</p>
                      <Badge tone={p.affiliation === 'bsa' ? 'neutral' : 'outline'}>{AFFILIATION_LABEL[p.affiliation]}</Badge>
                    </div>
                    <p className="text-sm text-muted">{[p.title, p.studio && `${p.studio}`].filter(Boolean).join(' · ') || 'Title not recorded'}</p>
                    {r.length > 0 && <p className="mt-1 text-xs text-accent">{r.join(' · ')}</p>}
                    <div className="mt-2 flex flex-col gap-1 text-xs text-subtle">
                      <span className="flex items-center gap-1.5"><Mail size={12} aria-hidden /> {p.email ?? 'Email not recorded'}</span>
                      <span className="flex items-center gap-1.5"><Phone size={12} aria-hidden /> {p.phone ?? 'Phone not recorded'}</span>
                    </div>
                    {(p.archivedAt || !p.active) && <p className="mt-2 text-xs font-bold text-muted">{p.archivedAt ? 'Archived' : 'Inactive'}</p>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
