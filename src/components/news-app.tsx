// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import { useAppState } from './app-provider';
import { NewsArticleCard } from './news-article-card';
import { Button, SeniorNetPage } from './ui';
import styles from "./news-app.module.css";

export function NewsScreen() {
  const { news, isOnline, refreshNews, t } = useAppState();
  const articles = news?.items || [];

  return (
    <SeniorNetPage
      title={t('news.title')}
      primaryAction={
        <Button onClick={refreshNews} disabled={!isOnline && !news?.updatedAt}>
          {t('news.reload')}
        </Button>
      }
    >
      <div className={styles.scope}>
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
    </SeniorNetPage>
  );
}
