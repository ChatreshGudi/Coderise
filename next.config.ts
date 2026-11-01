import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Local worker environments and research caches are runtime data, not JS assets.
  outputFileTracingExcludes: { '/*': ['./.venv/**/*', './reports/**/*', './backups/**/*'] },
};
export default config;
