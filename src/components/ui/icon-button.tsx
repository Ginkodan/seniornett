import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./seniornett.module.css";

type IconButtonVariant = "primary" | "secondary" | "selected" | "danger" | "quiet";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
  label: string;
  icon: ReactNode;
  active?: boolean;
  variant?: IconButtonVariant;
  selectedLabel?: string;
};

// SeniorNett icon buttons always show text. Use this for compact tool actions
// where an icon helps recognition, never as an unlabeled icon-only control.
export function IconButton({
  label,
  icon,
  active = false,
  variant = "secondary",
  selectedLabel = "Ausgewählt",
  type = "button",
  ...props
}: IconButtonProps) {
  const resolvedVariant = active && variant !== "danger" ? "selected" : variant;
  const classes = [styles.scope, "sn-icon-button", `sn-icon-button-${resolvedVariant}`]
    .filter(Boolean)
    .join(" ");
  const isSelected = active || variant === "selected";
  const pressedState = props["aria-pressed"] ?? (isSelected ? true : undefined);

  return (
    <button
      type={type}
      className={classes}
      aria-label={label}
      aria-pressed={pressedState}
      {...props}
    >
      <span className="sn-icon-button-icon" aria-hidden="true">{icon}</span>
      <span className="sn-icon-button-text">{label}</span>
      {isSelected ? <span className="sn-selected-label">{selectedLabel}</span> : null}
    </button>
  );
}
