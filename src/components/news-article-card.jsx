"use client";

import React from 'react';

function splitArticleContent(content) {
  return (content || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function getImageSrc(imageUrl) {
  if (!imageUrl) {
    return '';
  }
  return imageUrl;
}

export function NewsArticleCard({ article }) {
  return (
    <article className="news-article">
      <div className="news-article-body">
        <div className="news-article-source">{article.source}</div>
        <h2>{article.title}</h2>
        {getImageSrc(article.imageDataUrl || article.image) && (
          <div className="news-article-image">
            <img src={getImageSrc(article.imageDataUrl || article.image)} alt="" loading="lazy" />
          </div>
        )}
        <div className="news-article-content">
          {splitArticleContent(article.content || article.summary).map((paragraph, paragraphIndex) => (
            <p key={`${article.id}-paragraph-${paragraphIndex}`}>{paragraph}</p>
          ))}
        </div>
      </div>
    </article>
  );
}
