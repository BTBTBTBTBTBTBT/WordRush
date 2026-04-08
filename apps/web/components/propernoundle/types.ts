export type TileState = 'correct' | 'present' | 'absent' | 'empty' | 'tbd' | 'hint-used';

export type Category = 'celebrity' | 'sports' | 'geography' | 'other' | 'general';

export type ThemeCategory = 'music' | 'videogames' | 'movies' | 'sports' | 'history' | 'science' | 'currentevents';

export interface Puzzle {
  id: string;
  answer: string;
  display: string;
  category: Category;
  themeCategory?: ThemeCategory;
  hint?: string;
  wikiTitle?: string;
}

export interface Guess {
  word: string;
  tiles: TileState[];
}
