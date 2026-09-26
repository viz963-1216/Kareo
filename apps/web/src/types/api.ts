export type YesNoUnknown = "YES" | "NO" | "UNKNOWN";
export type CareNeed =
  | "HOME_CARE"
  | "HOME_MEDICAL_NURSING"
  | "ASSISTIVE_DEVICE"
  | "TRANSPORTATION";
export type RecommendationServiceType = Exclude<CareNeed, "TRANSPORTATION">;
export type RankingType = "DISTANCE" | "DISTRICT_ROTATION" | "CITY_ROTATION" | "NO_LOCATION";
export type LocationPrecision = "NONE" | "CITY" | "DISTRICT" | "EXACT" | "GPS";

export interface SessionResponse {
  sessionId: string;
  createdAt: string;
}

// API_CONTRACT v0.2 §7 POST /api/v1/consent/withdraw (PROPOSED D-04).
export interface ConsentWithdrawalResponse {
  withdrawnAt: string;
  sessionStatus: "DELETION_REQUESTED";
}

// API_CONTRACT v0.2 §6 DELETE /api/v1/session (PROPOSED D-04).
export interface SessionDeletionResponse {
  sessionId: string;
  status: "DELETION_REQUESTED";
  deletionScheduledBefore: string;
}

export interface ConsentRequest {
  sessionId: string;
  disclaimerVersion: string;
  privacyVersion: string;
  termsVersion: string;
  accepted: true;
}

export interface ConsentResponse {
  consentId: string;
  acceptedAt: string;
}

export interface AssessmentRequest {
  sessionId: string;
  ageRange: "UNDER_50" | "50_64" | "65_74" | "75_84" | "85_PLUS" | "UNKNOWN";
  location: AssessmentLocation;
  livingSituation: "ALONE" | "WITH_FAMILY" | "WITH_CAREGIVER" | "INSTITUTION" | "OTHER" | "UNKNOWN";
  caregiverSituation: "NO_CAREGIVER" | "FAMILY_AVAILABLE" | "FAMILY_LIMITED" | "PAID_CAREGIVER" | "OTHER" | "UNKNOWN";
  mobilityLevel: "INDEPENDENT" | "NEEDS_ASSISTANCE" | "WHEELCHAIR" | "BEDRIDDEN" | "UNKNOWN";
  dailyLivingLevel: "INDEPENDENT" | "PARTIAL_ASSISTANCE" | "HIGH_ASSISTANCE" | "FULL_ASSISTANCE" | "UNKNOWN";
  needs: {
    homeCare: YesNoUnknown;
    medicalNursing: YesNoUnknown;
    assistiveDevice: YesNoUnknown;
    transportation: YesNoUnknown;
  };
  freeText: string;
}

// API_CONTRACT v0.2.2 §8: every field is always present; fields that do not apply are null.
export type AssessmentLocation =
  | { precision: "NONE"; city: null; district: null; lat: null; lng: null }
  | { precision: "CITY"; city: string; district: null; lat: null; lng: null }
  | { precision: "DISTRICT"; city: string; district: string; lat: null; lng: null }
  | { precision: "GPS" | "EXACT"; city: string; district: string; lat: number; lng: number };

export interface CareNeedProfile {
  id: string;
  careNeeds: CareNeed[];
  priority: CareNeed[];
  summary: string;
  warnings: string[];
}

export type AsyncStatus = "idle" | "loading" | "success" | "empty" | "error";

export interface AssessmentResponse {
  assessmentId: string;
  knowledgeVersion: string;
  careNeedProfile: CareNeedProfile;
}

export interface RecommendationRequest {
  assessmentId: string;
  serviceType: RecommendationServiceType;
}

export interface RecommendationProvider {
  id: string;
  name: string;
  type: RecommendationServiceType;
  address: string;
  district: string;
  phone: string;
  website: string | null;
  googleMapsUrl: string;
  verified: boolean;
  rank: 1 | 2 | 3;
  distanceKm: number | null;
  reasons: string[];
}

export interface RecommendationResponse {
  recommendationId: string;
  serviceType: RecommendationServiceType;
  rankingType: RankingType;
  locationPrecision: LocationPrecision;
  providers: RecommendationProvider[];
  notice: string;
}

export interface RecommendationEnvelope {
  success: true;
  data: RecommendationResponse;
}

export interface ProviderDetail {
  id: string;
  name: string;
  type: RecommendationServiceType | "OTHER";
  address: string;
  city: string;
  district: string;
  phone: string;
  website: string | null;
  googleMapsUrl: string;
  verified: boolean;
  services: RecommendationServiceType[];
  serviceAreas: { city: string; district: string }[];
}

// API_CONTRACT §12 POST /api/v1/leads. Idempotency-Key and the session token are added by the API adapter.
export interface LeadRequest {
  sessionId: string;
  assessmentId: string;
  recommendationId: string;
  providerId: string;
  serviceType: RecommendationServiceType;
  contact: { name: string; phone: string };
  contactConsent: true;
}

export type LeadStatus = "NEW" | "CONTACTED" | "ACCEPTED" | "CLOSED" | "CANCELLED";

export interface LeadResponse {
  leadId: string;
  status: LeadStatus;
  createdAt: string;
  duplicate: boolean;
}
