export type CosmeticCategory = 'tile_theme' | 'keyboard_skin' | 'victory_animation';

export interface CosmeticItem {
  id: string;
  name: string;
  category: CosmeticCategory;
  description: string;
  coinPrice: number;
  usdPrice: number;
  preview: string; // CSS class or identifier for preview rendering
}

export const COSMETICS_CATALOG: CosmeticItem[] = [
  // Tile Themes
  {
    id: 'tile_neon',
    name: 'Neon Glow',
    category: 'tile_theme',
    description: 'Electric neon colors with a glowing effect',
    coinPrice: 200,
    usdPrice: 1.99,
    preview: 'neon',
  },
  {
    id: 'tile_pastel',
    name: 'Pastel Dream',
    category: 'tile_theme',
    description: 'Soft pastel palette for a calming experience',
    coinPrice: 150,
    usdPrice: 1.49,
    preview: 'pastel',
  },
  {
    id: 'tile_golden',
    name: 'Golden Hour',
    category: 'tile_theme',
    description: 'Warm gold and amber tones',
    coinPrice: 300,
    usdPrice: 2.99,
    preview: 'golden',
  },

  // Keyboard Skins
  {
    id: 'kb_galaxy',
    name: 'Galaxy',
    category: 'keyboard_skin',
    description: 'Deep space purple with starlight accents',
    coinPrice: 250,
    usdPrice: 2.49,
    preview: 'galaxy',
  },
  {
    id: 'kb_wooden',
    name: 'Wooden Keys',
    category: 'keyboard_skin',
    description: 'Rustic wooden texture with warm tones',
    coinPrice: 200,
    usdPrice: 1.99,
    preview: 'wooden',
  },

  // Victory Animations
  {
    id: 'victory_fireworks',
    name: 'Fireworks',
    category: 'victory_animation',
    description: 'Explosive fireworks celebration',
    coinPrice: 350,
    usdPrice: 3.49,
    preview: 'fireworks',
  },
  {
    id: 'victory_rainbow',
    name: 'Rainbow Wave',
    category: 'victory_animation',
    description: 'Colorful rainbow wave sweeps across the screen',
    coinPrice: 300,
    usdPrice: 2.99,
    preview: 'rainbow',
  },
];

export function getCosmeticById(id: string): CosmeticItem | undefined {
  return COSMETICS_CATALOG.find(c => c.id === id);
}

export function getCosmeticsByCategory(category: CosmeticCategory): CosmeticItem[] {
  return COSMETICS_CATALOG.filter(c => c.category === category);
}
