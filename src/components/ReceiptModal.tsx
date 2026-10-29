import React from 'react';
import { Printer, CheckCircle2, X } from 'lucide-react';
import type { Sale, SaleItem } from '../types';
import { formatRupiah, formatDateIndo, formatQty } from '../utils/format';
import { getStoreSettings } from '../db';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  items: SaleItem[];
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  items,
}) => {
  if (!isOpen || !sale) return null;

  const settings = getStoreSettings();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-card w-full max-w-md rounded-3xl p-6 shadow-modal border-2 border-cream-300 relative my-6">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-cream-200">
          <div className="flex items-center gap-2 text-status-successText font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-status-successText" />
            <span>Transaksi Berhasil Disimpan</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div
          id="thermal-receipt"
          className="my-5 p-5 bg-white rounded-2xl border border-cream-300 shadow-inner font-mono text-xs text-black"
        >
          {/* Header Toko */}
          <div className="text-center pb-3 border-b border-dashed border-gray-400">
            <h2 className="text-base font-extrabold uppercase tracking-wider">{settings.storeName}</h2>
            <p className="text-[11px] text-gray-600 mt-0.5">{settings.storeAddress}</p>
            <p className="text-[11px] text-gray-600">Telp: {settings.storePhone}</p>
          </div>

          {/* Meta Info */}
          <div className="py-2.5 text-[11px] space-y-1 border-b border-dashed border-gray-400">
            <div className="flex justify-between">
              <span>No. Nota:</span>
              <span className="font-bold">{sale.receipt_number}</span>
            </div>
            <div className="flex justify-between">
              <span>Tanggal:</span>
              <span>{formatDateIndo(sale.transaction_date)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kasir:</span>
              <span>{sale.cashier_name}</span>
            </div>
            <div className="flex justify-between">
              <span>Metode Bayar:</span>
              <span className="font-bold">{sale.payment_method}</span>
            </div>
          </div>

          {/* Daftar Barang */}
          <div className="py-3 border-b border-dashed border-gray-400 space-y-2">
            {items.map((item, index) => (
              <div key={index} className="text-[11px]">
                <div className="font-semibold text-gray-900">{item.product_name}</div>
                <div className="flex justify-between text-gray-600">
                  <span>
                    {formatQty(item.quantity)} {item.unit ? `${item.unit} ` : ''}x {formatRupiah(item.unit_price)}
                  </span>
                  <span className="font-bold text-gray-900">{formatRupiah(item.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Total & Pembayaran */}
          <div className="py-2.5 space-y-1.5 border-b border-dashed border-gray-400">
            <div className="flex justify-between text-sm font-extrabold text-gray-900">
              <span>TOTAL BELANJA:</span>
              <span>{formatRupiah(sale.total_amount)}</span>
            </div>

            {sale.payment_method === 'TUNAI' && (
              <>
                <div className="flex justify-between text-[11px]">
                  <span>Uang Diterima:</span>
                  <span>{formatRupiah(sale.cash_received)}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold text-gray-900">
                  <span>KEMBALIAN:</span>
                  <span>{formatRupiah(sale.change_given)}</span>
                </div>
              </>
            )}

            {sale.payment_method === 'QRIS' && (
              <div className="flex justify-between text-[11px] text-gray-600">
                <span>Status QRIS:</span>
                <span className="font-semibold text-emerald-700">LUNAS (Statis)</span>
              </div>
            )}

            {sale.payment_method === 'TRANSFER' && (
              <div className="flex justify-between text-[11px] text-gray-600">
                <span>Status Transfer:</span>
                <span className="font-semibold text-blue-700">LUNAS</span>
              </div>
            )}
          </div>

          {/* Footer Struk */}
          <div className="pt-3 text-center text-[10px] text-gray-500 space-y-1">
            <p>{settings.receiptFooter}</p>
            <p className="italic">Barang yang sudah dibeli tidak dapat ditukar.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handlePrint}
            className="w-full py-3.5 px-4 bg-amber hover:bg-amber-hover text-forest font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all transform active:scale-[0.98] text-base"
          >
            <Printer className="w-5 h-5 text-forest" />
            Cetak Struk Thermal (58mm / 80mm)
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-cream-200 hover:bg-cream-300 text-ink font-bold rounded-2xl transition-colors text-sm"
          >
            Selesai & Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
};
