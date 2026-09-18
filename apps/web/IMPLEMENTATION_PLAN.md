# Kareo Frontend Implementation Plan

- Task: `TASK-C-001`
- Owner: Engineer C
- Submission version: `C-001-r1`
- Status: Proposed — pending Jerry approval for technology-stack decisions

## 1. Purpose and scope

This plan defines the MVP frontend information architecture and user experience for Kareo. It is limited to `/apps/web/**` and is designed to work with API-contract-shaped mock data before the real API is integrated in `staging`.

The frontend presents a preliminary care-needs assessment and service guidance. It must not make official eligibility, CMS-level, benefit-approval, diagnosis, or provider-ranking decisions.

Out of scope for this task:

- Installing a framework or changing root configuration.
- Changing API endpoints, response shapes, data models, contracts, or mock contracts.
- Implementing backend, recommendation, provider-data, knowledge, authentication, payment, or Kareocar integration.

## 2. Sitemap / page map

```text
/
├─ /                         Homepage
├─ /consent                  Consent and disclaimer
├─ /assessment               Care-needs assessment
├─ /assessment/result        Preliminary CareNeedProfile result
├─ /recommendations/:service Service recommendation and Provider Top 3
├─ /providers/:providerId    Provider detail
├─ /lead                     Lead form for the selected provider
└─ shared states             Loading, empty, error, and not-found views
```

`TRANSPORTATION` is not a provider-result route. When it appears in the CareNeedProfile or service recommendation, the user sees an external Kareocar CTA instead.

## 3. User flow

```text
Homepage
  ↓ Start free assessment
Consent / Disclaimer (must accept)
  ↓
Assessment
  ↓ POST /assessments
Preliminary CareNeedProfile result
  ↓ Choose a non-transportation service
Service recommendation / Provider Top 3
  ↓
Provider detail
  ├─ Open Google Maps in a new tab
  └─ Start lead form → submit lead → confirmation

CareNeedProfile with TRANSPORTATION
  ↓
Kareocar CTA → https://kareocar.netlify.app/ (new tab)
```

If consent is not accepted, the assessment cannot start. If a user has no location, the assessment can still finish, but the UI must not claim that any provider is nearby. If no provider matches, show a helpful empty state rather than an error.

## 4. Page responsibilities

| Page | Primary responsibility | Key actions and requirements |
| --- | --- | --- |
| Homepage | Explain the free preliminary service and guide first-time visitors. | Primary CTA: 「開始免費長照評估」; avoid dense policy/CMS content. |
| Consent | Collect clickwrap acceptance before assessment. | Show service explanation, disclaimer, privacy notice and terms versions; submit consent with `accepted: true`. |
| Assessment | Collect only contract-defined preliminary needs and location information. | Validate required inputs, allow `UNKNOWN` where supported, submit the assessment request. |
| Assessment Result | Present `careNeedProfile` in understandable language. | Label result 「初步預估」; show `summary`, `warnings`, priorities and next steps. |
| Service Recommendation | Let the user act on each recommended service. | For HOME_CARE, HOME_MEDICAL_NURSING and ASSISTIVE_DEVICE, request and display Provider Top 3. For TRANSPORTATION, show Kareocar external CTA. |
| Provider Top 3 | Present the contract response without altering ranking. | Display provider name, type, district, reasons, distance only when present, notice, detail, Maps and lead actions. |
| Provider Detail | Show one provider's contract-defined detail. | Display contact, service areas, services, verified flag, website when present, Google Maps CTA and lead CTA. |
| Lead Form | Collect only contact name and phone to request matching. | Keep selected assessment, provider and service context; show success or recoverable error after submission. |

## 5. Component map

```text
App shell
├─ Header / footer
│  └─ Persistent preliminary-result and 1966 reminder in footer
├─ DisclaimerBanner
├─ HomepageHero
├─ ConsentForm
├─ AssessmentForm
│  ├─ LocationFields
│  ├─ LivingAndCaregiverFields
│  ├─ MobilityAndDailyLivingFields
│  └─ ServiceNeedFields
├─ CareNeedProfileCard
│  ├─ PriorityList
│  ├─ WarningList
│  └─ ServiceActionList
├─ RecommendationView
│  ├─ RecommendationNotice
│  ├─ ProviderCard
│  ├─ ProviderReasons
│  └─ EmptyProviderState
├─ ProviderDetailView
├─ GoogleMapsLink
├─ KareocarLink
├─ LeadForm
└─ AsyncState
   ├─ LoadingState
   ├─ ErrorState
   ├─ EmptyState
   └─ SuccessFeedback
```

