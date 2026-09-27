import type { AssessmentLocation, AssessmentRequest } from "../types/api";
import type { AssessmentForm } from "../pages/AssessmentPage";

// Location starts empty: it is optional and never pre-filled for the user (PRODUCT_SPEC §24).
export const defaultAssessmentForm: AssessmentForm = {
  ageRange: "75_84",
  city: "",
  district: "",
  coords: null,
  livingSituation: "WITH_FAMILY",
  caregiverSituation: "FAMILY_LIMITED",
  mobilityLevel: "NEEDS_ASSISTANCE",
  dailyLivingLevel: "PARTIAL_ASSISTANCE",
  homeCare: "YES",
  medicalNursing: "UNKNOWN",
  assistiveDevice: "YES",
  transportation: "YES",
  disabilityCertificate: "UNKNOWN",
  incomeCategory: "UNKNOWN",
  freeText: "",
};

/** Builds the complete v0.3.2 payload. Optional contract fields are always explicit in this client. */
export function buildAssessmentRequest(
  sessionId: string,
  form: AssessmentForm,
  location: AssessmentLocation,
): AssessmentRequest {
  return {
    sessionId,
    ageRange: form.ageRange,
    location,
    livingSituation: form.livingSituation,
    caregiverSituation: form.caregiverSituation,
    mobilityLevel: form.mobilityLevel,
    dailyLivingLevel: form.dailyLivingLevel,
    needs: {
      homeCare: form.homeCare,
      medicalNursing: form.medicalNursing,
      assistiveDevice: form.assistiveDevice,
      transportation: form.transportation,
    },
    disabilityCertificate: form.disabilityCertificate,
    incomeCategory: form.incomeCategory,
    freeText: form.freeText.trim(),
  };
}
