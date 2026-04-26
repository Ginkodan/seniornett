import { useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import styles from "./seniornett.module.css";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  hideLabel?: boolean;
  helpText?: string;
  errorText?: string;
};

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  label: string;
  hideLabel?: boolean;
  helpText?: string;
  errorText?: string;
};

// SeniorNett fields always have a label. Hide it visually only when nearby
// context already names the field, keeping screen reader support intact.
export function TextField({ label, hideLabel = false, helpText, errorText, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helpId = helpText ? `${fieldId}-help` : undefined;
  const errorId = errorText ? `${fieldId}-error` : undefined;

  return (
    <div className={`${styles.scope} sn-field`}>
      <label className={hideLabel ? "sr-only" : "sn-field-label"} htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        className="sn-input"
        aria-invalid={Boolean(errorText) || props["aria-invalid"]}
        aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {helpText ? <div id={helpId} className="sn-field-help">{helpText}</div> : null}
      {errorText ? <div id={errorId} className="sn-field-error" role="alert">{errorText}</div> : null}
    </div>
  );
}

export function TextAreaField({ label, hideLabel = false, helpText, errorText, id, ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const helpId = helpText ? `${fieldId}-help` : undefined;
  const errorId = errorText ? `${fieldId}-error` : undefined;

  return (
    <div className={`${styles.scope} sn-field`}>
      <label className={hideLabel ? "sr-only" : "sn-field-label"} htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        id={fieldId}
        className="sn-input sn-textarea"
        aria-invalid={Boolean(errorText) || props["aria-invalid"]}
        aria-describedby={[helpId, errorId].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {helpText ? <div id={helpId} className="sn-field-help">{helpText}</div> : null}
      {errorText ? <div id={errorId} className="sn-field-error" role="alert">{errorText}</div> : null}
    </div>
  );
}
