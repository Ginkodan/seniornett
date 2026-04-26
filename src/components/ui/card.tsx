import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div";
  active?: boolean;
  children: ReactNode;
};

export function Card({ as: Component = "div", active = false, className = "", children, ...props }: CardProps) {
  return (
    <Component className={`card ${active ? "active" : ""} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}

