import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { newId } from '@/domain/ids';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { DateField, FieldError, FormSection, ListField, NumberField, SelectField, TextArea, TextField } from '@/components/form/fields';
import { blankProject, findDuplicateProjects, upsertProject } from '@/data/mutations';
import { assignablePeople, type ClientWorkspace } from '@/data/repository';
import type { Project, RevenueProjection } from '@/domain/types';
import { formatCurrency } from '@/lib/format';
import { currentUserName, run } from '@/state/actions';
import { useDataStore } from '@/state/store';

interface Props {
  ws: ClientWorkspace;
  open: boolean;
  onClose(): void;
  projectId: string | null;
  onSaved?(id: string): void;
}

export function validateProject(p: Project, duplicates: Project[]): Record<string, string> {
  const e: Record<string, string> = {};
  const bd = p.businessDevelopment;
  if (!p.name.trim()) e.name = 'Enter the project name.';
  if (duplicates.length) e.projectNumber = `Project number already used by "${duplicates[0].name}" in this client.`;
  if (bd.pipelineProbability !== null && (bd.pipelineProbability < 0 || bd.pipelineProbability > 1)) e.probability = 'Probability must be between 0% and 100%.';
  for (const [k, v] of Object.entries({ bsaFee: bd.bsaFee, cost: bd.estimatedConstructionCost, size: p.size.value })) if (v !== null && v < 0) e[k] = 'Must be zero or more.';
  for (const [k, v] of Object.entries(bd.feeMix)) if (v !== null && (v < 0 || v > 1)) e[`mix.${k}`] = 'Between 0% and 100%.';
  if (bd.anticipatedStart && bd.anticipatedCompletion && bd.anticipatedCompletion < bd.anticipatedStart) e.completion = 'Completion is before start.';
  return e;
}

