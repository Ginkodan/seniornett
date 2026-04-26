"use client";

import React from 'react';
import { useAppState } from './app-provider.jsx';
import { NewsArticleCard } from './news-article-card.jsx';

export function NewsScreen() {
  const { news, isOnline, refreshNews, t } = useAppState();
  const articles = news?.items || [];

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">{t('news.title')}</h1>
        <div className="spacer" />
        <button className="btn" onClick={refreshNews} disabled={!isOnline && !news?.updatedAt}>
          {t('news.reload')}
        </button>
      </div>

      <div className="app-body">
        <div className="news-app-shell">
          {news?.error && (
            <div className="news-app-warning">
              {t('news.errors.unavailable')}
            </div>
          )}

          <div className="news-grid">
            {articles.map((article) => (
              <NewsArticleCard
                key={article.id}
                article={article}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
