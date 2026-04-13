'use client';

import { useState, useEffect } from 'react';

interface WordDefinition {
  phonetic: string;
  partOfSpeech: string;
  definition: string;
}

export function useWordDefinition(word: string | null): WordDefinition | null {
  const [definition, setDefinition] = useState<WordDefinition | null>(null);

  useEffect(() => {
    if (!word) return;
    setDefinition(null);

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
      })
      .catch(() => {});
  }, [word]);

  return definition;
}
