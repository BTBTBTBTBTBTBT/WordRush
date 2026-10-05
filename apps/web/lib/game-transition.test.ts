import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyRoute, waitForRoute } from './game-transition';

// Perf tour 10-05: inside a view transition's update callback the browser suppresses
// rendering, so requestAnimationFrame never fires until the callback settles. Waiting a
// frame there froze every game open / close for the full 1.5 s timeout.
describe('waitForRoute', () => {
  let frames: Array<() => void>;
  beforeEach(() => {
    vi.useFakeTimers();
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { frames.push(cb); return frames.length; });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('inside a view transition: resolves right after the route commits, with no frame', async () => {
    let done = false;
    waitForRoute('/propernoundle?daily=true', { inTransition: true }).then(() => { done = true; });
    notifyRoute('/propernoundle');
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(frames).toHaveLength(0);
  });

  it('fallback (no view transition): still waits one frame after the commit', async () => {
    let done = false;
    waitForRoute('/six', { inTransition: false }).then(() => { done = true; });
    notifyRoute('/six');
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(false);
    frames.forEach((f) => f());
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it('a route that never commits still lets go at the timeout', async () => {
    let done = false;
    waitForRoute('/seven', { inTransition: true }).then(() => { done = true; });
    notifyRoute('/six');
    await vi.advanceTimersByTimeAsync(1499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
