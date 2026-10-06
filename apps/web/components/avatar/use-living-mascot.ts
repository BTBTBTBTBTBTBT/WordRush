'use client';

import * as React from 'react';
import { avatarLiveFrame, type AvatarConfig, type AvatarReaction } from '@wordle-duel/core';
import { avatarLiveLayout, avatarLiveTransforms, isSmallAvatar } from '@/lib/avatar-render';
import { BODY_LAUGH, MASCOT_MOMENT_EVENT, bodyLaughRate, claimLivingSlot } from '@/lib/living-mascot';
import { prefersReducedMotion } from '@/lib/motion';
import { playSound } from '@/lib/sounds';
import { laughSound } from '@/lib/sound-map';
import { haptic } from '@/lib/haptics';

/**
 * Drives one living mascot: the svg inside `ref` was drawn with mascotSvg({ live: true }) (every group marked
 * data-lm); each frame re-poses those groups from core avatarLiveFrame. Tap = hop + laugh, press-and-hold = squish,
 * `follow` = the eyes follow the finger, moments (emitMascotMoment) = reactions. Pauses offscreen / in hidden tabs;
 * Reduce Motion holds the pose (a tap only shows the laugh). Only while `enabled` (the flag + a live svg).
 */
export function useLivingMascot(ref: React.RefObject<HTMLElement>, { config, size, frameWidth, enabled, own = true, follow = false, markup }: {
  config: AvatarConfig; size: number; frameWidth: number; enabled: boolean; own?: boolean; follow?: boolean; markup: string;
}) {
  const layout = React.useMemo(() => (enabled ? avatarLiveLayout(config, isSmallAvatar(size)) : null), [enabled, config, size]);
  React.useEffect(() => {
    const host = ref.current;
    if (!enabled || !host || !layout) return;
    const groups = Array.from(host.querySelectorAll<SVGGElement>('g[data-lm]'));
    if (!groups.length) return;
    const C = 100 - 2 * frameWidth;
    const still = prefersReducedMotion();
    const seed = (config.body.length * 977 + config.color.length * 131) % 233280;
    const t0 = performance.now();
    let tapAt: number | null = null;
    let reaction: { kind: AvatarReaction; at: number } | null = null;
    let press = 0, pressing = false;
    let look: [number, number] = [0, 0];
    let raf = 0, visible = true, slot = false, alive = true;
    const now = () => (performance.now() - t0) / 1000;
    const draw = () => {
      const t = now();
      const tap = tapAt === null ? null : t - tapAt;
      const f = avatarLiveFrame({
        pose: config.pose ?? 'none', t, tap, still, press, blinkSeed: seed,
        reaction: reaction ? { kind: reaction.kind, t: t - reaction.at } : null,
      });
      const tf = avatarLiveTransforms(layout, config, f, C, frameWidth, look);
      for (const g of groups) { const v = tf[g.dataset.lm ?? 'root']; if (v) g.setAttribute('transform', v); }
      if (tap !== null && tap > 1.2) tapAt = null;
      if (reaction && t - reaction.at > 3) reaction = null;
    };
    const busy = () => tapAt !== null || reaction !== null || pressing || press > 0.01;
    const loop = () => {
      raf = 0;
      if (!alive) return;
      press += ((pressing ? 1 : 0) - press) * 0.25;
      draw();
      // Reduce Motion: frames only while a tap's laugh plays; otherwise every frame while on screen
      if (visible && (still ? busy() : slot)) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && alive && visible) raf = requestAnimationFrame(loop); };
    const release = still ? () => {} : claimLivingSlot(host, own, () => { slot = true; kick(); });
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting) && document.visibilityState === 'visible'; if (visible) kick(); }) : null;
    io?.observe(host);
    const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) kick(); };
    document.addEventListener('visibilitychange', onVis);
    const onDown = () => { pressing = true; kick(); };
    const onUp = () => {
      if (!pressing) return;
      pressing = false;
      tapAt = now();
      const name = laughSound(BODY_LAUGH[config.body] ?? 'w');
      if (name) playSound(name, { rate: bodyLaughRate(config.body) });
      haptic('light');
      kick();
    };
    const onCancel = () => { pressing = false; };
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointerleave', onCancel);
    host.addEventListener('pointercancel', onCancel);
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.4;
      look = [Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 1.5))), Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 1.5)))];
      if (still) draw();
    };
    if (follow) window.addEventListener('pointermove', onMove, { passive: true });
    const onMoment = (e: Event) => {
      const kind = (e as CustomEvent<{ kind: AvatarReaction }>).detail?.kind;
      if (!kind || still) return;
      reaction = { kind, at: now() };
      kick();
    };
    if (own) window.addEventListener(MASCOT_MOMENT_EVENT, onMoment);
    draw();
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      release();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointerleave', onCancel);
      host.removeEventListener('pointercancel', onCancel);
      if (follow) window.removeEventListener('pointermove', onMove);
      if (own) window.removeEventListener(MASCOT_MOMENT_EVENT, onMoment);
    };
    // the svg markup changing means new groups: re-bind
  }, [enabled, layout, markup, frameWidth, own, follow, config, ref]);
}
