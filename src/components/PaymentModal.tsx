import React, { useState } from 'react';
import { Banknote, QrCode, Building2, Check, AlertCircle, X, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { CartItem, PaymentMethod, Sale, SaleItem } from '../types';
import { formatRupiah, generateReceiptNumber, generateId } from '../utils/format';
import { playCashChime, playErrorBeep, playKeyClick } from '../utils/sound';
import { getStoreSettings } from '../db';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalAmount: number;
  totalCost: number;
  onPaymentSuccess: (sale: Sale, saleItems: SaleItem[]) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  totalAmount,
  totalCost,
  onPaymentSuccess,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('TUNAI');
  const [cashReceived, setCashReceived] = useState<number>(totalAmount);
  const [notes, setNotes] = useState<string>('');
  const [customCashInput, setCustomCashInput] = useState<string>(String(totalAmount));

  if (!isOpen) return null;

  const change = Math.max(0, cashReceived - totalAmount);
  const isUnderpaid = method === 'TUNAI' && cashReceived < totalAmount;
  const settings = getStoreSettings();

  // Quick denomination suggestions tailored to total amount
  const getQuickDenominations = (total: number) => {
    const list = new Set<number>();
    list.add(total); // Uang pas

    const denominations = [10000, 20000, 50000, 100000, 200000, 500000];
    for (const d of denominations) {
      if (d >= total) {
        list.add(d);
      }
    }
    // Also next rounded 10k/50k
    const next10k = Math.ceil(total / 10000) * 10000;
    const next50k = Math.ceil(total / 50000) * 50000;
    list.add(next10k);
    list.add(next50k);

    return Array.from(list).sort((a, b) => a - b).slice(0, 6);
  };

  const quickAmounts = getQuickDenominations(totalAmount);

  const handleSelectQuickCash = (amount: number) => {
    playKeyClick();
    setCashReceived(amount);
    setCustomCashInput(String(amount));
  };

  const handleCustomCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    const num = Number(rawVal) || 0;
    setCustomCashInput(rawVal);
    setCashReceived(num);
  };

  const handleSubmit = () => {
    if (isUnderpaid) {
      playErrorBeep();
      return;
    }

    const saleId = generateId('sale');
    const receiptNum = generateReceiptNumber();
    const nowIso = new Date().toISOString();

    const sale: Sale = {
      id: saleId,
      receipt_number: receiptNum,
      transaction_date: nowIso,
      total_amount: totalAmount,
      total_cost: totalCost,
      gross_profit: totalAmount - totalCost,
      payment_method: method,
      cash_received: method === 'TUNAI' ? cashReceived : totalAmount,
      change_given: method === 'TUNAI' ? change : 0,
      cashier_name: settings.cashierName || 'Kasir Anugerah Store',
      notes: notes.trim() || undefined,
    };

    const saleItems: SaleItem[] = cartItems.map((c) => ({
      id: generateId('item'),
      sale_id: saleId,
      product_id: c.product.id,
      product_name: c.product.name,
      quantity: c.quantity,
      unit_cost: c.product.cost_price,
      unit_price: c.product.selling_price,
      subtotal: c.subtotal,
      subtotal_cost: c.product.cost_price * c.quantity,
      subtotal_profit: c.subtotal - c.product.cost_price * c.quantity,
    }));

    // Audio & Confetti Celebration
    playCashChime();
    confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#F7CA58', '#084C46', '#FFFFFF', '#106B63'],
    });

    onPaymentSuccess(sale, saleItems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-card w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-modal border-2 border-cream-300 relative my-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cream-200">
          <div>
            <span className="text-xs font-bold text-forest tracking-wider uppercase bg-forest-surface px-3 py-1 rounded-full">
              Layar Pembayaran
            </span>
            <h2 className="text-2xl font-extrabold text-ink mt-1">Pembayaran Pesanan</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Total Belanja Display Banner */}
        <div className="mt-5 p-5 bg-cream-100 rounded-3xl border border-cream-300 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink-muted">TOTAL WAJIB DIBAYAR</p>
            <p className="text-3xl md:text-4xl font-extrabold text-forest mt-0.5 tracking-tight font-mono">
              {formatRupiah(totalAmount)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-ink-muted bg-white border border-cream-300 px-3 py-1 rounded-xl">
              {cartItems.length} Ragam Barang ({cartItems.reduce((acc, c) => acc + c.quantity, 0)} Total Pcs)
            </span>
          </div>
        </div>

        {/* Pilih Metode Pembayaran (Large Ergonomic Buttons) */}
        <div className="mt-6">
          <label className="text-sm font-bold text-ink mb-2 block">
            1. Pilih Cara Bayar:
          </label>
          <div className="grid grid-cols-3 gap-3">
            {/* TUNAI */}
            <button
              type="button"
              onClick={() => {
                playKeyClick();
                setMethod('TUNAI');
                setCashReceived(totalAmount);
                setCustomCashInput(String(totalAmount));
              }}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all min-h-[72px] ${
                method === 'TUNAI'
                  ? 'border-forest bg-forest text-white shadow-elevated'
                  : 'border-cream-300 bg-white hover:bg-cream-100 text-ink'
              }`}
            >
              <Banknote className={`w-7 h-7 ${method === 'TUNAI' ? 'text-amber' : 'text-forest'}`} />
              <span className="font-extrabold text-base">UANG TUNAI</span>
            </button>

            {/* QRIS */}
            <button
              type="button"
              onClick={() => {
                playKeyClick();
                setMethod('QRIS');
                setCashReceived(totalAmount);
              }}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all min-h-[72px] ${
                method === 'QRIS'
                  ? 'border-forest bg-forest text-white shadow-elevated'
                  : 'border-cream-300 bg-white hover:bg-cream-100 text-ink'
              }`}
            >
              <QrCode className={`w-7 h-7 ${method === 'QRIS' ? 'text-amber' : 'text-forest'}`} />
              <span className="font-extrabold text-base">QRIS STATIS</span>
            </button>

            {/* TRANSFER */}
            <button
              type="button"
              onClick={() => {
                playKeyClick();
                setMethod('TRANSFER');
                setCashReceived(totalAmount);
              }}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all min-h-[72px] ${
                method === 'TRANSFER'
                  ? 'border-forest bg-forest text-white shadow-elevated'
                  : 'border-cream-300 bg-white hover:bg-cream-100 text-ink'
              }`}
            >
              <Building2 className={`w-7 h-7 ${method === 'TRANSFER' ? 'text-amber' : 'text-forest'}`} />
              <span className="font-extrabold text-base">TRANSFER BANK</span>
            </button>
          </div>
        </div>

        {/* METODE KONTEN: TUNAI */}
        {method === 'TUNAI' && (
          <div className="mt-6 space-y-4">
            {/* Tombol Pecahan Uang Cepat */}
            <div>
              <p className="text-xs font-bold text-ink-muted mb-2 uppercase tracking-wider">
                Pilih Nominal Uang Diterima:
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {quickAmounts.map((amt) => {
                  const isExact = amt === totalAmount;
                  const isSelected = cashReceived === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectQuickCash(amt)}
                      className={`py-3 px-2 rounded-xl text-center font-bold text-xs border transition-all ${
                        isSelected
                          ? 'bg-amber border-amber-dark text-forest font-extrabold shadow-sm ring-2 ring-forest'
                          : 'bg-cream-100 border-cream-300 text-ink hover:bg-cream-200'
                      }`}
                    >
                      {isExact ? 'Uang Pas' : formatRupiah(amt)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Manual Uang Tunai */}
            <div>
              <label className="text-xs font-bold text-ink-muted mb-1 block">
                Atau Ketik Jumlah Uang Tunai (Rp):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customCashInput}
                  onChange={handleCustomCashChange}
                  className="w-full pl-5 pr-4 py-3.5 bg-cream-50 border-2 border-cream-300 rounded-2xl text-2xl font-mono font-extrabold text-ink focus:outline-none focus:ring-2 focus:ring-forest focus:border-forest"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Kotak Kembalian Besar Ramah Kasir Lansia */}
            <div
              className={`p-5 rounded-2xl border-2 flex items-center justify-between ${
                isUnderpaid
                  ? 'bg-status-dangerBg/50 border-status-dangerText/40'
                  : 'bg-status-successBg border-status-successText/40 shadow-sm'
              }`}
            >
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  {isUnderpaid ? 'Kekurangan Uang' : 'KEMBALIAN KASIR'}
                </p>
                <p
                  className={`text-3xl md:text-4xl font-extrabold font-mono mt-0.5 ${
                    isUnderpaid ? 'text-status-dangerText' : 'text-status-successText'
                  }`}
                >
                  {isUnderpaid
                    ? `- ${formatRupiah(totalAmount - cashReceived)}`
                    : formatRupiah(change)}
                </p>
              </div>

              {isUnderpaid ? (
                <div className="flex items-center gap-1.5 text-status-dangerText text-xs font-bold bg-white px-3 py-1.5 rounded-xl border border-status-dangerText/30">
                  <AlertCircle className="w-4 h-4" /> Uang Kurang!
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-status-successText text-xs font-bold bg-white px-3 py-1.5 rounded-xl border border-status-successText/30">
                  <Check className="w-4 h-4" /> Uang Cukup
                </div>
              )}
            </div>
          </div>
        )}

        {/* METODE KONTEN: QRIS */}
        {method === 'QRIS' && (
          <div className="mt-6 p-6 bg-cream-50 rounded-3xl border border-cream-300 flex flex-col md:flex-row items-center gap-6">
            {/* Visual QR Code Mockup */}
            <div className="p-3 bg-white rounded-2xl border-2 border-cream-300 shadow-sm flex flex-col items-center">
              <div className="w-36 h-36 bg-gray-900 rounded-xl p-2.5 flex items-center justify-center relative">
                {/* SVG Mock QR Code */}
                <div className="w-full h-full border-4 border-white grid grid-cols-4 gap-1 p-1">
                  <div className="bg-white rounded-sm col-span-2 row-span-2 border-2 border-black" />
                  <div className="bg-white rounded-sm" />
                  <div className="bg-white rounded-sm" />
                  <div className="bg-white rounded-sm" />
                  <div className="bg-white rounded-sm col-span-2 row-span-2 border-2 border-black" />
                  <div className="bg-white rounded-sm" />
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-forest mt-1.5 uppercase tracking-wider">
                QRIS ANUGERAH STORE
              </span>
            </div>

            {/* Instruction Guide */}
            <div className="flex-1 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-forest font-bold">
                <ShieldCheck className="w-5 h-5 text-forest" />
                <span>Pembayaran QRIS Statis Meja Kasir</span>
              </div>
              <p className="text-ink-muted text-xs leading-relaxed">
                1. Arahkan pembeli untuk memindai stiker QRIS resmi Anugerah Store yang tertempel di meja kasir.
              </p>
              <p className="text-ink-muted text-xs leading-relaxed">
                2. Pastikan pembeli memasukkan nominal tepat: <b className="text-forest font-mono">{formatRupiah(totalAmount)}</b>.
              </p>
              <p className="text-ink-muted text-xs leading-relaxed">
                3. Periksa notifikasi saldo masuk di HP kasir/toko sebelum menekan tombol konfirmasi.
              </p>
            </div>
          </div>
        )}

        {/* METODE KONTEN: TRANSFER BANK */}
        {method === 'TRANSFER' && (
          <div className="mt-6 p-6 bg-cream-50 rounded-3xl border border-cream-300 space-y-4">
            <div className="flex items-center gap-2 text-forest font-bold text-sm">
              <Building2 className="w-5 h-5 text-forest" />
              <span>Rekening Resmi Toko Anugerah Store</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-cream-300">
                <p className="text-xs font-bold text-blue-700">BANK BCA</p>
                <p className="text-base font-mono font-extrabold text-ink">8820-1234-56</p>
                <p className="text-[11px] text-ink-muted">a.n Anugerah Store</p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-cream-300">
                <p className="text-xs font-bold text-blue-900">BANK BRI</p>
                <p className="text-base font-mono font-extrabold text-ink">0123-01-000456-50-8</p>
                <p className="text-[11px] text-ink-muted">a.n Anugerah Store</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-ink-muted block mb-1">
                Catatan Nama Pengirim / Referensi (Opsional):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Cth: Transfer Ibu Ratna / Ref 998231"
                className="w-full px-4 py-2.5 bg-white border border-cream-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest text-ink"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-4 px-4 bg-cream-200 hover:bg-cream-300 text-ink font-bold rounded-2xl text-base transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isUnderpaid}
            onClick={handleSubmit}
            className={`w-2/3 py-4 px-6 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-2 shadow-elevated transition-all min-h-[58px] ${
              isUnderpaid
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-amber hover:bg-amber-hover text-forest active:scale-[0.98]'
            }`}
          >
            <Check className="w-6 h-6 stroke-[3]" />
            PROSES PEMBAYARAN
          </button>
        </div>
      </div>
    </div>
  );
};
