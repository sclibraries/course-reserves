/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DEBUG_PANELS?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
