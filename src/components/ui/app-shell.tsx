import type { ReactNode } from "react";

type AppShellProps = {
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function AppShell({ title, actions, className = "", bodyClassName = "", children }: AppShellProps) {
  return (
    <div className={`app ${className}`.trim()}>
      {title || actions ? <PageHeader title={title} actions={actions} /> : null}
      <div className={`app-body ${bodyClassName}`.trim()}>{children}</div>
    </div>
  );
}

type PageHeaderProps = {
  title?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, actions, className = "" }: PageHeaderProps) {
  return (
    <div className={`app-header ${className}`.trim()}>
      {typeof title === "string" ? <h1 className="app-title">{title}</h1> : title}
      {actions ? (
        <>
          <div className="spacer" />
          {actions}
        </>
      ) : null}
    </div>
  );
}

