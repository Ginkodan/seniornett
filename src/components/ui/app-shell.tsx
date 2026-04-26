import type { ReactNode } from "react";
import styles from "./seniornett.module.css";

type AppShellProps = {
  title: string;
  actions?: ReactNode;
  subtitle?: string;
  children: ReactNode;
};

// SeniorNett screens use one predictable shell: clear title, optional one action
// area, and a content region that preserves the global Home button.
export function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  return (
    <div className={`${styles.scope} sn-app app`}>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      <div className="sn-app-body app-body">{children}</div>
    </div>
  );
}

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="sn-page-header app-header">
      <div className="sn-page-title-block">
        <h1 className="app-title">{title}</h1>
        {subtitle ? <p className="sn-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? (
        <>
          <div className="spacer" />
          {actions}
        </>
      ) : null}
    </div>
  );
}
