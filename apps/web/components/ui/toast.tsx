'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { candyClass } from '@/components/ui/candy-button';
import { softBackground, softBorder, alphaHex } from '@/lib/soft-surface';

// Toasts in the new look (docs/FINISH_SPEC.md K1 / G5; A1 no plain white): a
// tinted card in the event's color (brand purple, a soft rose for errors) with
// its top bar (drawn by components/ui/toaster.tsx), Nunito Black headline, a
// candy action button and an always-visible bare close X. Slides in with a
// spring (off with Reduce Motion: globals.css stills every animation) and
// swipes away (Radix swipe). Same primitives and API.

/** The accent a toast variant wears. */
export function toastAccent(variant: 'default' | 'destructive' | null | undefined): string {
  return variant === 'destructive' ? '#e11d48' : '#7c3aed';
}

/** A toast's tinted surface. */
export function toastSurface(variant: 'default' | 'destructive' | null | undefined): React.CSSProperties {
  const accent = toastAccent(variant);
  return {
    background: softBackground(accent, 0.13),
    border: softBorder(accent, 0.13),
    boxShadow: `0 12px 28px ${alphaHex(accent, 0.22)}, 0 2px 6px rgba(40, 15, 80, 0.12)`,
  };
}

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[20px] p-3 pt-4 pr-10 transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=open]:duration-500 data-[state=open]:[animation-timing-function:cubic-bezier(0.3,1.45,0.5,1)] data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'text-foreground',
        destructive:
          'destructive group text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
      style={{ ...toastSurface(variant), ...props.style }}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(candyClass({ color: 'purple', size: 'sm' }), 'shrink-0 self-center', className)}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'hdr-glyph absolute right-1 top-2 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
      className
    )}
    style={{ width: 32, height: 32 }}
    aria-label="Close"
    toast-close=""
    {...props}
  >
    <X aria-hidden="true" style={{ width: 18, height: 18, color: 'var(--color-win-text, #7c3aed)', filter: 'drop-shadow(0 2px 3px rgba(76, 29, 149, 0.2))' }} strokeWidth={3.2} />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('font-black leading-tight', className)}
    style={{ fontSize: 15, color: 'var(--color-text)' }}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-xs font-bold leading-snug', className)}
    style={{ color: 'var(--color-text-muted)' }}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
