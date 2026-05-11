import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

type Intensity = 'light' | 'medium' | 'heavy';

let _isNative: boolean | null = null;
function isNative(): boolean {
  if (_isNative === null) {
    try { _isNative = Capacitor.isNativePlatform(); } catch { _isNative = false; }
  }
  return _isNative;
}

const WEB_DURATIONS: Record<Intensity, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: [30, 50, 30],
};

function vibrateWeb(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

export function haptic(intensity: Intensity = 'light'): void {
  if (isNative()) {
    switch (intensity) {
      case 'light':
        Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        Haptics.notification({ type: NotificationType.Success });
        break;
    }
  } else {
    vibrateWeb(WEB_DURATIONS[intensity]);
  }
}
