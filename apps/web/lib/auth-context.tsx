'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import type { Database } from './database.types';
import { isProActive } from './pro';
import { reportRejectedWrite } from './supabase-error-handler';
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
   * True when the profile row could NOT be read (transport/RLS failure), as
   * opposed to a signed-out visitor or a brand-new account with no row yet.
   * Callers that gate on `profile` are gating on a network fetch: this lets
   * them tell "not signed in" from "signed in but we couldn't load you", and
   * say so, instead of silently behaving as if the user had no account.
   */
  profileError: boolean;
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
  /**
   * Emails a recovery link that lands on /auth/reset. Also the ONLY way an
   * OAuth-only account (signed up with Google/Apple, so `encrypted_password`
   * is null) can gain a password — without it, losing the federated login
   * means losing the account.
   */
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  /** Sets a new password for the current session (recovery or signed-in). */
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// One presence stamp per page load (see stampPresence in AuthProvider).
let presenceStamped = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const profileRetry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enterGuest = () => {
    try { localStorage.setItem('wordocious-guest', '1'); } catch {}
    setIsGuest(true);
  };

  const exitGuest = () => {
    try { localStorage.removeItem('wordocious-guest'); } catch {}
    setIsGuest(false);
  };

  /**
   * Load the signed-in user's profile row.
   *
   * Three outcomes that are NOT interchangeable, and used to collapse into one
   * silent fall-through:
   *   1. row found            → set it
   *   2. row genuinely absent → auto-create (an OAuth account's first visit)
   *   3. fetch FAILED         → transport/RLS error; the row probably exists
   *
   * Case 3 read as case 2 is what loses finished games. `user`/`session` come
   * from local storage and keep reporting SIGNED IN, but `profile` stays null
   * forever, and every game component gates its recording on `profile` — so
   * the result is never written AND never queued (the pending-record payload
   * is registered inside those recording calls, which are never reached). The
   * game vanishes with no retry, no toast and no telemetry, and nothing
   * re-fires it later in the session. So: a failed fetch retries on a short
   * backoff to self-heal, and is reported once it gives up.
   */
  const PROFILE_RETRY_DELAYS_MS = [1000, 4000, 15000];

  const fetchProfile = async (userId: string, userData?: User, attempt: number = 0) => {
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
      setProfileError(false);
      setProfile(profile);
      return;
    }

    // maybeSingle() reports a genuinely-absent row as data:null + error:null;
    // PGRST116 is single()'s equivalent of the same thing. ANY other error is
    // a failed read, not an absent account — auto-creating on it would race a
    // row that already exists, and swallowing it strands the session.
    if (error && error.code !== 'PGRST116') {
      const delay = PROFILE_RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        if (profileRetry.current) clearTimeout(profileRetry.current);
        profileRetry.current = setTimeout(() => {
          void fetchProfile(userId, userData, attempt + 1);
        }, delay);
        return;
      }
      // Out of retries. Flag it so `profile === null` stops being mistaken for
      // "signed out", and capture it — a stranded session drops every game the
      // user finishes, so the next occurrence must be evidence, not silence.
      setProfileError(true);
      reportRejectedWrite('auth fetchProfile', error);
      return;
    }

    // No profile exists — auto-create for OAuth users
    const u = userData;
    if (!u) return;

    const avatarUrl = u.user_metadata?.avatar_url || u.user_metadata?.picture || null;

    // Generate anonymous default username — never expose real names
    let newProfile = null;
    let lastInsertErr: any = null;
    for (let tries = 0; tries < 3; tries++) {
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
      lastInsertErr = insertErr;
      // 23505 = unique violation — retry with new suffix
      if (insertErr?.code !== '23505') break;
    }

    if (newProfile) {
      setProfileError(false);
      setProfile(newProfile as Profile);
    } else {
      // Same stranded-session consequence as a failed read: signed in, no
      // profile, every finished game dropped. Flag and report it.
      setProfileError(true);
      reportRejectedWrite('auth fetchProfile create', lastInsertErr ?? new Error('profile insert returned no row'));
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

    // Presence stamp: version/platform/last-seen, once per page load. Fire and
    // forget — visibility instrumentation must never block auth. Guarded by a
    // module flag so getSession + onAuthStateChange don't double-write.
    const stampPresence = (userId: string, wasGuest: boolean) => {
      if (presenceStamped) return;
      presenceStamped = true;
      const patch: Record<string, unknown> = {
        app_version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
        app_platform: 'web',
        last_seen_at: new Date().toISOString(),
      };
      // Guest→account conversion: this runs exactly where the guest flag is
      // superseded by a real session, which is the conversion moment for both
      // email and OAuth signups on this browser. (An email confirmation opened
      // in a DIFFERENT browser won't see the flag — accepted gap.)
      if (wasGuest) patch.converted_from_guest = true;
      (supabase as any).from('profiles').update(patch).eq('id', userId).then(() => {}, () => {});
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // A real session supersedes guest mode.
          const wasGuest = (() => { try { return localStorage.getItem('wordocious-guest') === '1'; } catch { return false; } })();
          try { localStorage.removeItem('wordocious-guest'); } catch {}
          stampPresence(session.user.id, wasGuest);
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
        // Mirror the access token into a cookie for the /admin middleware and
        // the verifyAdmin cookie fallback. supabase-js keeps the session in
        // localStorage, which the server can never see — this cookie is the
        // ONLY thing that lets a server-side gate recognize a signed-in user.
        // Without it /admin bounced every admin, always (found 2026-08-01 when
        // Jasson — role=admin — reported being redirected home). The name must
        // contain "auth-token": both server-side readers match on that.
        // Not httpOnly by necessity (set from JS), same exposure class as the
        // localStorage session itself. autoRefreshToken keeps it fresh via
        // TOKEN_REFRESHED events while any tab is open.
        try {
          if (session?.access_token) {
            document.cookie = 'wr-auth-token=' + session.access_token +
              '; path=/; max-age=3600; secure; samesite=lax';
          } else {
            document.cookie = 'wr-auth-token=; path=/; max-age=0; secure; samesite=lax';
          }
        } catch {}
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const wasGuest = (() => { try { return localStorage.getItem('wordocious-guest') === '1'; } catch { return false; } })();
          try { localStorage.removeItem('wordocious-guest'); } catch {}
          setIsGuest(false);
          stampPresence(session.user.id, wasGuest);
          await fetchProfile(session.user.id, session.user);
        } else {
          setProfile(null);
          setProfileError(false);
        }
        setLoading(false);
      })();
    });

    return () => {
      subscription.unsubscribe();
      if (profileRetry.current) clearTimeout(profileRetry.current);
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      // Pass the username as user metadata; the DB trigger handle_new_user()
      // creates the profiles row (SECURITY DEFINER, bypassing RLS). We do NOT
      // insert the profile client-side — with email confirmation on there's no
      // session yet, so the insert would fail the profiles RLS policy.
      // A pending referral code rides along in metadata too — the wr_ref
      // cookie won't survive an email-confirmation link opened in a
      // different browser, but user_metadata will.
      const referralCode = typeof document !== 'undefined'
        ? document.cookie.match(/(?:^|;\s*)wr_ref=([A-Z2-9]+)/)?.[1]
        : undefined;
      // Confirmation links land on /auth/confirm — a branded page that
      // exchanges the code and signs the user in (and a path the native apps
      // claim, so phones with the app installed confirm in-app).
      const emailRedirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/confirm`
        : undefined;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: referralCode ? { username, referral_code: referralCode } : { username },
        },
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

  const resetPassword = async (email: string) => {
    try {
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}/auth/reset`
        : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem('wordocious-guest'); } catch {}
    // Purge per-account game state so the next session (a guest, or a different
    // account) never inherits this user's daily results. Without this, the
    // signed-out user's completions leaked into guest mode.
    try {
      sessionStorage.removeItem('wordocious-daily-completions');
      localStorage.removeItem('wordocious-propernoundle-daily');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('wordocious-session-')) localStorage.removeItem(k);
      }
    } catch {}
    if (profileRetry.current) clearTimeout(profileRetry.current);
    setIsGuest(false);
    setUser(null);
    setProfile(null);
    setProfileError(false);
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
        profileError,
        isGuest,
        enterGuest,
        exitGuest,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        resetPassword,
        updatePassword,
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
