"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { Volume2 } from "lucide-react";
import { useAppState } from "../app-provider";
import styles from "./seniornett.module.css";
import topBarStyles from "../top-bar.module.css";

type SeniorNetGlobalShellProps = {
  children: ReactNode;
};

function formatDateTime(value: string | null, localeTag: string, separator: string) {
  if (!value) return "";

  const time = new Date(value);
  const dateStr = time.toLocaleDateString(localeTag, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeStr = time.toLocaleTimeString(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dateStr}${separator}${timeStr}`;
}

// SeniorNett global shell: this is the only place that owns the persistent
// Home, text-size, read-aloud, identity, and date/time controls.
export function SeniorNetGlobalShell({ children }: SeniorNetGlobalShellProps) {
  const { textSize, setTextSize, readAloud, identity, t, localeTag } = useAppState();
  const [now, setNow] = React.useState<string | null>(null);

  React.useEffect(() => {
    const updateNow = () => setNow(new Date().toISOString());

    updateNow();
    const intervalId = window.setInterval(updateNow, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="tablet-screen">
      <header className={`${topBarStyles.scope} topbar`} aria-label={t("common.home")}>
        <Link className="logo logo-btn" href="/" aria-label={t("common.home")}>
          {t("common.home")}
        </Link>

        <div className="a11y">
          <div className="a11y-group" role="group" aria-label={t("common.textSize")}>
            {["A", "A+", "A++"].map((label, i) => (
              <button
                key={label}
                className={`a11y-btn ${textSize === i ? "active" : ""}`}
                onClick={() => setTextSize(i)}
                style={{ fontSize: i === 0 ? 14 : i === 1 ? 17 : 20 }}
                aria-pressed={textSize === i}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="a11y-btn" onClick={readAloud} title={t("common.readAloud")}>
            <Volume2 size={18} strokeWidth={2.25} aria-hidden="true" />
            {t("common.readAloud")}
          </button>
        </div>

        <div className="spacer" />

        <div className="whoami-chip" aria-live="polite">
          <div className="whoami-main">
            {identity?.loading ? t("topbar.userLoading") : `${identity?.userName || t("topbar.userUnknown")}`}
          </div>
        </div>

        <div className="time" aria-live="polite">
          {formatDateTime(now, localeTag, t("topbar.dateTimeSeparator"))}
        </div>
      </header>

      <main className="content">{children}</main>
    </div>
  );
}

type SeniorNetPageProps = {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  children: ReactNode;
};

// SeniorNett page shell: one title rhythm, exactly one primary action slot,
// optional secondary actions, then content. This keeps focus order predictable:
// global shell controls, page actions, content.
export function SeniorNetPage({ title, subtitle, primaryAction, secondaryActions, children }: SeniorNetPageProps) {
  return (
    <div className={`${styles.scope} sn-app app`}>
      <PageHeader title={title} subtitle={subtitle} primaryAction={primaryAction} secondaryActions={secondaryActions} />
      <div className="sn-app-body app-body">{children}</div>
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
};

export function PageHeader({ title, subtitle, primaryAction, secondaryActions }: PageHeaderProps) {
  return (
    <div className="sn-page-header app-header">
      <div className="sn-page-title-block">
        <h1 className="app-title">{title}</h1>
        {subtitle ? <p className="sn-page-subtitle">{subtitle}</p> : null}
      </div>
      {primaryAction || secondaryActions ? (
        <div className="sn-page-actions">
          {secondaryActions ? <div className="sn-page-secondary-actions">{secondaryActions}</div> : null}
          {primaryAction ? <div className="sn-page-primary-action">{primaryAction}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
