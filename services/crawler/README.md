# Knowledge Crawler — B-001

## Responsibility

Detect changes in approved official long-term-care sources and turn detected changes into reviewable KnowledgeChange records. The crawler never directly publishes policy changes.

## Pipeline

```text
Official Source
↓
Fetch
↓
Normalize content
↓
Raw Snapshot
↓
Content Hash
↓
Compare with prior snapshot
├─ unchanged → record check only
└─ changed   → KnowledgeChange(NEEDS_REVIEW)
                  ↓
               Human/Admin review
                  ↓
               APPROVED
                  ↓
               KnowledgeVersion
                  ↓
               PUBLISHED
```

## Source boundary

The MVP architecture specifies an allow-list of official sources:

- Ministry of Health and Welfare
- 1966 / Long-Term Care official information
- National Laws and Regulations Database
- Taipei City Government
- New Taipei City Government

Crawler adapters should be isolated by source so one site's format does not leak into the domain layer.

## Run record

Each run should persist the locked CrawlerRun fields:

- sourceId
- startedAt
- finishedAt
- status
- itemsChecked
- changesDetected
- errorMessage

Statuses remain `RUNNING`, `SUCCESS`, `PARTIAL`, `FAILED`.

## Failure rule

A failed or partial crawl must not delete or replace the last `PUBLISHED` knowledge. Runtime Assessment continues using the last published version.

## Scheduling

The architecture proposes a daily schedule at `00:10` in `Asia/Taipei`. Scheduler wiring and deployment implementation remain pending Jerry's runtime decision.

## Test focus

Use deterministic fixtures/mocks for unchanged sources, changed sources, malformed source content, partial failure, complete failure, hash stability, and preservation of the last published knowledge version. Live network calls are not required for unit tests.
