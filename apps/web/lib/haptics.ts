type Intensity = 'light' | 'medium' | 'heavy';

const DURATIONS: Record<Intensity, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: [30, 50, 30],
};

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

export function haptic(intensity: Intensity = 'light'): void {
  vibrate(DURATIONS[intensity]);
}
