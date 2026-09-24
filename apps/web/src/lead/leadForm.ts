// C-005: client-side checks for the Lead form (API_CONTRACT §12, PRIVACY_AND_RETENTION §3.4).
// Only the fields the contract needs are collected: a form of address, a phone number and contact consent.
// The backend remains the authority (VALIDATION_ERROR); these checks only stop obviously invalid input.

export interface LeadFormValues {
  name: string;
  phone: string;
  contactConsent: boolean;
}

export type LeadFormErrors = Partial<Record<keyof LeadFormValues, string>>;

export const NAME_MAX_LENGTH = 30;

/** Removes spaces, hyphens and parentheses people commonly type in Taiwanese phone numbers. */
export function normalizePhone(value: string) {
  return value.replace(/[\s\-()]/g, "");
}

export function validateLeadForm(values: LeadFormValues): LeadFormErrors {
  const errors: LeadFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = "請填寫稱呼，例如「王先生」。";
  else if (name.length > NAME_MAX_LENGTH) errors.name = `稱呼請在 ${NAME_MAX_LENGTH} 字以內。`;

  const phone = normalizePhone(values.phone);
  if (!phone) errors.phone = "請填寫聯絡電話。";
  // Mobile 09XXXXXXXX or landline with area code (0 + 8–9 digits), digits only after normalizing.
  else if (!/^0\d{8,9}$/.test(phone)) errors.phone = "請填寫有效的台灣電話號碼，例如 0912345678 或 02-12345678。";

  if (!values.contactConsent) errors.contactConsent = "需要勾選同意聯絡，才能送出媒合需求。";
  return errors;
}
