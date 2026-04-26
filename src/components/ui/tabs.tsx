import type { ReactNode } from "react";

type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
};

type TabsProps<T extends string> = {
  items: Array<TabItem<T>>;
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
};

export function Tabs<T extends string>({ items, activeId, onChange, className = "" }: TabsProps<T>) {
  return (
    <div className={`ui-tabs ${className}`.trim()} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`ui-tab ${activeId === item.id ? "active" : ""}`.trim()}
          role="tab"
          aria-selected={activeId === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

