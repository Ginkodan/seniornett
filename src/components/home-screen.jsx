"use client";

import React from 'react';
import Link from 'next/link';
import { MessageCircleHeart, MessagesSquare, Newspaper, BookOpen, CloudSun, Tv, Siren, Map, Radio, Images } from 'lucide-react';
import { useAppState } from './app-provider.jsx';

const APPS = [
  { id: 'social-hub', href: '/social-hub', icon: <MessageCircleHeart size={36} strokeWidth={2.25} /> },
  { id: 'media', href: '/fotos-papiere', icon: <Images size={36} strokeWidth={2.25} /> },
  { id: 'audio', href: '/audio', icon: <Radio size={36} strokeWidth={2.25} /> },
  { id: 'news', href: '/news', icon: <Newspaper size={36} strokeWidth={2.25} /> },
  { id: 'lotti-live', href: '/lotti-live', icon: <MessagesSquare size={36} strokeWidth={2.25} /> },
  { id: 'lexikon', href: '/lexikon', icon: <BookOpen size={36} strokeWidth={2.25} /> },
  { id: 'wetter', href: '/wetter', icon: <CloudSun size={36} strokeWidth={2.25} /> },
  { id: 'karte', href: '/karte', icon: <Map size={36} strokeWidth={2.25} /> },
  { id: 'video', href: '/video', icon: <Tv size={36} strokeWidth={2.25} /> },
  { id: 'notfall', href: '/notfall', icon: <Siren size={36} strokeWidth={2.25} /> },
];

export function HomeScreen() {
  const { identity, t } = useAppState();
  const firstName = (identity?.userName || t('topbar.userUnknown')).split(' ')[0];
  const apps = APPS.map((app) => ({
    ...app,
    label: t(`home.apps.${app.id}`),
  }));

  return (
    <div className="home">
      <div className="home-greeting simple">
        <div>
          <h1>{t('home.greeting', { name: identity?.loading ? '...' : firstName })}</h1>
        </div>
      </div>

      <div className="home-grid">
        {apps.map((app) => (
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
