/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAREO_API_MODE?: "mock" | "real";
  readonly VITE_CONSENT_DISCLAIMER_VERSION?: string;
  readonly VITE_CONSENT_PRIVACY_VERSION?: string;
  readonly VITE_CONSENT_TERMS_VERSION?: string;
}
