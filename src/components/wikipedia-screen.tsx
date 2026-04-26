// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import { searchWikipediaAction } from '../app/actions/wikipedia';
import { SeniorNetPage } from './ui';
import styles from "./wikipedia-screen.module.css";

export function WikipediaScreen() {
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
    <SeniorNetPage title="Wörter erklären" subtitle="Ein Begriff, eine einfache Erklärung.">
      <div className={styles.scope}>
        <div className="wiki-shell">

          <div className="wiki-search-panel">
            <h2>Was möchten Sie verstehen?</h2>
            <p>Geben Sie ein Wort ein. SeniorNett zeigt nur die Erklärung, keine Links nach draussen.</p>
            <div className="wiki-search-row">
              <label className="wiki-label" htmlFor="wiki-query">Suchbegriff</label>
              <input
                id="wiki-query"
                className="field wiki-field"
                type="search"
                placeholder="Begriff eingeben …"
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
                Nachschlagen
              </button>
            </div>
          </div>

          {pending && (
            <p className="wiki-status">Einen Moment bitte …</p>
          )}

          {noResults && !pending && (
            <p className="wiki-status">Dazu wurde nichts gefunden. Versuch einen anderen Begriff.</p>
          )}

          {results && results.length > 0 && !pending && !selected && (
            <div className="wiki-results-section">
              <p className="wiki-results-label">{results.length === 1 ? '1 Treffer' : `${results.length} Treffer`}</p>
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
                  Zurück zu den Treffern
                </button>
                <h2 className="wiki-article-title">{selected.title}</h2>
                <h3 className="wiki-section-title">Kurze Erklärung</h3>
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
