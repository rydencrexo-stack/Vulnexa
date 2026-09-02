"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "danger" | "info";
interface Toast { id: string; title: string; description?: string; tone: ToastTone }
interface ToastContextValue { toast: (toast: Omit<Toast, "id">) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: string) => setToasts((current) => current.filter((item) => item.id !== id)), []);
  const toast = useCallback((input: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-3), { ...input, id }]);
    window.setTimeout(() => dismiss(id), 4_500);
  }, [dismiss]);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pan-toast-region">
        {toasts.map((item) => {
          const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "danger" ? AlertCircle : Info;
          return (
            <div className={`pan-toast pan-toast-${item.tone}`} key={item.id} role="status">
              <Icon size={19} />
              <div><strong>{item.title}</strong>{item.description ? <p>{item.description}</p> : null}</div>
              <button aria-label="Dismiss notification" onClick={() => dismiss(item.id)}><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
