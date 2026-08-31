'use client';

import { useState, useEffect } from 'react';
import { dictEntry } from '@/lib/word-of-day';

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

    // §250 (founder: definitions vanished during a dictionaryapi.dev outage):
    // the committed local dataset answers instantly for covered words; the
    // API is only a fallback for words outside it (6/7-letter today). Same
    // cure the WOTD/archive got — dictEntry returns null for misses and
    // blocklisted words, both of which fall through unchanged.
    const local = dictEntry(word);
    if (local && local.senses.length > 0) {
      setDefinition({
        phonetic: local.phonetic,
        partOfSpeech: local.senses[0].pos,
        definition: local.senses[0].def,
      });
      setLoaded(true);
      return;
    }

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
