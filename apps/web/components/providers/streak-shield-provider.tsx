'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isStreakAtRisk, useShield } from '@/lib/shield-service';
import { StreakShieldModal } from '@/components/modals/streak-shield-modal';
import { supabase } from '@/lib/supabase-client';

export function StreakShieldProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user || !profile || checked) return;

    const streak = profile.daily_login_streak ?? 0;
    const lastPlayed = profile.last_played_at ?? null;

    if (streak > 0 && isStreakAtRisk(lastPlayed)) {
      setShowModal(true);
    }

    setChecked(true);
  }, [user, profile, checked]);

  const handleUseShield = async () => {
    if (!user) return;
    await useShield(user.id);
    await refreshProfile();
    setShowModal(false);
  };

  const handleDecline = async () => {
    if (!user) return;
    // Reset the streak
    await (supabase as any)
      .from('profiles')
      .update({ daily_login_streak: 0 })
      .eq('id', user.id);
    await refreshProfile();
    setShowModal(false);
  };

  return (
    <>
      {children}
      {profile && (
        <StreakShieldModal
          open={showModal}
          streak={profile.daily_login_streak ?? 0}
          shields={(profile as any).streak_shields ?? 0}
          onUseShield={handleUseShield}
          onDecline={handleDecline}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
