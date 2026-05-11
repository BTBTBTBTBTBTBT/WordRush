'use client';

import { useState, useEffect } from 'react';
import type { WordDefinition } from './use-word-definition';

export function useWordDefinitions(words: string[]): Map<string, WordDefinition> {
  const [defs, setDefs] = useState<Map<string, WordDefinition>>(new Map());

  useEffect(() => {
    if (words.length === 0) return;
    setDefs(new Map());

    const unique = [...new Set(words.map((w) => w.toLowerCase()))];

    Promise.allSettled(
      unique.map((word) =>
        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data?.[0]) return null;
            const entry = data[0];
            const phonetic = entry.phonetics?.find((p: any) => p.text)?.text || entry.phonetic || '';
            const meaning = entry.meanings?.[0];
            const partOfSpeech = meaning?.partOfSpeech || '';
            const def = meaning?.definitions?.[0]?.definition || '';
            if (!def) return null;
            return { word, def: { phonetic, partOfSpeech, definition: def } as WordDefinition };
          }),
      ),
    ).then((results) => {
      const map = new Map<string, WordDefinition>();
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          map.set(r.value.word, r.value.def);
        }
      }
      setDefs(map);
    });
  }, [words.join(',')]);

  return defs;
}
