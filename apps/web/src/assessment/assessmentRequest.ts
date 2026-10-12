import type { AssessmentLocation, AssessmentRequest } from "../types/api";
import type { AssessmentForm } from "../pages/AssessmentPage";

// KUI-r1: do not presume a person’s age, care situation or needs. Location remains optional.
export const defaultAssessmentForm: AssessmentForm = {
  ageRange: "UNKNOWN",
  city: "",
  district: "",
  coords: null,
  residenceAddress: "",
  livingSituation: "UNKNOWN",
  caregiverSituation: "UNKNOWN",
  mobilityLevel: "UNKNOWN",
  dailyLivingLevel: "UNKNOWN",
  homeCare: "UNKNOWN",
  medicalNursing: "UNKNOWN",
  assistiveDevice: "UNKNOWN",
  transportation: "UNKNOWN",
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
