import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./seniornett.module.css";

type ButtonVariant = "primary" | "secondary" | "selected" | "danger" | "quiet";
type ButtonSize = "md" | "lg";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  selectedLabel?: string;
};

// SeniorNett use: primary for the one main action, secondary for normal actions,
// selected for chosen options, danger for risky actions, quiet for low-emphasis cancel/back actions.
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  selectedLabel = "Ausgewählt",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [styles.scope, "sn-button", `sn-button-${variant}`, size === "lg" ? "sn-button-lg" : ""]
    .filter(Boolean)
    .join(" ");
  const isSelected = variant === "selected";
  const pressedState = props["aria-pressed"] ?? (isSelected ? true : undefined);

  return (
    <button type={type} className={classes} aria-pressed={pressedState} {...props}>
      {icon ? <span className="sn-button-icon" aria-hidden="true">{icon}</span> : null}
      <span className="sn-button-text">{children}</span>
      {isSelected ? <span className="sn-selected-label">{selectedLabel}</span> : null}
    </button>
  );
}
