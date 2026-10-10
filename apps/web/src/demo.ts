// Separate static presentation artifact only. Standard real/Netlify builds cannot enable it.
export const demoMode = import.meta.env.VITE_KAREO_DEMO === "true"
  && import.meta.env.VITE_KAREO_API_MODE === "mock"
  && import.meta.env.VITE_KAREO_DEPLOY_CONTEXT === "local";

// Link to a separate static artifact; this flag never changes the main site's API mode.
export const demoEntryUrl = !demoMode && import.meta.env.VITE_KAREO_ENABLE_DEMO === "true"
  ? "/demo/#/consent" : null;
