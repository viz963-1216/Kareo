// 依 docs/DATA_MODEL.md 第 4、6 節。欄位/型態不得自行新增或修改。

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Consent {
  id: string;
  sessionId: string;
  disclaimerVersion: string;
  privacyVersion: string;
  termsVersion: string;
  acceptedAt: string;
}

export interface CreateConsentInput {
  sessionId: string;
  disclaimerVersion: string;
  privacyVersion: string;
  termsVersion: string;
  accepted: boolean;
}
