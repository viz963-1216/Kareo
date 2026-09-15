# Recommendation Service — B-001

## Responsibility

Deterministically select up to three eligible Providers for a requested service type. The service is the source of ranking behavior; an LLM never chooses Providers.

## Processing pipeline

```text
Assessment / CareNeedProfile
↓
Service Type
↓
ACTIVE Provider filter
↓
ProviderService match
↓
ProviderServiceArea match
↓
Ranking strategy
├─ EXACT / GPS → DISTANCE
├─ DISTRICT     → DISTRICT_ROTATION
├─ CITY         → CITY_ROTATION
└─ NONE         → NO_LOCATION
↓
Top 3
↓
RecommendationRun + RecommendationItem
```

## Rules

- Maximum 3 providers per recommendation.
- If only 2 qualify, return 2.
- If none qualify, return a successful response with `providers: []` and the contract-defined notice.
- Exact/GPS ranking may expose `distanceKm`.
- District/city ranking must not claim providers are the nearest.
- Stable rotation uses deterministic context based on session + location scope + date; the exact hash implementation is an implementation detail.
- Each recommendation must expose user-readable `reasons`.
- `score` is an internal ranking field and is not the sole explanation to users.
- `TRANSPORTATION` bypasses this service and uses the Kareocar external-service flow.

## Planned internal components

```text
EligibilityService
DistanceRanker
StableRotationRanker
ReasonBuilder
RecommendationOrchestrator
RecommendationRepository
```

These are planning names, not a locked public API. The final file layout follows Jerry-approved Backend framework conventions.

## Test focus

Test service matching, service-area matching, ACTIVE-only filtering, geographic distance, stable same-day ordering, day-to-day rotation, top-3 limiting, explainable reasons, and empty results.
