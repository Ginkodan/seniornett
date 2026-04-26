import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "secondary" | "primary" | "accent";
type ButtonSize = "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "btn",
    variant === "primary" ? "btn-primary" : "",
    variant === "accent" ? "btn-accent" : "",
    size === "lg" ? "btn-lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {icon}
      {children}
    </button>
  );
}

