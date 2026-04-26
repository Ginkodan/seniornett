import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

type StatusPanelProps = {
  children: ReactNode;
  tone?: "neutral" | "warning" | "error";
  className?: string;
  role?: "status" | "alert";
};

export function StatusPanel({ children, tone = "neutral", className = "", role = "status" }: StatusPanelProps) {
  return (
    <div className={`ui-status ui-status-${tone} ${className}`.trim()} role={role}>
      {children}
    </div>
  );
}

export function EmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <StatusPanel className={className}>{children}</StatusPanel>;
}

export function LoadingState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <StatusPanel className={className}>
      <LoaderCircle size={24} className="spin" aria-hidden="true" />
      <span>{children}</span>
    </StatusPanel>
  );
}

