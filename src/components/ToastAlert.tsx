import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X, Trash2 } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'delete' | 'warning' | 'info';
  title: string;
  description?: string;
}

interface ToastAlertProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastAlert: React.FC<ToastAlertProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isDelete = toast.type === 'delete';
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-elevated border flex items-start justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200 ${
              isDelete
                ? 'bg-card border-red-300 text-ink ring-1 ring-red-400/30'
                : isSuccess
                ? 'bg-card border-emerald-300 text-ink ring-1 ring-emerald-400/30'
                : isWarning
                ? 'bg-card border-amber text-ink ring-1 ring-amber/40'
                : 'bg-card border-cream-300 text-ink'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isDelete
                    ? 'bg-status-dangerBg text-status-dangerText'
                    : isSuccess
                    ? 'bg-status-successBg text-status-successText'
                    : isWarning
                    ? 'bg-amber-light text-amber-dark'
                    : 'bg-forest-surface text-forest'
                }`}
              >
                {isDelete ? (
                  <Trash2 className="w-5 h-5" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isWarning ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0">
                <h5 className="font-extrabold text-sm text-ink truncate leading-tight">
                  {toast.title}
                </h5>
                {toast.description && (
                  <p className="text-xs text-ink-muted mt-0.5 leading-snug break-words">
                    {toast.description}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-ink-subtle hover:text-ink p-1 rounded-lg hover:bg-cream-100 transition-colors flex-shrink-0"
              title="Tutup pemberitahuan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
