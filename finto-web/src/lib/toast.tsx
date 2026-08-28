import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Toast { id: number; message: string; glyph: string; }

const ToastContext = createContext<((message: string, glyph?: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, glyph = '✓') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, glyph }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 3800);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-wrap" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast">
              <span className="glyph" aria-hidden="true">{toast.glyph}</span>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast must be used inside ToastProvider');
  return push;
}
