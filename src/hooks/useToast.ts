import { useSyncExternalStore } from 'react';
import type { ToastActionElement, ToastProps } from '../components/ui/toast';
import type { CelebrationEvent } from '../types/celebrations';

export type ToasterToast = ToastProps & {
  id: string;
  title?: string;
  description?: string;
  action?: ToastActionElement;
  celebration?: CelebrationEvent;
  onDismiss?: () => void;
};

type State = { toasts: ToasterToast[] };
type Action =
  | { type: 'ADD_TOAST'; toast: ToasterToast }
  | { type: 'UPDATE_TOAST'; id: string; toast: Partial<ToasterToast> }
  | { type: 'DISMISS_TOAST' | 'REMOVE_TOAST'; toastId?: string };

const priority = (item: ToasterToast) => item.variant === 'error' ? 2 : item.celebration?.kind === 'trophy' ? 1 : 0;

/** One visible item with a FIFO backlog; errors interrupt without deleting celebrations. */
export function reducer(state: State, action: Action): State {
  if (action.type === 'ADD_TOAST') {
    const existing = state.toasts.findIndex(item => item.id === action.toast.id);
    if (existing >= 0) return reducer(state, { type: 'UPDATE_TOAST', id: action.toast.id, toast: action.toast });
    const toasts = [...state.toasts];
    const firstWaiting = toasts.length ? 1 : 0;
    const aheadOf = priority(action.toast) === 2 && toasts.length && priority(toasts[0]) < 2 ? 0 : toasts.findIndex((item, index) =>
      index >= firstWaiting && priority(item) < priority(action.toast));
    toasts.splice(aheadOf < 0 ? toasts.length : aheadOf, 0, action.toast);
    return { toasts };
  }
  if (action.type === 'UPDATE_TOAST') {
    const toasts = state.toasts.map(item => item.id === action.id ? { ...item, ...action.toast } : item);
    const index = toasts.findIndex(item => item.id === action.id);
    const previous = state.toasts[index];
    if (index > 0 && toasts[index].open && priority(toasts[index]) > priority(previous)) {
      const [item] = toasts.splice(index, 1);
      const firstWaiting = priority(item) === 2 ? 0 : 1;
      const aheadOf = toasts.findIndex((waiting, waitingIndex) => waitingIndex >= firstWaiting && priority(waiting) < priority(item));
      toasts.splice(aheadOf < 0 ? toasts.length : aheadOf, 0, item);
    }
    return { toasts };
  }
  if (action.type === 'DISMISS_TOAST') return {
    toasts: state.toasts.map(item => !action.toastId || item.id === action.toastId ? { ...item, open: false } : item),
  };
  return { toasts: action.toastId ? state.toasts.filter(item => item.id !== action.toastId) : [] };
}

let count = 0;
let memoryState: State = { toasts: [] };
const listeners = new Set<() => void>();
const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach(listener => listener());
}

export function discardToast(id: string) {
  clearTimeout(removalTimers.get(id));
  removalTimers.delete(id);
  dispatch({ type: 'REMOVE_TOAST', toastId: id });
}

export function getToast(id: string) {
  return memoryState.toasts.find(item => item.id === id);
}

export function clearToasts() {
  removalTimers.forEach(timer => clearTimeout(timer));
  removalTimers.clear();
  dispatch({ type: 'REMOVE_TOAST' });
}

function dismiss(toastId?: string) {
  const items = memoryState.toasts.filter(item => item.open && (!toastId || item.id === toastId));
  dispatch({ type: 'DISMISS_TOAST', toastId });
  items.forEach(item => {
    item.onDismiss?.();
    clearTimeout(removalTimers.get(item.id));
    removalTimers.set(item.id, setTimeout(() => discardToast(item.id), 200));
  });
}

export function toast(props: Omit<ToasterToast, 'id'> & { id?: string }) {
  const id = props.id ?? `toast-${++count}`;
  clearTimeout(removalTimers.get(id));
  removalTimers.delete(id);
  dispatch({ type: 'ADD_TOAST', toast: {
    ...props, id, open: true,
    onOpenChange: open => { if (!open) dismiss(id); },
  } });
  return {
    id,
    dismiss: () => dismiss(id),
    update: (updates: Partial<ToasterToast>) => dispatch({ type: 'UPDATE_TOAST', id, toast: updates }),
  };
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => memoryState;

export function useToast() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...state, toast, dismiss };
}
