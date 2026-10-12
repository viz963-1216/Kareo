// Separate static presentation artifact only. Standard real/Netlify builds cannot enable it.
export const demoMode = import.meta.env.VITE_KAREO_DEMO === "true"
  && import.meta.env.VITE_KAREO_API_MODE === "mock"
  && import.meta.env.VITE_KAREO_DEPLOY_CONTEXT === "local";

// Public Netlify service: real read-only APIs, browser-only personal analysis.
// This is a separate release capability, not production mock mode or cloud consent activation.
export const publicAnalysisMode = import.meta.env.VITE_KAREO_PUBLIC_ANALYSIS === "true"
  && import.meta.env.VITE_KAREO_API_MODE === "real"
  && !demoMode;
export const localAnalysisMode = demoMode || publicAnalysisMode;

// Link to a separate static artifact; this flag never changes the main site's API mode.
export const demoEntryUrl = !localAnalysisMode && import.meta.env.VITE_KAREO_ENABLE_DEMO === "true"
  ? "/demo/#/consent" : null;