Reusable components receive view data only. They must not contain recommendation logic, construct Google Maps URLs, or infer official eligibility.

## 6. Frontend state management

Use route-level state plus a small session context/store:

- `sessionId`: returned by `POST /api/v1/session`.
- `consent`: accepted status plus disclaimer, privacy and terms versions.
- `assessment`: current request draft and completed `assessmentId`.
- `careNeedProfile`: the completed assessment response, including `knowledgeVersion` and warnings.
- `selectedService`, `selectedProvider` and latest recommendation response.
- `lead`: selected provider/service context and submission status.

Persist only the minimum session and completed identifiers needed to resume the current browser flow. Do not persist free-text health information or contact data beyond what is required for the active flow. Treat API data as read-only frontend state.

## 7. Loading, success, empty and error states

| Flow | Loading | Success | Empty | Error |
| --- | --- | --- | --- | --- |
| Session / consent | Disable duplicate submit and announce progress. | Continue to assessment. | Not applicable. | Explain that assessment cannot start; offer retry. |
| Assessment | Keep entered answers visible and prevent duplicate submission. | Show CareNeedProfile and required warnings. | Not applicable. | Preserve answers, show non-diagnostic error and retry option. |
| Recommendation | Skeleton/provider-list progress with accessible status text. | Show up to three returned providers and notice. | When `providers: []`, show the contract notice, 1966 guidance and retry/change-location actions. | Do not guess providers; show retry and 1966 guidance. |
| Provider detail | Show detail loading state. | Show returned provider information. | Not applicable. | Show not-found/retry state; do not manufacture details. |
| Lead | Disable repeated submissions while sending. | Confirm `leadId` and status `NEW`; explain next expected contact. | Not applicable. | Retain typed values locally for correction/retry. |
| Kareocar | Not required before navigation. | Open supplied URL in a new tab. | If service data is unavailable, show a non-embedded unavailable message. | Do not substitute another URL. |

Timeouts are errors, not empty results. The UI must never invent an assessment, recommendation, provider, or benefit result.

## 8. Mock data and API-contract mapping

During independent frontend development, use fixtures shaped exactly like `API_CONTRACT.md`; do not add fields or change existing names, types or enums.

| Frontend flow | Contract endpoint | Required response data | Fixture scenario |
| --- | --- | --- | --- |
| Start session | `POST /api/v1/session` | `sessionId`, `createdAt` | Success and error |
| Accept consent | `POST /api/v1/consent` | `consentId`, `acceptedAt` | Accepted, declined, `CONSENT_REQUIRED` |
| Submit assessment | `POST /api/v1/assessments` | `assessmentId`, `knowledgeVersion`, `careNeedProfile` | Success, validation error, timeout |
| Get providers | `POST /api/v1/recommendations` | `recommendationId`, service/ranking/location data, `providers`, `notice` | GPS success, district success, empty, error |
| Provider detail | `GET /api/v1/providers/{providerId}` | Provider fields, `services`, `serviceAreas` | Success, not found, error |
| Transportation | `GET /api/v1/external-services/transportation` | `url`, `openMode`, `notice` | Success and unavailable error |
| Submit lead | `POST /api/v1/leads` | `leadId`, `status`, `createdAt` | Success, validation error, error |

Mock fixtures should remain inside the web application only when created in a later, explicitly scoped frontend task. `contracts/mock/**` is Jerry-owned and must not be changed by Engineer C.

## 9. API integration boundaries

- All requests use the fixed `/api/v1` contract and its standard `success` envelope.
- Map `success: false` to a user-safe error state using the supplied error code/message.
- `NO_PROVIDER_FOUND` or `providers: []` maps to an empty provider state, not a crash.
- `CONSENT_REQUIRED` returns the user to consent; it must not be bypassed in the UI.
- Render `distanceKm` only when the contract supplies it. With `DISTRICT_ROTATION`, explicitly state that the result is not distance-ranked.
- Render provider `reasons`; do not calculate scores, distances, service coverage, rankings or provider eligibility in the frontend.
- Use only the supplied `googleMapsUrl`; never construct a Maps URL from address data.

## 10. Disclaimer and preliminary-result placement

