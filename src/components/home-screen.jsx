"use client";

import React from 'react';
import Link from 'next/link';
import { MessagesSquare, Newspaper } from 'lucide-react';
import { useAppState } from './app-provider.jsx';

export const APPS = [
  { id: 'news', href: '/news', icon: <Newspaper size={36} strokeWidth={2.25} />, label: 'Nachrichten' },
  { id: 'lotti-live', href: '/lotti-live', icon: <MessagesSquare size={36} strokeWidth={2.25} />, label: 'Lotti live' },
];

export function HomeScreen() {
  const { identity } = useAppState();
  const firstName = (identity?.userName || 'da').split(' ')[0];

  return (
    <div className="home">
      <div className="home-greeting simple">
        <div>
          <h1>Grüezi, {identity?.loading ? '...' : firstName}.</h1>
        </div>
      </div>

      <div className="home-grid">
        {APPS.map((app) => (
          <Link key={app.id} className="home-primary-news" href={app.href}>
            <div className="icon">{app.icon}</div>
            <div className="tile-stack">
              <div className="tile-label">{app.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
