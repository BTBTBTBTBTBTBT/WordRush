'use client';

/**
 * FINISH_SPEC AH → AN: the pick-a-character hero circles are retired. The ten
 * cast members are now one-tap PRESETS inside the mascot builder (core
 * castPreset), a stored AH pick (avatar_cast_id) renders as that preset, and
 * every avatar is drawn by the one renderer: components/avatar/mascot-avatar.tsx
 * (resolved per player by components/avatar/player-avatar.tsx). This module
 * only re-exports them for older imports.
 */
export { PlayerAvatar, usePlayerAvatar, type PlayerAvatarInput, type PlayerAvatarProps } from '@/components/avatar/player-avatar';
export { MascotAvatar, ProCrown, type MascotAvatarProps } from '@/components/avatar/mascot-avatar';
