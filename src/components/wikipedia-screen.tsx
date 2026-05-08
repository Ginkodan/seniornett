// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import { searchWikipediaAction } from '../app/actions/wikipedia';
import { useAppState } from './app-provider';
import { SeniorNetPage } from './ui';
import styles from "./wikipedia-screen.module.css";

export function WikipediaScreen() {
  const { t } = useAppState();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const [pending, setPending] = React.useState(false);
  const articleRef = React.useRef(null);

  const submit = async () => {
    const text = query.trim();
    if (!text || pending) return;
    setPending(true);
    setResults(null);
    setSelected(null);
    try {
      const data = await searchWikipediaAction(text);
      setResults(data);
    } finally {
      setPending(false);
    }
  };

  const selectItem = (item) => {
    setSelected(item);
    if (articleRef.current) articleRef.current.scrollTop = 0;
  };

  const noResults = results !== null && results.length === 0;

  return (
    <SeniorNetPage title={t('lexikon.title')} subtitle={t('lexikon.subtitle')} tone="violet">
      <div className={styles.scope}>
        <div className="wiki-shell">

          <div className="wiki-search-panel">
            <h2>{t('lexikon.heading')}</h2>
            <p>{t('lexikon.body')}</p>
            <div className="wiki-search-row">
              <label className="wiki-label" htmlFor="wiki-query">{t('lexikon.searchLabel')}</label>
              <input
                id="wiki-query"
                className="field wiki-field"
                type="search"
                placeholder={t('lexikon.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                disabled={pending}
              />
              <button
                className="btn btn-primary wiki-search-btn"
                onClick={submit}
                disabled={pending || !query.trim()}
              >
                {t('lexikon.search')}
              </button>
            </div>
          </div>

          {pending && (
            <p className="wiki-status">{t('lexikon.loading')}</p>
          )}

          {noResults && !pending && (
            <p className="wiki-status">{t('lexikon.empty')}</p>
          )}

          {results && results.length > 0 && !pending && !selected && (
            <div className="wiki-results-section">
              <p className="wiki-results-label">{t('lexikon.results', { count: results.length })}</p>
              <ul className="wiki-result-list">
                {results.map((item) => (
                  <li key={item.title}>
                    <button
                      className={`wiki-result-btn${selected?.title === item.title ? ' active' : ''}`}
                      onClick={() => selectItem(item)}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="wiki-article" ref={articleRef}>
            {selected && (
              <>
                <button type="button" className="btn wiki-back-btn" onClick={() => setSelected(null)}>
                  {t('lexikon.back')}
                </button>
                <h2 className="wiki-article-title">{selected.title}</h2>
                <h3 className="wiki-section-title">{t('lexikon.sectionTitle')}</h3>
                <div
                  className="wiki-article-body"
                  dangerouslySetInnerHTML={{ __html: selected.extract }}
                />
              </>
            )}
          </div>

        </div>
      </div>
    </SeniorNetPage>
  );
}
