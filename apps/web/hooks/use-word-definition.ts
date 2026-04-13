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

    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data[0]) {
          const entry = data[0];
          const phonetic = entry.phonetics?.find((p: any) => p.text)?.text || entry.phonetic || '';
          const meaning = entry.meanings?.[0];
          const partOfSpeech = meaning?.partOfSpeech || '';
          const def = meaning?.definitions?.[0]?.definition || '';
          if (def) {
            setDefinition({ phonetic, partOfSpeech, definition: def });
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, [word]);

  return { definition, loaded };
}
