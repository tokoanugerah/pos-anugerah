import React from 'react';
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  FileEdit,
  X,
  AlertCircle,
} from 'lucide-react';
import { playKeyClick } from '../utils/sound';

export type ActionModalType = 'delete' | 'edit' | 'warning' | 'info';

export interface DetailItem {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}

export interface ActionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: ActionModalType;
  title: string;
  description?: string;
  details?: DetailItem[];
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export const ActionConfirmModal: React.FC<ActionConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type = 'delete',
  title,
  description,
  details = [],
  confirmText,
  cancelText = 'Batal',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const handleCancel = () => {
    playKeyClick();
    onClose();
  };

  const handleConfirm = () => {
    playKeyClick();
    onConfirm();
  };

  const getHeaderIcon = () => {
    switch (type) {
      case 'delete':
        return (
          <div className="w-12 h-12 rounded-2xl bg-status-dangerBg text-status-dangerText flex items-center justify-center flex-shrink-0 border border-status-dangerText/20 shadow-sm">
            <Trash2 className="w-6 h-6 stroke-[2.5]" />
          </div>
        );
      case 'edit':
        return (
          <div className="w-12 h-12 rounded-2xl bg-amber-light text-forest flex items-center justify-center flex-shrink-0 border border-amber/40 shadow-sm">
            <FileEdit className="w-6 h-6 stroke-[2.5]" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-12 h-12 rounded-2xl bg-status-warningBg text-status-warningText flex items-center justify-center flex-shrink-0 border border-status-warningText/20 shadow-sm">
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-forest-surface text-forest flex items-center justify-center flex-shrink-0 border border-forest/20 shadow-sm">
            <AlertCircle className="w-6 h-6 stroke-[2.5]" />
          </div>
        );
    }
  };

  const defaultConfirmText =
    confirmText ||
    (type === 'delete'
      ? 'Ya, Hapus Data'
      : type === 'edit'
      ? 'Ya, Simpan Perubahan'
      : 'Konfirmasi');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-card w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-modal border-2 border-cream-300 relative my-6 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-5 right-5 p-2 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink transition-colors"
          title="Tutup dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4 pr-10">
          {getHeaderIcon()}
          <div>
            <h3 className="text-xl font-black text-ink leading-tight">{title}</h3>
            {description && (
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Details Card showing WHAT is being deleted or edited */}
        {details && details.length > 0 && (
          <div className="mt-5 p-4 rounded-2xl bg-cream-50 border border-cream-300 space-y-2.5">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-subtle">
              {type === 'delete' ? 'Rincian Data yang Akan Dihapus:' : 'Rincian Konfirmasi Perubahan:'}
            </p>
            <div className="space-y-1.5 divide-y divide-cream-200">
              {details.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-baseline justify-between pt-1.5 text-xs sm:text-sm ${
                    idx === 0 ? 'pt-0' : ''
                  }`}
                >
                  <span className="text-ink-muted font-bold flex-shrink-0 pr-3">
                    {item.label}
                  </span>
                  <span
                    className={`text-right font-semibold break-all ${
                      item.highlight
                        ? type === 'delete'
                          ? 'font-black text-status-dangerText font-mono'
                          : 'font-black text-forest font-mono'
                        : 'text-ink'
                    }`}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning Callout for Deletion */}
        {type === 'delete' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-dangerText font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Tindakan ini permanen dan tidak dapat dibatalkan setelah dikonfirmasi.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-cream-200">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink font-bold text-sm transition-all"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-black transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 ${
              type === 'delete'
                ? 'bg-status-dangerText hover:bg-red-700 text-white shadow-md'
                : 'bg-amber hover:bg-amber-hover text-forest shadow-md'
            }`}
          >
            {type === 'delete' ? (
              <Trash2 className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            )}
            <span>{defaultConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
