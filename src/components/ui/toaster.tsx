import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './toast';
import { useToast } from '../../hooks/useToast';
import { usePopupAvailability } from '../../hooks/usePopupAvailability';
import { TimerStoppedContent } from '../celebrations/TimerStoppedContent';
import { TrophyEarnedContent } from '../celebrations/TrophyEarnedContent';
import { Link } from 'react-router-dom';
import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../store';

export function Toaster() {
  const { toasts } = useToast();
  const fullMotion = useStore(state => state.fullCelebrationMotion);
  const canShow = usePopupAvailability();
  const visible = canShow ? toasts.slice(0, 1) : [];
  const current = visible[0];
  const previous = useRef<typeof current>();
  const root = useRef<HTMLLIElement | null>(null);
  const restoreFocus = useRef<string>();
  const popupRef = useCallback((node: HTMLLIElement | null) => {
    if (!node) {
      if (root.current?.contains(document.activeElement)) restoreFocus.current = root.current.dataset.popupId;
      root.current = null;
      return;
    }
    root.current = node;
    if (restoreFocus.current === node.dataset.popupId) {
      node.querySelector<HTMLButtonElement>('[toast-close]')?.focus({ preventScroll: true });
    }
    restoreFocus.current = undefined;
  }, []);
  useEffect(() => { if (current) previous.current = current; }, [current]);

  return (
    <ToastProvider>
      {visible.map(function ({ id, title, description, action, celebration, onDismiss: _onDismiss, ...props }) {
        // Queue metadata must not be forwarded to the Radix DOM element.
        void _onDismiss;
        const animationVariant = celebration?.kind === 'trophy' ? 'trophy' : 'timer';
        const entrance = previous.current?.id !== id || previous.current?.celebration?.kind !== celebration?.kind;
        return (
          <Toast key={`${id}:${celebration?.kind ?? 'default'}:${celebration?.saveState ?? ''}`} ref={popupRef}
            {...props} animationVariant={animationVariant} data-celebration={celebration?.kind} data-popup-id={id} data-entrance={entrance}
            data-full-motion={fullMotion && (celebration?.kind === 'timer' || celebration?.kind === 'trophy')}>
            {celebration?.kind === 'timer' ? <TimerStoppedContent event={celebration} />
              : celebration?.kind === 'trophy' ? <TrophyEarnedContent event={celebration} />
              : celebration?.kind === 'error' ? <div className="min-w-0 space-y-2">
                <ToastTitle>Time could not be saved</ToastTitle>
                <ToastDescription className="break-words">{celebration.goalName} · {celebration.error} Your progress is only recorded locally.</ToastDescription>
                <Link to="/goals" className="inline-block text-sm font-medium underline">Go to Goals to retry Save</Link>
              </div>
              : celebration?.kind === 'completed' ? <div className="min-w-0 space-y-1">
                <ToastTitle>Goal Completed!</ToastTitle>
                <ToastDescription className="break-words">Congratulations on completing “{celebration.goalName}”! You can find it in Completed Goals.</ToastDescription>
              </div>
              : <div className="min-w-0 grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>}
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
