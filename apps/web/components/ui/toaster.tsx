'use client';

import { useToast } from '@/hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  toastAccent,
} from '@/components/ui/toast';
import { PoseArt } from '@/components/ui/soft-popup';
import { cardBarStyle } from '@/lib/soft-surface';
import type { PoseArtName } from '@/lib/art';

// K1 / G5: each toast is a tinted card in its event's color with the top bar,
// a small cast pose that fits the event (I giggling for good news, D the
// skeptic for an error — A7: secondary characters, never a page's hero
// image), the Nunito Black headline, the candy action and the bare close X.
// The toast API (hooks/use-toast) and every call site are unchanged.

const TOAST_POSE: Record<'default' | 'destructive', PoseArtName> = {
  default: 'art-pose-i-giggle',
  destructive: 'art-pose-d-skeptic',
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const kind = props.variant === 'destructive' ? 'destructive' : 'default';
        return (
          <Toast key={id} {...props}>
            <div aria-hidden="true" className="absolute left-0 right-0 top-0" style={cardBarStyle(toastAccent(kind), 6)} />
            <PoseArt pose={TOAST_POSE[kind]} size={44} className="self-center" />
            <div className="grid gap-1 flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
