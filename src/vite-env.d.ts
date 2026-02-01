/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Chrome Extension API types (minimal for platform detection)
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        id?: string | null
      }
    }
  }
  
  const chrome: {
    runtime?: {
      id?: string | null
    }
  } | undefined
}

export {}
