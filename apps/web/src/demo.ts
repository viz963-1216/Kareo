// Separate static presentation artifact only. Standard real/Netlify builds cannot enable it.
export const demoMode = import.meta.env.VITE_KAREO_DEMO === "true"
  && import.meta.env.VITE_KAREO_API_MODE === "mock"
  && import.meta.env.VITE_KAREO_DEPLOY_CONTEXT === "local";
