import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "secondary" | "primary";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  active?: boolean;
  variant?: IconButtonVariant;
};

export function IconButton({
  label,
  icon,
  active = false,
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  const classes = [
    "ui-icon-button",
    variant === "primary" ? "ui-icon-button-primary" : "",
    active ? "active" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      aria-label={label}
      title={label}
      aria-pressed={props["aria-pressed"] ?? active}
      {...props}
    >
      {icon}
    </button>
  );
}

