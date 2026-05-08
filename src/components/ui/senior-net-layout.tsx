"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useAppState } from "../app-provider";
import type { AppTone } from "./app-tile";
import styles from "./seniornett.module.css";
import topBarStyles from "../top-bar.module.css";

type SeniorNetGlobalShellProps = {
  children: ReactNode;
  buildHash?: string;
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
// Home, text-size, identity, and date/time controls.
export function SeniorNetGlobalShell({ children, buildHash = "dev" }: SeniorNetGlobalShellProps) {
  const { textSize, setTextSize, identity, t, localeTag } = useAppState();
  const pathname = usePathname();
  const [now, setNow] = React.useState<string | null>(null);
  const shortHash = buildHash && buildHash !== "dev" ? buildHash.slice(0, 7) : "dev";
  const showDevFooter = pathname === "/";

  React.useEffect(() => {
    const updateNow = () => setNow(new Date().toISOString());

    updateNow();
    const intervalId = window.setInterval(updateNow, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className={`tablet-screen ${showDevFooter ? "tablet-screen--with-dev-footer" : ""}`}>
      <header className={`${topBarStyles.scope} topbar`} aria-label={t("common.home")}>
        <div className="topbar-brand">
          <Link className="logo logo-btn" href="/" aria-label={t("common.home")}>
            {t("common.home")}
          </Link>
        </div>

        <div className="a11y" aria-label={t("common.textSize")}>
          <div className="a11y-group" role="group" aria-label={t("common.textSize")}>
            {["A", "A+", "A++"].map((label, i) => (
              <button
                key={label}
                className={`a11y-btn ${textSize === i ? "active" : ""}`}
                onClick={() => setTextSize(i)}
                style={{ fontSize: i === 0 ? 14 : i === 1 ? 17 : 20 }}
                aria-pressed={textSize === i}
                aria-label={`${t("common.textSize")}: ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
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

      {showDevFooter ? (
        <footer className={`${topBarStyles.scope} dev-footer`} aria-label="Entwicklerinformationen">
          <span className="dev-footer-hash" title={buildHash}>
            Build {shortHash}
          </span>
          <button
            type="button"
            className="dev-footer-reload"
            onClick={() => window.location.reload()}
            title="Hard reload"
          >
            <RotateCcw aria-hidden="true" focusable="false" size={11} />
          </button>
        </footer>
      ) : null}
    </div>
  );
}

type SeniorNetPageProps = {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  tone?: AppTone;
  children: ReactNode;
};

// SeniorNett page shell: one title rhythm, exactly one primary action slot,
// optional secondary actions, then content. This keeps focus order predictable:
// global shell controls, page actions, content.
export function SeniorNetPage({ title, subtitle, primaryAction, secondaryActions, tone, children }: SeniorNetPageProps) {
  return (
    <div className={`${styles.scope} sn-app app`}>
      <PageHeader title={title} subtitle={subtitle} primaryAction={primaryAction} secondaryActions={secondaryActions} tone={tone} />
      <div className="sn-app-body app-body">{children}</div>
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  tone?: AppTone;
};

export function PageHeader({ title, primaryAction, secondaryActions, tone = "blue" }: PageHeaderProps) {
  return (
    <header className="sn-page-header app-header" data-accent={tone}>
      <div className="sn-page-title-block">
        <h1 className="app-title">{title}</h1>
      </div>
      {primaryAction || secondaryActions ? (
        <div className="sn-page-actions">
          {secondaryActions ? <div className="sn-page-secondary-actions">{secondaryActions}</div> : null}
          {primaryAction ? <div className="sn-page-primary-action">{primaryAction}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
