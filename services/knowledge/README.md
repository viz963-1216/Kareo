# Knowledge Service — B-001

## Responsibility

Maintain policy / benefit knowledge separately from Provider data and expose only the currently `PUBLISHED` KnowledgeVersion to formal Assessment behavior.

## Lifecycle

```text
KnowledgeSource
↓
KnowledgeRecord
↓
KnowledgeChange
↓
NEEDS_REVIEW
↓
APPROVED / REJECTED / CONFLICT
↓
KnowledgeVersion
↓
PUBLISHED
↓
Assessment
```

## Core rules

- Provider DB answers `可以找誰？`; Knowledge DB answers `目前制度怎麼規定？`.
- Only `PUBLISHED` KnowledgeVersion may be used by formal Assessment.
- `NEEDS_REVIEW`, `DRAFT`, `APPROVED`, `REJECTED`, `SUPERSEDED`, or `CONFLICT` records are not runtime substitutes for a published version.
- Knowledge changes are reviewable and auditable through old/new hashes and content snapshots.
- Crawler failures preserve the last published version.
- Policy rules must not be silently hard-coded into an AI prompt.

## Planned components

```text
KnowledgeSourceRepository
KnowledgeRecordRepository
KnowledgeVersionRepository
KnowledgeChangeService
PublishedKnowledgeReader
KnowledgeStatusService
```

## Runtime behavior

Assessment loads the current published version and records its identifier on the Assessment / Recommendation context as required by the locked Data Model and API Contract. When required published knowledge is unavailable, backend behavior should map to `KNOWLEDGE_UNAVAILABLE` rather than inventing policy data.

## Test focus

Test published-only reads, version transitions, change detection inputs, rejected/unpublished exclusion, and preservation of the last published version after crawler failure.
