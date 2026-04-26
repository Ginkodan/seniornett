import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hideLabel?: boolean;
};

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hideLabel?: boolean;
};

export function TextField({ label, hideLabel = true, className = "", id, ...props }: TextFieldProps) {
  return (
    <>
      {label ? (
        <label className={hideLabel ? "sr-only" : "ui-field-label"} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input id={id} className={`field ${className}`.trim()} {...props} />
    </>
  );
}

export function TextAreaField({ label, hideLabel = true, className = "", id, ...props }: TextAreaFieldProps) {
  return (
    <>
      {label ? (
        <label className={hideLabel ? "sr-only" : "ui-field-label"} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <textarea id={id} className={`field ${className}`.trim()} {...props} />
    </>
  );
}