export function ProjectEditSheet({ ws, open, onClose, projectId, onSaved }: Props) {
  const data = useDataStore((s) => s.data)!;
  const existing = projectId ? ws.projects.find((p) => p.id === projectId) ?? null : null;
  const [draft, setDraft] = useState<Project>(() => structuredClone(existing ?? blankProject(ws.client.id)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const people = useMemo(() => assignablePeople(data, ws.client.id), [data, ws.client.id]);
  const personOpts = people.map((p) => ({ value: p.id, label: p.fullName + (p.affiliation !== 'bsa' ? ` (${p.affiliation === 'client' ? 'client' : 'external'})` : '') }));
  const bsaOpts = people.filter((p) => p.affiliation === 'bsa').map((p) => ({ value: p.id, label: p.fullName }));
  const cats = [...ws.client.config.portfolioCategories].sort((a, b) => a.order - b.order);

  const update = (fn: (p: Project) => void) => {
    setDraft((d) => {
      const n = structuredClone(d);
      fn(n);
      return n;
    });
    setDirty(true);
  };
  const bd = draft.businessDevelopment;
  const dv = draft.delivery;
  const mix = bd.feeMix;
  const mixValues = [mix.architecture, mix.engineering, mix.interiors];
  const mixSum = mixValues.every((v) => v !== null) ? mixValues.reduce((s, v) => s! + v!, 0)! : null;
  const projectionTotal = bd.revenueProjection?.periods.reduce((s, x) => s + (x.amount ?? 0), 0) ?? null;

  const save = () => {
    const clean: Project = {
      ...draft,
      name: draft.name.trim(),
      projectNumber: draft.projectNumber?.trim() || null,
      delivery: { ...draft.delivery, dependencies: draft.delivery.dependencies.map((s) => s.trim()).filter(Boolean), seats: draft.delivery.seats.map((x) => ({ ...x, role: x.role.trim() })).filter((x) => x.role) },
    };
    const dups = findDuplicateProjects(data, ws.client.id, clean.projectNumber, clean.id);
    const errs = validateProject(clean, dups);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const r = run((d) => upsertProject(d, clean, currentUserName()), { clientId: ws.client.id, entity: 'project', entityId: clean.id, summary: `${existing ? 'Updated' : 'Created'} project "${clean.name}"` });
    if (r.ok) {
      onSaved?.(clean.id);
      onClose();
    }
  };

  const setProjection = (proj: RevenueProjection | null) => update((p) => void (p.businessDevelopment.revenueProjection = proj));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      confirmClose={dirty}
      width="xl"
      title={existing ? `Edit ${existing.name}` : 'New project'}
      description={existing?.provenance ? `Imported from ${existing.provenance.sourceFile}. Edits are recorded in project history.` : 'Unknown values can be left blank — they display as To Be Confirmed.'}
      footer={
        <>
          {Object.keys(errors).length > 0 && <span className="mr-auto"><FieldError>Please correct the highlighted fields.</FieldError></span>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{existing ? 'Save changes' : 'Create project'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <FormSection title="Basic information">
          <TextField label="Project name" required value={draft.name} onChange={(v) => update((p) => void (p.name = v))} error={errors.name} className="sm:col-span-2" />
          <TextField label="Project number" value={draft.projectNumber} onChange={(v) => update((p) => void (p.projectNumber = v))} error={errors.projectNumber} hint="Used with the client to detect duplicates on import." />
          <SelectField label="Portfolio category" value={draft.categoryId} onChange={(v) => update((p) => void (p.categoryId = v))} options={cats.map((c) => ({ value: c.id, label: c.label }))} />
          <TextArea label="Description" value={draft.description} onChange={(v) => update((p) => void (p.description = v))} className="sm:col-span-2" />
          <TextField label="Location" value={draft.location} onChange={(v) => update((p) => void (p.location = v || null))} />
          <TextField label="Studio" value={draft.studio} onChange={(v) => update((p) => void (p.studio = v || null))} />
          <TextField label="Project type" value={draft.projectType} onChange={(v) => update((p) => void (p.projectType = v || null))} placeholder="e.g. Ambulatory clinic" />
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <NumberField label="Project size" value={draft.size.value} onChange={(v) => update((p) => void (p.size.value = v))} error={errors.size} min={0} />
            <SelectField label="Unit" value={draft.size.unit} onChange={(v) => update((p) => void (p.size.unit = v as Project['size']['unit']))} options={[{ value: 'sf', label: 'SF' }, { value: 'beds', label: 'Beds' }, { value: 'other', label: 'Other' }]} />
          </div>
        </FormSection>

        <FormSection title="Business development" description="Values are stored exactly as entered. Fractions such as probability and fee mix are shown as percentages.">
          <SelectField label="Relationship principal" value={bd.relationshipPrincipalId} onChange={(v) => update((p) => void (p.businessDevelopment.relationshipPrincipalId = v || null))} placeholder={bd.relationshipPrincipalRaw ? `Unmatched source value: "${bd.relationshipPrincipalRaw}"` : 'To be confirmed'} options={bsaOpts} hint={bd.relationshipPrincipalRaw && !bd.relationshipPrincipalId ? 'The imported name has not been matched to a person record.' : undefined} />
          <SelectField label="Pursuit principal" value={bd.pursuitPrincipalId} onChange={(v) => update((p) => void (p.businessDevelopment.pursuitPrincipalId = v || null))} placeholder="To be confirmed" options={bsaOpts} />
          <NumberField label="Pipeline probability" value={bd.pipelineProbability} onChange={(v) => update((p) => void (p.businessDevelopment.pipelineProbability = v))} scale={100} suffix="%" min={0} max={100} error={errors.probability} />
          <NumberField label="Estimated construction cost" value={bd.estimatedConstructionCost} onChange={(v) => update((p) => void (p.businessDevelopment.estimatedConstructionCost = v))} prefix="$" min={0} error={errors.cost} />
          <NumberField label="BSA fee" value={bd.bsaFee} onChange={(v) => update((p) => void (p.businessDevelopment.bsaFee = v))} prefix="$" min={0} error={errors.bsaFee} />
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <NumberField label="Architecture %" value={mix.architecture} onChange={(v) => update((p) => void (p.businessDevelopment.feeMix.architecture = v))} scale={100} suffix="%" error={errors['mix.architecture']} />
            <NumberField label="Engineering %" value={mix.engineering} onChange={(v) => update((p) => void (p.businessDevelopment.feeMix.engineering = v))} scale={100} suffix="%" error={errors['mix.engineering']} />
            <NumberField label="Interiors %" value={mix.interiors} onChange={(v) => update((p) => void (p.businessDevelopment.feeMix.interiors = v))} scale={100} suffix="%" error={errors['mix.interiors']} />
          </div>
          {mixSum !== null && Math.abs(mixSum - 1) > 0.0001 && <p className="text-xs text-caution sm:col-span-2">Fee mix totals {(mixSum * 100).toFixed(1)}%, not 100%. Saved as entered.</p>}
          <DateField label="Anticipated authorization" value={bd.anticipatedAuthorization} onChange={(v) => update((p) => void (p.businessDevelopment.anticipatedAuthorization = v))} />
          <DateField label="Anticipated start" value={bd.anticipatedStart} onChange={(v) => update((p) => void (p.businessDevelopment.anticipatedStart = v))} />
          <DateField label="Anticipated completion" value={bd.anticipatedCompletion} onChange={(v) => update((p) => void (p.businessDevelopment.anticipatedCompletion = v))} error={errors.completion} />
        </FormSection>

        <fieldset className="border-t border-line-strong pt-5">
          <legend className="sr-only">Revenue projection</legend>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="eyebrow text-ink">Revenue projection</p>
              <p className="text-xs text-subtle">Period labels stay blank until the calendar mapping is confirmed — they are never inferred.</p>
            </div>
            {bd.revenueProjection ? (
              <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => setProjection(null)}>Remove projection</Button>
            ) : (
              <Button size="sm" icon={<Plus size={15} />} onClick={() => setProjection({ periods: Array.from({ length: 12 }, (_, i) => ({ index: i + 1, label: null, amount: null })), calendarMapping: 'unresolved', basisNote: '' })}>
                Add 12-period projection
              </Button>
            )}
          </div>
          {bd.revenueProjection && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {bd.revenueProjection.periods.map((per, i) => (
                  <div key={per.index} className="flex flex-col gap-1.5 rounded-lg border border-line p-2.5">
                    <input
                      aria-label={`Period ${per.index} label`}
                      value={per.label ?? ''}
                      placeholder={`Period ${per.index}`}
                      onChange={(e) => update((p) => void (p.businessDevelopment.revenueProjection!.periods[i].label = e.target.value || null))}
                      className="h-9 w-full rounded border border-transparent bg-transparent px-1 text-xs text-muted outline-none placeholder:text-subtle focus:border-accent"
                    />
                    <input
                      aria-label={`Period ${per.index} amount`}
                      type="number"
                      inputMode="decimal"
                      value={per.amount ?? ''}
                      onChange={(e) => update((p) => void (p.businessDevelopment.revenueProjection!.periods[i].amount = e.target.value === '' ? null : Number(e.target.value)))}
                      className="tabular h-10 w-full rounded border border-line bg-surface px-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Calendar mapping"
                  value={bd.revenueProjection.calendarMapping}
                  onChange={(v) => update((p) => void (p.businessDevelopment.revenueProjection!.calendarMapping = v as 'unresolved' | 'confirmed'))}
                  options={[{ value: 'unresolved', label: 'Unresolved' }, { value: 'confirmed', label: 'Confirmed (labels entered)' }]}
                />
                <TextField label="Basis note" value={bd.revenueProjection.basisNote} onChange={(v) => update((p) => void (p.businessDevelopment.revenueProjection!.basisNote = v))} />
              </div>
              <p className="tabular mt-2 text-xs text-subtle">
                Projection total {formatCurrency(projectionTotal)}
                {bd.bsaFee !== null && projectionTotal !== null && projectionTotal > bd.bsaFee && ' — exceeds the BSA fee; confirm the projection basis.'}
              </p>
            </>
          )}
        </fieldset>

        <FormSection title="Delivery leadership & resources">
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-bold">Leadership seats</p>
            <ul className="flex flex-col gap-2">
              {dv.seats.map((x, i) => (
                <li key={x.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <TextField label="Seat / role" value={x.role} onChange={(v) => update((p) => void (p.delivery.seats[i].role = v))} />
                  <SelectField label="Assigned to" value={x.personId} onChange={(v) => update((p) => void (p.delivery.seats[i].personId = v || null))} placeholder="Unassigned" options={personOpts} />
                  <Button variant="ghost" iconOnly icon={<Trash2 size={16} />} aria-label={`Remove ${x.role || 'seat'}`} onClick={() => update((p) => void p.delivery.seats.splice(i, 1))} />
                </li>
              ))}
            </ul>
            <Button size="sm" className="mt-2" icon={<Plus size={15} />} onClick={() => update((p) => void p.delivery.seats.push({ id: newId('pseat'), role: '', personId: null }))}>
              Add seat
            </Button>
          </div>
          <TextArea label="Team assignments & resource commitments" value={dv.resourceNotes} onChange={(v) => update((p) => void (p.delivery.resourceNotes = v))} rows={4} className="sm:col-span-2" />
          <ListField label="Dependencies" value={dv.dependencies} onChange={(v) => update((p) => void (p.delivery.dependencies = v))} className="sm:col-span-2" />
        </FormSection>
      </div>
    </Sheet>
  );
}
