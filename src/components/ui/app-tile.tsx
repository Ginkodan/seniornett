export type AppTone = "teal" | "blue" | "green" | "amber" | "coral" | "violet";

import Link from "next/link";
import type { ReactNode } from "react";

type AppTileProps = {
  href: string;
  title: string;
  icon: ReactNode;
  accent?: AppTone;
  urgent?: boolean;
};

export function AppTile({
  href,
  title,
  icon,
  accent = "blue",
  urgent = false,
}: AppTileProps) {
  return (
    <Link
      className="sn-app-tile"
      href={href}
      data-accent={accent}
      aria-label={title}
    >
      <div className="sn-app-tile-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="sn-app-tile-body">
        <h2 className="sn-app-tile-title">{title}</h2>
      </div>
      <span className="sn-app-tile-corner" aria-hidden="true">{urgent ? "!" : "›"}</span>
    </Link>
  );
}
