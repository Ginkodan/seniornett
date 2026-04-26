"use client";

import React from "react";

export function ModalOverlay({ open, eyebrow, title, closeLabel, onClose, children, className = "" }) {
  React.useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="app-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="app-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <section className={`app-modal-panel ${className}`.trim()}>
        <header className="app-modal-head">
          <div>
            {eyebrow ? <div className="tile-sub">{eyebrow}</div> : null}
            <h2 className="app-title">{title}</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            {closeLabel}
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
