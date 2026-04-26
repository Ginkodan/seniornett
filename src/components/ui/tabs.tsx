import type { ReactNode } from "react";
import styles from "./seniornett.module.css";

type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

type TabsProps<T extends string> = {
  label: string;
  items: Array<TabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  selectedLabel?: string;
};

// SeniorNett tabs are visible segmented choices. Every tab has text; the active
// tab includes an explicit selected label and aria-selected.
export function Tabs<T extends string>({ label, items, activeId, onChange, selectedLabel = "Ausgewählt" }: TabsProps<T>) {
  return (
    <div className={`${styles.scope} sn-tabs`} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`sn-tab ${activeId === item.id ? "sn-tab-selected" : ""}`.trim()}
          role="tab"
          aria-selected={activeId === item.id}
          aria-controls={`${item.id}-panel`}
          onClick={() => onChange(item.id)}
        >
          {item.icon ? <span className="sn-tab-icon" aria-hidden="true">{item.icon}</span> : null}
          <span>{item.label}</span>
          {activeId === item.id ? <span className="sn-selected-label">{selectedLabel}</span> : null}
        </button>
      ))}
    </div>
  );
}
