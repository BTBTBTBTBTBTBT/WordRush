'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import type { Database } from './database.types';
import { isProActive } from './pro';
import { migrateLegacyStorageKeys } from './storage-migration';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  /**
   * Expiry-aware Pro check. Prefer this over `profile.is_pro`, which is a
   * raw write-side marker that can remain true after `pro_expires_at` passes.
   */
  isProActive: boolean;
  /**
   * Guest mode — a signed-out visitor who chose "Play without an account".
   * Apple 5.1.1(v) / Google Play require the single-player daily to be playable
   * without forcing registration. Guests can play the daily puzzle of each solo
   * mode (recording no-ops with no session, so nothing is saved); leaderboards,
   * VS, profile, records, unlimited, and Pro still require sign-in.
   */
  isGuest: boolean;
  enterGuest: () => void;
  /** Leave guest mode → AuthGate shows the Landing/sign-in (used by the header
   *  "Sign In" button and the account-surface prompts so guests can register). */
  exitGuest: () => void;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithFacebook: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const enterGuest = () => {
    try { localStorage.setItem('wordocious-guest', '1'); } catch {}
    setIsGuest(true);
  };

  const exitGuest = () => {
    try { localStorage.removeItem('wordocious-guest'); } catch {}
    setIsGuest(false);
  };

  const fetchProfile = async (userId: string, userData?: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const profile = data as Profile | null;

    if (profile) {
      if (profile.is_banned) {
        // Banned users get signed out immediately
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setSession(null);
        return;
      }
      setProfile(profile);
    } else if (!error || error.code === 'PGRST116') {
      // No profile exists — auto-create for OAuth users
      const u = userData;
      if (u) {
        const avatarUrl = u.user_metadata?.avatar_url || u.user_metadata?.picture || null;

        // Generate anonymous default username — never expose real names
        let newProfile = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const suffix = Math.floor(10000 + Math.random() * 90000);
          const username = `Wordocious${suffix}`;
          const { data, error: insertErr } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              username,
              avatar_url: avatarUrl,
              has_onboarded: false,
            } as any)
            .select()
            .single();

          if (data) { newProfile = data; break; }
          // 23505 = unique violation — retry with new suffix
          if (insertErr?.code !== '23505') break;
        }

        if (newProfile) {
          setProfile(newProfile as Profile);
        }
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  useEffect(() => {
    // One-time rename of legacy `spellstrike-*` localStorage keys to the
    // `wordocious-*` prefix. Runs before any game component reads its
    // first persisted state. Idempotent via internal flag.
    migrateLegacyStorageKeys();

    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // A real session supersedes guest mode.
          try { localStorage.removeItem('wordocious-guest'); } catch {}
          await fetchProfile(session.user.id, session.user);
        } else {
          // Restore a prior "Play without an account" choice across refreshes.
          try { if (localStorage.getItem('wordocious-guest') === '1') setIsGuest(true); } catch {}
        }
        setLoading(false);
      })();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          try { localStorage.removeItem('wordocious-guest'); } catch {}
          setIsGuest(false);
          await fetchProfile(session.user.id, session.user);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      // Pass the username as user metadata; the DB trigger handle_new_user()
      // creates the profiles row (SECURITY DEFINER, bypassing RLS). We do NOT
      // insert the profile client-side — with email confirmation on there's no
      // session yet, so the insert would fail the profiles RLS policy.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from signup');

      // Only fetch the profile if a session was established (email confirmation
      // off / OAuth). Otherwise the user must confirm their email before login.
      if (authData.session) {
        await fetchProfile(authData.user.id, authData.user);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithFacebook = async () => {
    try {
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: { redirectTo },
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem('wordocious-guest'); } catch {}
    setIsGuest(false);
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isProActive: isProActive(profile),
        isGuest,
        enterGuest,
        exitGuest,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
