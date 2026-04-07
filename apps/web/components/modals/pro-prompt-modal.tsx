'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';

/**
 * One-time Pro upsell shown when daily_login_streak >= 7 and pro_prompt_shown is false.
 * Dismissing sets pro_prompt_shown = true so it never appears again.
 */
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
          className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto"
        >
          <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-4 border border-yellow-400/30 shadow-2xl flex items-center gap-4">
            <Crown className="w-10 h-10 text-yellow-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">You're on a streak!</p>
              <p className="text-white/60 text-xs">Upgrade to Pro for extended stats, shields, and more.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/pro" onClick={dismiss}>
                <button className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full px-3 py-1.5 text-white text-xs font-bold hover:from-yellow-500 hover:to-orange-600 transition-colors">
                  Go Pro
                </button>
              </Link>
              <button onClick={dismiss} className="text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
