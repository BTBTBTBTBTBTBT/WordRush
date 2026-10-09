import { describe, expect, it } from 'vitest';
import { changePhotoRows, displayAfter, pickShow, showsChangePhoto, showsPhoto } from './change-photo';

describe('change photo (cloud prompt 07)', () => {
  it('SHOW reads My photo only when picked AND a photo exists', () => {
    expect(showsPhoto('photo', true)).toBe(true);
    expect(showsPhoto('photo', false)).toBe(false);
    expect(showsPhoto('mascot', true)).toBe(false);
    expect(showsPhoto(null, true)).toBe(false);
  });

  it('the Change photo button + photo tap show only while the photo shows', () => {
    expect(showsChangePhoto('photo', true)).toBe(true);
    expect(showsChangePhoto('photo', false)).toBe(false);
    expect(showsChangePhoto('mascot', true)).toBe(false);
    expect(showsChangePhoto('mascot', false)).toBe(false);
  });

  it('My photo with no photo opens the menu instead of switching', () => {
    expect(pickShow('photo', false)).toEqual({ display: null, openMenu: true });
    expect(pickShow('photo', true)).toEqual({ display: 'photo', openMenu: false });
    expect(pickShow('mascot', false)).toEqual({ display: 'mascot', openMenu: false });
    expect(pickShow('mascot', true)).toEqual({ display: 'mascot', openMenu: false });
  });

  it('menu rows: camera when one exists, library always, remove when a photo is set', () => {
    expect(changePhotoRows(true, true)).toEqual(['camera', 'library', 'remove']);
    expect(changePhotoRows(true, false)).toEqual(['camera', 'library']);
    expect(changePhotoRows(false, true)).toEqual(['library', 'remove']);
    expect(changePhotoRows(false, false)).toEqual(['library']);
  });

  it('upload → My photo; remove → My mascot', () => {
    expect(displayAfter('uploaded')).toBe('photo');
    expect(displayAfter('removed')).toBe('mascot');
  });
});
