export type YesNoUnknown = "YES" | "NO" | "UNKNOWN";
export type CareNeed =
  | "HOME_CARE"
  | "HOME_MEDICAL_NURSING"
  | "ASSISTIVE_DEVICE"
  | "TRANSPORTATION";

export interface SessionResponse {
  sessionId: string;
  createdAt: string;
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
  location: { city: string; district: string; precision: "DISTRICT"; lat: null; lng: null };
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
