# Kareo Backend Implementation Plan — B-001

Status: PROPOSAL / B-001  
Owner: Engineer B  
Scope: Backend foundation planning only

> This document translates the locked Product Spec, Architecture, Data Model, and API Contract into an implementation blueprint. It does not change those specifications.

## 1. Goals and boundaries

The backend is responsible for the API, persistence, Provider access, Recommendation Engine, Lead handling, Knowledge Database, and Knowledge Crawler. Frontend integration is intentionally out of scope for this task; the only integration boundary is the locked API Contract.

Allowed paths for B-001:
- `/apps/api/**`
- `/services/recommendation/**`
- `/services/knowledge/**`
- `/services/crawler/**`

This task does not install a framework, change root configuration, create production database configuration, or modify any Spec / Contract / Schema file.

## 2. Proposed module layout

```text
/apps/api/
├── IMPLEMENTATION_PLAN.md
├── src/
│   ├── routes/              # HTTP endpoint adapters; contract-shaped request/response
│   ├── controllers/         # Request orchestration; no business rules
│   ├── services/            # Application use-cases
│   ├── repositories/        # Persistence abstractions
│   ├── domain/              # Domain types / invariants mapped from locked model
│   ├── adapters/            # AI, database, clock, hashing, external clients
│   ├── validation/          # Input validation at API boundary
│   └── errors/              # Stable error mapping to contract error codes
└── tests/

/services/recommendation/
├── README.md
└── src/                     # Future implementation owned by B

/services/knowledge/
├── README.md
└── src/                     # Future implementation owned by B

/services/crawler/
├── README.md
└── src/                     # Future implementation owned by B
```

The exact framework-specific file layout should be finalized only after Jerry approves the Backend stack.

## 3. Backend module responsibilities

### Session
Create and persist anonymous sessions. Session ID is the primary MVP workflow identifier.

### Consent
Persist disclaimer/privacy/terms versions and acceptance time. Assessment execution must be blocked when valid consent is absent; the API returns `CONSENT_REQUIRED`.

### Assessment
Validate the assessment request, persist assessment inputs, resolve the current `PUBLISHED` Knowledge Version, and produce a CareNeedProfile. AI may help interpret free text, but final Provider selection is never delegated to the LLM.

### Provider
Expose Provider detail and lookup capabilities backed by Provider DB. Provider eligibility starts from `ACTIVE` providers and uses ProviderService / ProviderServiceArea for service and geographic matching. Provider address and service area remain separate.

### Recommendation
Run deterministic recommendation logic against Provider DB. Persist RecommendationRun and RecommendationItem so results are auditable and reproducible.

### Lead
Validate that a Lead references session/assessment/provider/service, then persist contact data with status `NEW`. Future statuses remain the locked set: `NEW`, `CONTACTED`, `ACCEPTED`, `CLOSED`, `CANCELLED`.

### Knowledge
Read only `PUBLISHED` KnowledgeVersion data for production Assessment behavior. Maintain source, record, change, and version lifecycles separately from Provider data.

### Crawler
Fetch only whitelisted official sources, store raw snapshots, calculate content hashes, compare against prior snapshots, and create KnowledgeChange records when content changes. A failed run must never delete or invalidate the last published knowledge version.

### External Service
Return the configured Kareocar external link. MVP behavior is link-out only; no iframe, shared auth, shared backend, or shared database.

## 4. Data flow

### Assessment flow
```text
POST /assessments
        ↓
API validation
        ↓
Consent check
        ↓
Assessment persistence
        ├── load PUBLISHED KnowledgeVersion
        └── Assessment Service
              ├── deterministic inputs / rules
              └── optional AI Adapter for free-text interpretation
                        ↓
                CareNeedProfile
                        ↓
                Contract-shaped response
```

### Recommendation flow
```text
POST /recommendations
        ↓
Load Assessment + CareNeedProfile
        ↓
Resolve serviceType
        ↓
Provider eligibility filter
        ├── active-provider filter
        ├── service match
        └── service-area match
        ↓
Ranking Strategy
        ├── exact/GPS → distance ranking
        ├── district  → stable rotation
        ├── city      → stable rotation
        └── no location → no-location result
        ↓
Top 3 max
        ↓
Persist RecommendationRun / Items
        ↓
Contract-shaped response
```

### Lead flow
```text
POST /leads
   ↓
Validate session / assessment / provider / service
   ↓
Persist Lead(status=NEW)
   ↓
Return leadId + status + createdAt
```

