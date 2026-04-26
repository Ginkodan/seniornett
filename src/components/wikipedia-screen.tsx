// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React from 'react';
import { searchWikipediaAction } from '../app/actions/wikipedia';

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
      if (data?.length) setSelected(data[0]);
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
    <div className="app">
      <div className="app-header">
        <h1 className="app-title">Lexikon</h1>
      </div>

      <div className="app-body">
        <div className="wiki-shell">

          {/* Left: search + result list */}
          <div className="wiki-sidebar">
            <div className="wiki-search-row">
              <label className="sr-only" htmlFor="wiki-query">Suchbegriff</label>
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

            {pending && (
              <p className="wiki-status">Einen Moment bitte …</p>
            )}

            {noResults && !pending && (
              <p className="wiki-status">Dazu wurde nichts gefunden. Versuch einen anderen Begriff.</p>
            )}

            {results && results.length > 0 && !pending && (
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
          </div>

          {/* Right: full article */}
          <div className="wiki-article" ref={articleRef}>
            {!selected && !pending && (
              <p className="wiki-empty">Gib oben einen Begriff ein und wähle dann einen Eintrag aus.</p>
            )}
            {selected && (
              <>
                <h2 className="wiki-article-title">{selected.title}</h2>
                <div
                  className="wiki-article-body"
                  dangerouslySetInnerHTML={{ __html: selected.extract }}
                />
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
