import { describe, expect, it } from 'vitest';
import { checkoutReturnUrl } from './go-pro-popup';

describe('Go Pro popup checkout return (FINISH_SPEC R3)', () => {
  it('lands on the Unlimited game after a purchase', () => {
    expect(checkoutReturnUrl('https://wordocious.com', 'https://wordocious.com/quadword?daily=true', '/quadword')).toBe('https://wordocious.com/quadword?purchase=success');
    expect(checkoutReturnUrl('https://wordocious.com', 'x', '/six?foo=1')).toBe('https://wordocious.com/six?foo=1&purchase=success');
  });
  it('never returns off-site', () => {
    expect(checkoutReturnUrl('https://wordocious.com', 'https://wordocious.com/pro', '//evil.example')).toBe('https://wordocious.com/pro');
    expect(checkoutReturnUrl('https://wordocious.com', 'https://wordocious.com/pro')).toBe('https://wordocious.com/pro');
  });
});
