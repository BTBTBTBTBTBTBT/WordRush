'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { setShareSender, shareSenderFromProfile } from '@/lib/share-sender';

/** Keeps the share renderers' sender (item 46) in step with the signed-in profile. Renders nothing. */
export function ShareSenderSync() {
  const { profile } = useAuth();
  useEffect(() => {
    setShareSender(shareSenderFromProfile(profile as never));
    return () => setShareSender(null);
  }, [profile]);
  return null;
}
