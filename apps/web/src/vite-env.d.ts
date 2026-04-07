/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_GSC_VERIFICATION?: string;
  readonly VITE_THEME_COLOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
