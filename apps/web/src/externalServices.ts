// PRODUCT_SPEC §12–13 / ARCHITECTURE §10: Kareocar is one external service with one canonical URL.
// All entry points reuse this value so the site never exposes conflicting destinations.
export const KAREOCAR_URL = "https://kareocar.netlify.app/";

