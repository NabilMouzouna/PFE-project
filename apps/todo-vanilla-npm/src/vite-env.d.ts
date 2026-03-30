/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPBASE_ENDPOINT: string;
  readonly VITE_APPBASE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
