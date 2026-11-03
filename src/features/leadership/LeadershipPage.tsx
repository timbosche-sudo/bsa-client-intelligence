import { Mail, Phone } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StageNotice } from '@/components/ui/StageNotice';
import { active, personName } from '@/data/repository';
import { useRequiredWorkspace } from '@/state/useWorkspace';

export function LeadershipPage() {
  const ws = useRequiredWorkspace();
  const tiers = [...ws.client.config.leadershipTiers].sort((a, b) => a.order - b.order);
  const seats = active(ws.seats);
  const members = active(ws.memberships);

  return (
    <>
      <PageHeader eyebrow={ws.client.name} title="Leadership" description="Who is accountable for the relationship, the portfolio and each project. Roles remain unassigned until confirmed." />
      <StageNotice stage={2} className="mb-6">
        People directory editing, headshot upload and configurable leadership structure.
      </StageNotice>

      <section aria-labelledby="structure" className="mb-10">
        <h2 id="structure" className="mb-4 text-lg font-semibold tracking-tight">Leadership structure</h2>
        <ol className="relative flex flex-col gap-3 before:absolute before:bottom-6 before:left-[19px] before:top-6 before:w-px before:bg-line md:before:left-[23px]">
          {tiers.map((t, i) => {
            const tierMembers = members.filter((m) => m.tierId === t.id);
            const openSeats = seats.filter((s) => s.tierId === t.id && !s.membershipId);
            return (
              <li key={t.id} className="relative flex gap-4">
                <span className="tabular relative z-10 mt-4 flex size-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-xs font-semibold text-accent md:size-12">
                  {i + 1}
                </span>
                <Card className="flex-1 p-4 sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 className="font-semibold">{t.label}</h3>
                    <p className="text-xs text-subtle">{tierMembers.length} confirmed · {openSeats.length} open</p>
                  </div>
                  <p className="mt-1 text-sm text-muted">{t.description}</p>
                  {(tierMembers.length > 0 || openSeats.length > 0) && (
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {tierMembers.map((m) => {
                        const name = personName(ws, m.personId);
                        return (
                          <li key={m.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-3">
                            <Avatar name={name} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{name}</p>
                              <p className="truncate text-xs text-subtle">{m.role}</p>
                            </div>
                            {m.confirmed && <Badge tone="accent" className="ml-auto">Confirmed</Badge>}
                          </li>
                        );
                      })}
                      {openSeats.map((s) => (
                        <li key={s.id} className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong p-3">
                          <Avatar name={null} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-muted">{s.role}</p>
                            <p className="truncate text-xs text-subtle">Unassigned — {s.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="people">
        <h2 id="people" className="mb-4 text-lg font-semibold tracking-tight">People in this workspace</h2>
        {ws.people.length === 0 ? (
          <Card>
            <EmptyState title="No people recorded for this client" />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ws.people.map((p) => (
              <Card key={p.id} className="flex gap-4 p-4">
                <Avatar name={p.fullName} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{p.fullName}</p>
                    <Badge tone={p.affiliation === 'bsa' ? 'accent' : 'outline'}>{p.affiliation === 'bsa' ? 'BSA' : p.affiliation === 'client' ? 'Client contact' : 'External'}</Badge>
                  </div>
                  <p className="text-sm text-muted">{[p.title, p.studio && `${p.studio} studio`].filter(Boolean).join(' · ')}</p>
                  <p className="text-xs text-subtle">{p.organization}</p>
                  <div className="mt-2 flex flex-col gap-1 text-xs text-subtle">
                    <span className="flex items-center gap-1.5"><Mail size={12} aria-hidden /> {p.email ?? 'Email not recorded'}</span>
                    <span className="flex items-center gap-1.5"><Phone size={12} aria-hidden /> {p.phone ?? 'Phone not recorded'}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
