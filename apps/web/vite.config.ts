import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { publishConsentDocuments } from "../../scripts/lib/consent-document-archive.mjs";

export default defineConfig(async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const manifest = await publishConsentDocuments(root, fileURLToPath(new URL("./public", import.meta.url)));
  const base = process.env.VITE_KAREO_DEMO === "true" && process.env.VITE_KAREO_DEMO_BASE === "/Kareo/" ? "/Kareo/" : "/";
  return { base, plugins: [react()], define: { __KAREO_CONSENT_DOCUMENTS__: JSON.stringify(manifest) } };
});
