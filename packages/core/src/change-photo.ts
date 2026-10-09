// Change Photo on Edit Profile's Stage (cloud prompt 07, 2026-10-06): players couldn't replace or remove a
// photo once one existed. Pure rules so web, iOS (Core/ChangePhoto.swift) and Android (core/ChangePhoto.kt)
// show the same button, open the same menu and land on the same SHOW choice.

export type ShowChoice = 'mascot' | 'photo';
export type ChangePhotoRow = 'camera' | 'library' | 'remove';

/** "My photo" is what SHOW reads only when the player picked it AND has a photo. */
export function showsPhoto(display: string | null | undefined, hasPhoto: boolean): boolean {
  return display === 'photo' && hasPhoto;
}

/** The quiet "Change photo" button under SHOW, and the Stage's photo being tappable: only while the photo shows. */
export function showsChangePhoto(display: string | null | undefined, hasPhoto: boolean): boolean {
  return showsPhoto(display, hasPhoto);
}

/**
 * Picking a SHOW option. "My photo" with no photo yet keeps the current look and opens the Change Photo menu
 * instead (the photo shows once one is uploaded); anything else just switches.
 */
export function pickShow(choice: ShowChoice, hasPhoto: boolean): { display: ShowChoice | null; openMenu: boolean } {
  if (choice === 'photo' && !hasPhoto) return { display: null, openMenu: true };
  return { display: choice, openMenu: false };
}

/** The Change Photo menu's rows, in order: Take photo (a camera exists), Choose from library, Remove photo (one is set). */
export function changePhotoRows(hasCamera: boolean, hasPhoto: boolean): ChangePhotoRow[] {
  const rows: ChangePhotoRow[] = [];
  if (hasCamera) rows.push('camera');
  rows.push('library');
  if (hasPhoto) rows.push('remove');
  return rows;
}

/** SHOW after a menu result: a new photo shows; a removed photo falls back to the mascot. */
export function displayAfter(result: 'uploaded' | 'removed'): ShowChoice {
  return result === 'uploaded' ? 'photo' : 'mascot';
}
