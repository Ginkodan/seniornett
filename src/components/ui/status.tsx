import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./seniornett.module.css";

type StatusPanelProps = {
  title?: string;
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
  role?: "status" | "alert";
};

// SeniorNett status messages explain what happened and keep strong contrast.
// Use tone for meaning, but the heading text carries the meaning too.
export function StatusPanel({ title, children, tone = "neutral", role = tone === "error" ? "alert" : "status" }: StatusPanelProps) {
  return (
    <div className={`${styles.scope} sn-status sn-status-${tone}`} role={role}>
      {title ? <div className="sn-status-title">{title}</div> : null}
      <div className="sn-status-body">{children}</div>
    </div>
  );
}

export function EmptyState({ title = "Nichts vorhanden", children }: { title?: string; children: ReactNode }) {
  return <StatusPanel title={title}>{children}</StatusPanel>;
}

export function LoadingState({ title = "Einen Moment bitte", children }: { title?: string; children: ReactNode }) {
  return (
    <StatusPanel title={title}>
      <div className="sn-loading-row">
        <LoaderCircle size={24} className="spin" aria-hidden="true" />
        <span>{children}</span>
      </div>
    </StatusPanel>
  );
}
