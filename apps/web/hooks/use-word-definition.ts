'use client';

import { useState, useEffect } from 'react';

export interface WordDefinition {
  phonetic: string;
  partOfSpeech: string;
  definition: string;
}

export interface WordDefinitionResult {
  definition: WordDefinition | null;
  loaded: boolean;
}

/**
 * Definition for the solved word on the victory / post-game cards.
 *
 * §255: this hook used to import dictEntry from lib/word-of-day — which pulled
 * the entire 2.3 MB word-definitions.json into the browser bundle of every
 * game page (§250 had tripled the file). That is a large part of why "the
 * screens all take a long time to load". The dataset now stays on the server
 * behind /api/define/[word]; the browser fetches one word, cached for a day.
 * Local-first semantics are unchanged — the route consults the dataset first
 * and the free dictionary API only as a fallback.
 */
export function useWordDefinition(word: string | null): WordDefinitionResult {
  const [definition, setDefinition] = useState<WordDefinition | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!word) {
      setDefinition(null);
      setLoaded(false);
      return;
    }
    setDefinition(null);
    setLoaded(false);
    let cancelled = false;

    fetch(`/api/define/${encodeURIComponent(word.toLowerCase())}`)
      .then(res => (res.ok ? res.json() : null))
      .then((data: WordDefinition | null) => {
        if (cancelled) return;
        if (data && data.definition) setDefinition(data);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, [word]);

  return { definition, loaded };
}
