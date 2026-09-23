/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAREO_API_MODE?: string;
  readonly VITE_KAREO_DEPLOY_CONTEXT?: string;
  readonly VITE_KAREO_REQUIRE_SESSION_TOKEN?: string;
  readonly VITE_CONSENT_DISCLAIMER_VERSION?: string;
  readonly VITE_CONSENT_PRIVACY_VERSION?: string;
  readonly VITE_CONSENT_TERMS_VERSION?: string;
}
