// Lightweight debug utilities for conditionally rendering dev/test UI

export function isDebugEnabled(): boolean {
  // Always on in dev server
  // Vite sets import.meta.env.DEV in dev, and false in prod builds (including preview)
  if (import.meta.env.DEV) return true;

  // Explicit opt-in via env var at build time
  const envFlag = (import.meta.env.VITE_DEBUG_PANELS as string | undefined) ?? "";
  if (envFlag === "1" || envFlag?.toLowerCase() === "true") return true;

  // Runtime toggle via query param or localStorage for quick troubleshooting in prod builds
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "1") return true;
      const ls = window.localStorage.getItem("debug_panels");
      if (ls === "1" || ls?.toLowerCase() === "true") return true;
    } catch (_) {
      // no-op
    }
  }

  return false;
}
