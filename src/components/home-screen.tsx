// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import { MessageCircleHeart, MessagesSquare, Newspaper, BookOpen, CloudSun, Tv, Siren, Map, Radio, Images, Gift, Train } from 'lucide-react';
import { useAppState } from './app-provider';
import { AppTile } from './ui';
import homeStyles from "./home-screen.module.css";
import uiStyles from "./ui/seniornett.module.css";

const APPS = [
  { id: 'social-hub', href: '/social-hub', icon: <MessageCircleHeart size={34} strokeWidth={2.25} />, accent: 'teal' },
  { id: 'media', href: '/fotos-papiere', icon: <Images size={34} strokeWidth={2.25} />, accent: 'violet' },
  { id: 'marketplace', href: '/marktplatz', icon: <Gift size={34} strokeWidth={2.25} />, accent: 'amber' },
  { id: 'lotti-live', href: '/lotti-live', icon: <MessagesSquare size={34} strokeWidth={2.25} />, accent: 'coral' },
  { id: 'audio', href: '/audio', icon: <Radio size={34} strokeWidth={2.25} />, accent: 'blue' },
  { id: 'news', href: '/news', icon: <Newspaper size={34} strokeWidth={2.25} />, accent: 'green' },
  { id: 'wetter', href: '/wetter', icon: <CloudSun size={34} strokeWidth={2.25} />, accent: 'blue' },
  { id: 'sbb', href: '/sbb', icon: <Train size={34} strokeWidth={2.25} />, accent: 'teal' },
  { id: 'lexikon', href: '/lexikon', icon: <BookOpen size={34} strokeWidth={2.25} />, accent: 'violet' },
  { id: 'karte', href: '/karte', icon: <Map size={34} strokeWidth={2.25} />, accent: 'amber' },
  { id: 'video', href: '/video', icon: <Tv size={34} strokeWidth={2.25} />, accent: 'coral' },
  { id: 'notfall', href: '/notfall', icon: <Siren size={34} strokeWidth={2.25} />, accent: 'coral', urgent: true },
];

export function HomeScreen() {
  const { identity, t } = useAppState();
  const firstName = (identity?.userName || t('topbar.userUnknown')).split(' ')[0];
  const apps = APPS.map((app) => ({
    ...app,
    label: t(`home.apps.${app.id}`),
    actionLabel: t(`home.tileActions.${app.id}`),
  }));

  return (
    <div className={`${homeStyles.scope} ${uiStyles.scope} home`}>
      <div className="home-hero">
        <div className="home-hero-copy">
          <h1>{t('home.greeting', { name: identity?.loading ? '...' : firstName })}</h1>
          <p>{t('home.prompt')}</p>
        </div>
      </div>

      <div className="home-grid">
        {apps.map((app) => (
          <AppTile
            key={app.id}
            href={app.href}
            title={app.label}
            actionLabel={app.actionLabel}
            icon={app.icon}
            accent={app.accent}
            urgent={app.urgent}
          />
        ))}
      </div>
    </div>
  );
}
