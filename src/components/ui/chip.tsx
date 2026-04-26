import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./seniornett.module.css";

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  selected?: boolean;
  selectedLabel?: string;
  children: ReactNode;
};

// SeniorNett chips are filter choices. Selected chips add a strong border and
// visible selected text, not just a color change.
export function Chip({ selected = false, selectedLabel = "Ausgewählt", children, type = "button", ...props }: ChipProps) {
  return (
    <button type={type} className={`${styles.scope} sn-chip ${selected ? "sn-chip-selected" : ""}`.trim()} aria-pressed={props["aria-pressed"] ?? selected} {...props}>
      <span>{children}</span>
      {selected ? <span className="sn-selected-label">{selectedLabel}</span> : null}
    </button>
  );
}
