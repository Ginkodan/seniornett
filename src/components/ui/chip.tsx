import type { ButtonHTMLAttributes, ReactNode } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
};

export function Chip({ active = false, className = "", children, type = "button", ...props }: ChipProps) {
  return (
    <button type={type} className={`chip ${active ? "active" : ""} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