| Placement | Required content |
| --- | --- |
| Homepage near CTA | Briefly state that the service is free and provides a preliminary assessment. |
| Consent page | Full disclaimer and separate privacy/terms acknowledgement before assessment starts. |
| Assessment Result | Prominent 「初步預估」 label plus API `warnings`. |
| Benefit or policy information | Use 「可能符合」or「預估」; show knowledge notice/source metadata when supplied. |
| Provider results | State that recommendations are based on current information and service/location criteria, not official endorsement. |
| Global footer | State that eligibility, care level, services and benefits require formal confirmation by 1966 or the local long-term-care management center. |

Never use wording such as 「正式核定」、「已符合資格」or「已核定 CMS 等級」.

## 11. External-navigation rules

### Google Maps

Display a clearly labelled external link only when the returned provider includes `googleMapsUrl`. Open it in a new tab with safe external-link behavior. The frontend must not construct, alter or embed a Google Maps URL.

### Kareocar

For `TRANSPORTATION`, use the external-service response URL; the MVP expected URL is `https://kareocar.netlify.app/`. Open a new tab. Do not use an iframe, shared authentication, backend integration, database integration, or an in-app transportation booking flow.

## 12. Responsive design strategy

- Design mobile-first because a family caregiver may use a phone during care coordination.
- Use one-column forms and readable, touch-friendly controls on narrow screens.
- Keep primary CTA and next step visible; do not rely on hover to reveal essential information.
- On larger screens, use constrained content width and a two-column provider/detail layout only when information remains readable.
- Provider cards must preserve rank, reasons, phone, service type and CTAs without horizontal clipping.
- Test at least mobile, tablet and desktop breakpoints, including long Chinese labels and dynamic API notices.

## 13. Accessibility baseline

- Use semantic headings, landmarks, labelled form controls and native buttons/links.
- Associate validation errors with fields and move focus to the first error after submit.
- Announce loading, success and error updates through accessible status messaging.
- Keep keyboard order aligned with visual order; make all CTA and dialog controls keyboard-operable.
- Provide visible focus states and sufficient text/background contrast.
- Do not use colour alone for validation, rank, verified status or error meaning.
- Ensure external links identify that they open a new tab.
- Write plain, respectful Chinese and avoid unexplained professional terminology.

## 14. Frontend technology-stack options

No framework is installed or selected by this task. Jerry must approve one option before implementation changes root configuration.

| Option | Strengths | Trade-offs |
| --- | --- | --- |
| A. React + Vite + TypeScript + React Router | Strong component ecosystem, straightforward mock/API replacement, familiar routing and good support for responsive component development. | Requires root setup and dependency approval; state/data-fetching conventions must be agreed. |
| B. Next.js + TypeScript | File-based routing, strong deployment conventions and future flexibility for server rendering. | More framework decisions and configuration than this static/mock-first MVP plan needs; requires root setup and deployment approval. |

Recommendation: Option A, React + Vite + TypeScript + React Router, because it is the lighter mock-first option for the defined page flow and keeps eventual API replacement simple. This is a recommendation only; no package, configuration, route, or dependency change is authorized here.

## 15. Decisions requiring Jerry approval

1. Chosen frontend framework and version.
2. Package manager, root package configuration and deployment/preview setup.
3. Styling system and any component/form/data-fetching libraries.
4. Exact consent, privacy and terms copy and their version identifiers.
5. Whether and how browser session state may persist between reloads.
6. Any API-contract ambiguity, new mock scenario or requested contract change.
7. Analytics, error-monitoring, tracking or external-service security policy.

## 16. Staging and real-API integration checklist

When Jerry integrates the frontend with Engineer B's real API in `staging`:

1. Replace fixture adapters with the real `/api/v1` endpoints without changing UI response assumptions.
2. Verify session → consent → assessment → CareNeedProfile → recommendation → detail → lead flow end to end.
3. Verify the consent rejection and `CONSENT_REQUIRED` paths.
4. Verify GPS, district-only and no-location recommendation wording.
5. Verify zero, one, two and three provider responses, plus API error and timeout states.
6. Confirm ranking, reasons, distance and Maps URLs are rendered exactly as returned.
7. Confirm TRANSPORTATION opens Kareocar in a new tab and is never sent to the provider recommendation endpoint.
8. Verify disclaimer wording at every required placement and confirm no official-result claims appear.
9. Run mobile, keyboard and screen-reader-oriented checks alongside integration/E2E testing.

## 17. Scope compliance

This plan introduces no changes to backend, contracts, schemas, recommendation logic, provider data, root configuration or deployment configuration. Future implementation tasks should remain scoped to `/apps/web/**` and should create an Issue for any required cross-module change.
