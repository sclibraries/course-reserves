import { ReactNode } from "react";
import { isDebugEnabled } from "@/lib/debug";

type DebugOnlyProps = {
  children: ReactNode;
  // Allow forcing show/hide for tests
  force?: boolean;
};

export function DebugOnly({ children, force }: DebugOnlyProps) {
  const show = typeof force === "boolean" ? force : isDebugEnabled();
  if (!show) return null;
  return <>{children}</>;
}

export default DebugOnly;
