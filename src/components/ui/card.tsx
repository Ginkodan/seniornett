import type { HTMLAttributes, ReactNode } from "react";
import styles from "./seniornett.module.css";

type CardProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  as?: "article" | "section" | "div";
  selected?: boolean;
  selectedLabel?: string;
  children: ReactNode;
};

// SeniorNett cards frame grouped content. For selectable tiles, use selected so
// the state is visible by border/shape and announced by assistive technology.
export function Card({
  as: Component = "div",
  selected = false,
  selectedLabel = "Ausgewählt",
  children,
  ...props
}: CardProps) {
  return (
    <Component className={`${styles.scope} sn-card ${selected ? "sn-card-selected" : ""}`.trim()} aria-current={selected || undefined} {...props}>
      {selected ? <div className="sn-card-selected-label">{selectedLabel}</div> : null}
      {children}
    </Component>
  );
}
