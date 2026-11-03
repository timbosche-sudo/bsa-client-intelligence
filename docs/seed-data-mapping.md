# Portfolio seed file → domain model mapping

This document describes the **structure** of the Houston Methodist portfolio seed file (`Houston_Methodist_Portfolio_Seed.json`)
and how it maps to the `Project` model in `src/domain/types.ts`. It deliberately contains **no values** from the file.
The file itself must stay in `private-data/` (git-ignored) and is imported locally in Stage 2.

## File structure

```
{
  client:   { name, client_code }
  source:   { filename, worksheet, extract_method, as_of }
  projects: [ { ...see below } ]          // 5 records, all "potential"
}
```

## Field mapping

| Seed field | Domain field | Rule |
|---|---|---|
| `id` | `provenance.sourceRecordId` | Kept for traceability. **Not** used as the internal ID — a new opaque `id` is generated. |
| `name` | `name` | Preserved exactly, including embedded notes such as cost or phase text and doubled spaces. No parsing in Stage 2. |
| `project_number` | `projectNumber` | Preserved exactly. Used with `clientId` for duplicate detection. |
| `client` | `clientId` | Resolved to the target workspace selected by the user, and checked against the file's `client.name`. A mismatch is a validation error. |
| `studio` | `studio` | Preserved. |
| `principal` | `businessDevelopment.relationshipPrincipalId` and `relationshipPrincipalRaw` | The source uses "Last, First". Match to a Person by normalized name. If there is no unambiguous match, keep the raw text and leave the ID null. |
| `pipeline_probability` | `businessDevelopment.pipelineProbability` | Fraction 0–1, preserved. |
| `discipline_fee_mix.{architecture,engineering,interiors}` | `businessDevelopment.feeMix.*` | Fractions of the BSA fee, preserved. Displayed as percentages. |
| `bsa_fee` | `businessDevelopment.bsaFee` | Preserved. `null` stays `null`, shown as "To Be Confirmed". |
| `revenue_projection_12_periods[]` | `businessDevelopment.revenueProjection.periods[]` | `{index: 1..12, label: null, amount}`; `calendarMapping: 'unresolved'`. No month names are inferred. |
| `portfolio_category` | `categoryId` | Mapped to a configured category ID (`potential`). Unknown values fail validation. |
| `restart_readiness` | `overallReadiness.status` | `not_assessed` maps to `not_assessed`. No other values appear in the file. |
| `project_leader`, `champion` | `delivery.projectExecutiveId`, … | All null in the source, so they stay unassigned. |
| `image` | `coverImageId` | Null. |
| `next_milestone` | — | Null. No milestone is created. |
| `risks` | — | Empty. No risks are created. |
| `notes` | `description` | Empty string preserved. |
| `source_row` | `provenance.sourceRow` | Preserved. |
| `source.filename / worksheet / extract_method / as_of` | `provenance.*` | Applied to every imported record, with `importedAt` and `importedBy`. |
| `client.client_code` | `Client.clientCode` (validation only) | Project numbers begin with the client code. Used as an import sanity check and never overwritten silently. |

## Observations from inspection (to confirm with the data owner)

1. **Revenue projections exceed the BSA fee on two records.** For two projects the 12-period projection sums to more than `bsa_fee`; for two others it sums to less. The basis of the projection (gross vs. weighted, period window, reimbursables) is not stated. Values will be imported unchanged, and the mismatch will be flagged in the import preview rather than reconciled.
2. **Period calendar mapping is unknown.** In every record the first four periods are zero. Labels stay unresolved until a mapping rule is supplied.
3. **One record has a null fee and an all-zero projection.** It is a "various projects" bucket rather than a single project. It will be imported as-is and flagged for review.
4. **Every record has probability 0.5.** This may be a spreadsheet default rather than an assessment. It is preserved but worth confirming.
5. **Project names embed scope or cost notes.** These are preserved verbatim. Structured extraction (e.g. estimated construction cost) would need an explicit transformation rule.
6. **The anticipated large decanting project and "West University" are not in this file.** The Teri Joy restart checklist must not be attached to any seed record until the project identity is confirmed.
