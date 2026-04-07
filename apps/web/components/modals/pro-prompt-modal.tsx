'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';

export function ProPromptModal() {
  const { user, profile, refreshProfile } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    const streak = profile.daily_login_streak ?? 0;
    const prompted = (profile as any).pro_prompt_shown ?? false;
    const isPro = (profile as any).is_pro ?? false;

    if (streak >= 7 && !prompted && !isPro) {
      setShow(true);
    }
  }, [user, profile]);

  const dismiss = async () => {
    if (!user) return;
    setShow(false);
    await (supabase as any)
      .from('profiles')
      .update({ pro_prompt_shown: true })
      .eq('id', user.id);
    await refreshProfile();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-16 left-4 right-4 z-50 max-w-md mx-auto"
        >
          <div
            className="flex items-center gap-3 p-3.5"
            style={{
              background: '#13102a',
              border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <Crown className="w-8 h-8 flex-shrink-0" style={{ color: '#fbbf24' }} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-extrabold text-xs">You're on a streak!</p>
              <p className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Upgrade to Pro for stats, shields, and more.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/pro" onClick={dismiss}>
                <button
                  className="btn-3d px-3 py-1.5 rounded-lg text-white text-[10px] font-black"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 2px 0 #92400e',
                  }}
                >
                  Go Pro
                </button>
              </Link>
              <button onClick={dismiss} style={{ color: 'rgba(255,255,255,0.3)' }} className="hover:opacity-80 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
