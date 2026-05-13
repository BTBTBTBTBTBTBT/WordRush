'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  saveSubscription,
  removeSubscription,
  getExistingSubscription,
} from '@/lib/push-notifications';
import { toast } from '@/hooks/use-toast';

export function NotificationToggle() {
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const supported = isPushSupported();

  useEffect(() => {
    if (!supported) { setLoading(false); return; }
    getExistingSubscription().then((sub) => {
      setEnabled(!!sub);
      setLoading(false);
    });
  }, [supported]);

  if (!supported || !profile) return null;

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        await removeSubscription(profile.id);
        setEnabled(false);
        toast({ title: 'Notifications disabled' });
      } else {
        const permission = getNotificationPermission();
        if (permission === 'denied') {
          toast({
            title: 'Notifications blocked',
            description: 'Enable notifications in your browser settings.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        const sub = await subscribeToPush();
        if (!sub) {
          toast({ title: 'Could not enable notifications', variant: 'destructive' });
          setLoading(false);
          return;
        }
        await saveSubscription(profile.id, sub);
        setEnabled(true);
        toast({ title: 'Daily reminders enabled!' });
      }
    } catch {
      toast({ title: 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="w-full flex items-center gap-3 p-4 transition-colors active:scale-[0.98] disabled:opacity-50"
      style={{
        background: 'var(--color-surface)',
        border: `1.5px solid ${enabled ? '#c4b5fd' : 'var(--color-border)'}`,
        borderRadius: '16px',
      }}
    >
      {enabled ? (
        <Bell className="w-5 h-5" style={{ color: '#7c3aed' }} />
      ) : (
        <BellOff className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
      )}
      <span className="flex-1 text-left text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
        Daily Reminders
      </span>
      <span
        className="text-[10px] font-black px-2 py-0.5 rounded-full"
        style={{
          background: enabled ? '#f3f0ff' : 'var(--color-surface-hover)',
          color: enabled ? '#7c3aed' : 'var(--color-text-muted)',
        }}
      >
        {loading ? '...' : enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
