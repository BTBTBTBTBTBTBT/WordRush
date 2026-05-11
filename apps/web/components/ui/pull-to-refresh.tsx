'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  accentColor?: string;
}

const THRESHOLD = 60;
const MAX_PULL = 100;

export function PullToRefresh({ onRefresh, children, accentColor = '#7c3aed' }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta < 0) {
      setPullDistance(0);
      return;
    }
    const dampened = Math.min(delta * 0.4, MAX_PULL);
    setPullDistance(dampened);
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-all"
        style={{
          height: pullDistance > 0 || refreshing ? `${Math.max(pullDistance, refreshing ? 36 : 0)}px` : '0px',
          transition: pulling.current ? 'none' : 'height 0.2s ease-out',
        }}
      >
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent"
          style={{
            borderColor: accentColor,
            borderTopColor: 'transparent',
            opacity: progress,
            transform: `rotate(${progress * 360}deg)`,
            animation: refreshing ? 'spin 0.6s linear infinite' : 'none',
          }}
        />
      </div>
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.1}px)` : 'none',
          transition: pulling.current ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