### Knowledge flow
```text
Official Source
   ↓
Crawler
   ↓
Raw Snapshot
   ↓
Content Hash
   ↓
Compare
   ↓
KnowledgeChange
   ↓
NEEDS_REVIEW
   ↓
Jerry / Admin Review
   ↓
APPROVED
   ↓
KnowledgeVersion
   ↓
PUBLISHED
```

## 5. API Contract mapping

The HTTP layer must implement the locked `/api/v1` contract without changing endpoint names, field names, enum values, or response structure.

| Contract endpoint | Backend responsibility |
|---|---|
| `POST /api/v1/session` | Session service + repository |
| `POST /api/v1/consent` | Consent service + repository |
| `POST /api/v1/assessments` | Assessment service + published Knowledge lookup + optional AI adapter |
| `POST /api/v1/recommendations` | Recommendation service + Provider repository |
| `GET /api/v1/providers/{providerId}` | Provider service |
| `GET /api/v1/external-services/transportation` | ExternalService service/config adapter |
| `POST /api/v1/leads` | Lead service + repository |
| `GET /api/v1/knowledge/status` | Knowledge service |

Success envelope:
```json
{ "success": true, "data": {} }
```

Error envelope:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "..."
  }
}
```

Backend error mapping must stay within the locked MVP error-code set unless Jerry approves a Contract change.

## 6. Recommendation processing rules

### Eligibility
1. Select `ACTIVE` providers.
2. Match requested `serviceType` through ProviderService.
3. Match assessment location against ProviderServiceArea.
4. Apply the relevant ranking strategy only after eligibility filtering.

### Exact / GPS location
Use `DISTANCE` ranking. Compute provider distance from the user location and return at most three eligible providers ordered by distance.

### District location
Use `DISTRICT_ROTATION`. Never claim these are the nearest providers. Use a deterministic seed based on the locked concept `sessionId + district + date`; exact hashing implementation can be selected during implementation.

### City-only location
Use `CITY_ROTATION` with the same deterministic principle, using city context.

### No location
Use `NO_LOCATION`. Assessment may still complete, but the recommendation response must not claim nearby providers.

### Empty and explainability
Zero eligible providers is a successful response with `providers: []`, not a system error. Each returned item must contain human-readable `reasons`; score alone is never the user-facing explanation.

### Transportation
`TRANSPORTATION` does not use Provider recommendation. It routes to the Kareocar external-service flow.

## 7. Persistence strategy

The locked Data Model is the source of truth for entities, fields, relationships, and enums. A relational database is recommended because the domain has strong transactional relationships, versioned knowledge, and auditable recommendation records.

Logical boundaries:
```text
Session / Consent / Assessment / CareNeedProfile
Provider / ProviderService / ProviderServiceArea
RecommendationRun / RecommendationItem
Lead
KnowledgeSource / KnowledgeRecord / KnowledgeVersion / KnowledgeChange / CrawlerRun
ExternalService
```

Repository abstractions should keep persistence details out of application services. Migrations and production database configuration are deferred because this task is planning-only and schema/config changes require Jerry's approval.

## 8. Knowledge design

Knowledge DB and Provider DB remain separate because they answer different questions:

- Provider DB: `可以找誰？`
- Knowledge DB: `目前制度怎麼規定？`

Assessment must resolve a `PUBLISHED` KnowledgeVersion before using knowledge-driven policy information. The runtime must not silently use unpublished or `NEEDS_REVIEW` records.

When no usable published knowledge is available for a required operation, return `KNOWLEDGE_UNAVAILABLE` instead of fabricating policy information.

## 9. Crawler design

Crawler source adapters should be isolated by source. The MVP source allow-list is limited to official sources specified by the architecture: Ministry of Health and Welfare, 1966 / Long-Term Care, National Laws and Regulations Database, Taipei City Government, and New Taipei City Government.

Each run should capture:
- start / finish timestamps
- source
- status
- items checked
- changes detected
- error message when applicable

Content changes should be detected using deterministic normalized-content hashes. A changed hash creates a KnowledgeChange and enters review; the crawler must never publish policy changes directly.

The architecture specifies Asia/Taipei at 00:10 daily. Scheduler/deployment wiring is deferred until Jerry approves the runtime/deployment approach.

## 10. AI Adapter boundary

AI calls are isolated behind an adapter interface so application services do not depend directly on a vendor SDK. The adapter may return structured assessment interpretation for CareNeedProfile generation, but it must not expose an interface that lets an LLM select Providers or override deterministic Recommendation rules.

No AI secret may be committed. Credentials belong in environment variables outside source control.

## 11. Error handling

Map errors to the locked MVP codes:

- `INVALID_REQUEST`: malformed or semantically invalid request
- `NOT_FOUND`: requested resource does not exist
- `VALIDATION_ERROR`: field/domain validation failure
- `CONSENT_REQUIRED`: assessment attempted without valid consent
- `NO_PROVIDER_FOUND`: only where the Contract explicitly expects an error; recommendation empty results normally use successful `providers: []`
- `KNOWLEDGE_UNAVAILABLE`: no usable published knowledge for a required operation
- `INTERNAL_ERROR`: unexpected backend failure

Unexpected exceptions should be logged with a correlation/request identifier. Client responses must not leak secrets or implementation details.

## 12. Test strategy

B owns API / Recommendation / Knowledge / Crawler tests.

### Unit tests
- contract validation and required fields
- consent gate
- CareNeedProfile mapping
- service-area matching
- distance calculation
- deterministic stable-rotation behavior
- top-3 limit
- explainable reason generation
- Lead default status
- Knowledge publication gate
- content-hash change detection
- crawler failure preserving the last published version

### API contract tests
Verify request validation, success/error envelopes, field names, enum values, null behavior, and empty-result behavior against the locked API Contract for every endpoint.

### Integration tests
Use an isolated test database for Assessment → Recommendation → Provider, RecommendationItem → Lead, and KnowledgeRecord → KnowledgeChange → KnowledgeVersion flows.

### Crawler tests
Use fixtures/mocks so deterministic unit tests require no live network. Cover unchanged content, changed content, malformed source data, partial failure, and complete failure.

### Staging integration
Jerry will combine B's Real API with C's frontend in `staging` and run integration/E2E tests. B should provide deterministic, contract-compliant behavior without frontend-specific assumptions.

## 13. Proposed Backend technology stack

### Option A — Recommended
```text
Node.js LTS
TypeScript
Fastify
Zod
PostgreSQL
Prisma
Vitest
```

Reasons:
- TypeScript keeps API/domain contracts explicit.
- Fastify is lightweight and easy to test.
- Zod gives runtime validation and TypeScript inference.
- PostgreSQL fits the relational and versioned domain.
- Prisma provides typed relational access and productive schema work.
- Vitest keeps unit/integration testing straightforward.

Trade-off: Fastify has fewer batteries-included conventions than a larger framework, so project conventions must be followed consistently.

### Option B — Alternative
```text
Node.js LTS
TypeScript
NestJS
class-validator / Zod
PostgreSQL
Prisma
Jest
```

Strengths: stronger built-in module structure, dependency injection, and conventions for a larger backend.

Trade-offs: heavier framework footprint and more conventions than this MVP needs.

### Recommendation
Prefer **Option A (Fastify + TypeScript + Zod + PostgreSQL + Prisma + Vitest)** for the MVP because the repository is specification-first, the team is small and independently developing modules, and B-001 calls for a practical foundation without unnecessary framework weight.

No package installation or root configuration change is performed by B-001. Jerry must approve the stack before implementation begins.

## 14. Decisions requiring Jerry approval

1. Backend framework: Fastify vs NestJS (recommended Fastify).
2. ORM/data-layer choice: Prisma or alternative.
3. Production runtime/deployment and database provider.
4. Database migration/bootstrap strategy once the locked model becomes executable schema.
5. AI provider/model and operational limits.
6. Crawler scheduling infrastructure and retry policy.
7. Authentication/authorization beyond MVP anonymous sessions.
8. Observability and retention policy.
9. Any API Contract, Data Model, or cross-module behavior change.

## 15. Staging integration plan

```text
A Provider Data
      +
B API / Recommendation / Knowledge
      +
C Frontend Mock
      ↓
Jerry merges Feature PRs into staging
      ↓
Mock API boundary replaced with B Real API
      ↓
Integration tests
      ↓
E2E:
Consent → Assessment → CareNeedProfile → Recommendation → Provider Detail → Lead
      ↓
Transportation external-link check
      ↓
Knowledge status check
      ↓
Release candidate
```

B staging-readiness checklist:
- contract endpoints use the documented envelope
- assessment requires valid consent
- LLM never selects Providers
- distance / rotation / no-location ranking is deterministic and contract-compliant
- empty providers returns success + empty array
- Provider detail uses Provider DB data, including its supplied Google Maps URL
- transportation returns Kareocar external URL only
- Lead creation persists `NEW`
- only published knowledge is used for formal assessment behavior
- crawler failure preserves the last published knowledge

## 16. Known limitations for B-001

- No framework/package installation is performed.
- No database migration is created because the schema is locked and this task is planning-only.
- No production credentials, deployment configuration, or scheduler wiring is added.
- No Provider data is added or modified.
- No frontend integration code is added.
- Any missing Contract/Schema detail becomes a Jerry decision/Change Request rather than an implementation guess.
