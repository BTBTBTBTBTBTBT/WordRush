'use client';

import { useEffect, useState } from 'react';
import { AGE_RECOVERY_EVENT, hasAgeRecoveryFailed } from '@/lib/age-check';

/** True while the lockout should explain that the account tried from it is not confirmed (kept for this tab only). */
export function useAgeRecoveryFailed(): boolean {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const read = () => setFailed(hasAgeRecoveryFailed());
    read();
    window.addEventListener(AGE_RECOVERY_EVENT, read);
    return () => window.removeEventListener(AGE_RECOVERY_EVENT, read);
  }, []);
  return failed;
}
