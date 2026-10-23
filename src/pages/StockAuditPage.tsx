import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  History,
  RotateCcw,
  Check,
  Package,
  Boxes,
} from 'lucide-react';
import type { Product, StockAudit } from '../types';
import { formatDateIndo, generateId } from '../utils/format';
import { playSuccessBeep, playErrorBeep, playKeyClick } from '../utils/sound';
import { db } from '../db';

interface StockAuditPageProps {
  products: Product[];
  onRefresh: () => void;
}

export const StockAuditPage: React.FC<StockAuditPageProps> = ({
  products,
  onRefresh,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [physicalCountStr, setPhysicalCountStr] = useState<string>('0');
  const [auditNotes, setAuditNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [auditHistory, setAuditHistory] = useState<StockAudit[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadAuditHistory = useCallback(async () => {
    const list = await db.stock_audits.orderBy('audit_date').reverse().limit(30).toArray();
    setAuditHistory(list);
  }, []);

  useEffect(() => {
    let isMounted = true;
    db.stock_audits.orderBy('audit_date').reverse().limit(30).toArray().then((list) => {
      if (isMounted) setAuditHistory(list);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectProduct = (p: Product) => {
    playKeyClick();
    setSelectedProduct(p);
    setPhysicalCountStr(String(p.stock_quantity));
    setAuditNotes('');
    setFeedbackMsg(null);
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  const physicalCount = Number(physicalCountStr) || 0;

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const difference = physicalCount - selectedProduct.stock_quantity;
    const nowIso = new Date().toISOString();
    const itemUnit = selectedProduct.unit || 'pcs';

    const auditEntry: StockAudit = {
      id: generateId('audit'),
      audit_date: nowIso,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      barcode: selectedProduct.barcode,
      system_stock: selectedProduct.stock_quantity,
      physical_stock: physicalCount,
      difference: difference,
      notes: auditNotes.trim() || (difference === 0 ? 'Stok fisik sesuai komputer' : `Koreksi selisih ${difference} ${itemUnit}`),
    };

    try {
      await db.stock_audits.add(auditEntry);

      await db.products.update(selectedProduct.id, {
        stock_quantity: physicalCount,
        updated_at: nowIso,
      });

      playSuccessBeep();
      setFeedbackMsg({
        text: `Stok produk "${selectedProduct.name}" berhasil disesuaikan menjadi ${physicalCount} ${itemUnit}!`,
        type: 'success',
      });

      loadAuditHistory();
      onRefresh();
      setSelectedProduct(null);
    } catch (err) {
      console.error('Gagal menyimpan audit stok:', err);
      playErrorBeep();
      setFeedbackMsg({ text: 'Gagal memperbarui data stok.', type: 'error' });
    }
  };

  const difference = selectedProduct ? physicalCount - selectedProduct.stock_quantity : 0;

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-forest tracking-wider uppercase bg-forest-surface px-3 py-1 rounded-full">
            Audit Fisik Toko
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-ink mt-1.5">
            Stok Opname Rak Toko
          </h1>
          <p className="text-sm text-ink-muted">
            Hitung jumlah fisik barang di etalase/rak toko dan selaraskan dengan catatan komputer kasir
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 bg-forest-surface text-forest rounded-2xl text-xs font-bold">
          <Boxes className="w-4 h-4" />
          <span>{products.length} Total Produk di Toko</span>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl border font-bold text-sm flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-status-successBg border-status-successText text-status-successText'
              : 'bg-status-dangerBg border-status-dangerText text-status-dangerText'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Audit Grid (Full Desktop Width) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Search & Audit Form (7 Columns) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quick Search Input */}
          <div className="bg-card p-5 rounded-3xl shadow-card border border-cream-300">
            <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-2">
              Cari Barang yang Sedang Dihitung di Rak:
            </label>
            <div className="relative">
              <Search className="w-5 h-5 text-forest absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama atau kategori barang..."
                className="w-full pl-12 pr-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
              />
            </div>
          </div>

          {/* Active Product Form */}
          {selectedProduct ? (
            <div className="bg-card p-6 rounded-3xl shadow-elevated border-2 border-forest/30 space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedProduct.image ? (
                    <img
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-cream-300 shadow-sm flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-cream-100 border border-cream-300 flex items-center justify-center text-ink-subtle flex-shrink-0">
                      <Package className="w-6 h-6 opacity-40" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-forest bg-forest-surface px-2.5 py-0.5 rounded-full uppercase">
                      {selectedProduct.category}
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-ink mt-0.5 truncate">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Satuan: <b>{selectedProduct.unit || 'pcs'}</b>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="text-xs text-ink font-bold bg-cream-200 hover:bg-cream-300 px-3.5 py-2 rounded-xl flex-shrink-0 transition-colors"
                >
                  Ganti Barang
                </button>
              </div>

              {/* Comparison Counters */}
              <div className="grid grid-cols-3 gap-3">
                {/* System Stock */}
                <div className="p-4 bg-cream-100 rounded-2xl border border-cream-300 text-center">
                  <p className="text-[11px] font-bold text-ink-muted uppercase">Stok Komputer</p>
                  <p className="text-2xl sm:text-3xl font-mono font-black text-ink mt-1">
                    {selectedProduct.stock_quantity}
                  </p>
                  <p className="text-[10px] text-ink-muted">{selectedProduct.unit || 'pcs'} tercatat</p>
                </div>

                {/* Physical Stock Input with Clean Numeric Entry (No sticky zeroes) */}
                <div className="p-4 bg-amber/20 rounded-2xl border-2 border-amber text-center">
                  <p className="text-[11px] font-bold text-forest uppercase">Riil Fisik di Rak</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={physicalCountStr}
                    onChange={(e) => setPhysicalCountStr(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="w-full text-center text-2xl sm:text-3xl font-mono font-black text-forest bg-transparent focus:outline-none"
                    autoFocus
                  />
                  <p className="text-[10px] text-forest font-semibold">{selectedProduct.unit || 'pcs'} hasil hitung</p>
                </div>

                {/* Difference Badge */}
                <div
                  className={`p-4 rounded-2xl border text-center ${
                    difference === 0
                      ? 'bg-status-successBg border-status-successText/40'
                      : difference < 0
                      ? 'bg-status-dangerBg border-status-dangerText/40'
                      : 'bg-status-warningBg border-status-warningText/40'
                  }`}
                >
                  <p className="text-[11px] font-bold text-ink-muted uppercase">Selisih</p>
                  <p
                    className={`text-2xl sm:text-3xl font-mono font-black mt-1 ${
                      difference === 0
                        ? 'text-status-successText'
                        : difference < 0
                        ? 'text-status-dangerText'
                        : 'text-status-warningText'
                    }`}
                  >
                    {difference > 0 ? `+${difference}` : difference}
                  </p>
                  <p className="text-[10px] font-bold">
                    {difference === 0
                      ? 'Cocok Sesuai'
                      : difference < 0
                      ? 'Barang Kurang'
                      : 'Barang Lebih'}
                  </p>
                </div>
              </div>

              {/* Audit Notes Form */}
              <form onSubmit={handleSaveAudit} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-ink-muted block mb-1">
                    Catatan Audit Opname (Opsional):
                  </label>
                  <input
                    type="text"
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    placeholder="Cth: Barang rusak di pojok rak / Kemasan robek / Hitungan rutin mingguan"
                    className="w-full px-4 py-2.5 bg-cream-50 border border-cream-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-forest text-ink"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-amber hover:bg-amber-hover text-forest font-black rounded-2xl text-base shadow-elevated transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  SESUAIKAN STOK KOMPUTER ({physicalCount} {selectedProduct.unit || 'pcs'})
                </button>
              </form>
            </div>
          ) : (
            /* Fast Selection List from Catalog */
            <div className="bg-card p-5 rounded-3xl shadow-card border border-cream-300 space-y-3">
              <h4 className="font-extrabold text-sm text-ink">
                Pilih Produk dari Rak untuk Mulai Audit:
              </h4>
              <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="p-3 bg-cream-50 hover:bg-cream-100 rounded-2xl border border-cream-300 flex items-center justify-between cursor-pointer transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-10 h-10 rounded-xl object-cover border border-cream-300 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-cream-200 border border-cream-300 flex items-center justify-center text-ink-subtle flex-shrink-0">
                          <Package className="w-5 h-5 opacity-40" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="font-bold text-ink text-sm truncate">{p.name}</h5>
                        <span className="text-xs text-ink-muted">
                          Kategori: {p.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-bold text-forest bg-forest-surface px-2.5 py-1 rounded-xl">
                        Stok: {p.stock_quantity} {p.unit || 'pcs'}
                      </span>
                    </div>
                  </div>
                ))}

                {filteredProducts.length === 0 && (
                  <p className="py-6 text-center text-xs text-ink-muted font-medium">
                    Tidak ditemukan barang dengan kata kunci "{searchQuery}"
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Riwayat Stok Opname (5 Columns) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300">
            <div className="flex items-center gap-2 pb-4 border-b border-cream-200">
              <History className="w-5 h-5 text-forest" />
              <h3 className="font-extrabold text-lg text-ink">Riwayat Audit Terkini</h3>
            </div>

            <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {auditHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-cream-50 rounded-2xl border border-cream-300 space-y-1 text-xs"
                >
                  <div className="flex justify-between items-start font-bold">
                    <span className="text-ink">{item.product_name}</span>
                    <span
                      className={`font-mono font-extrabold px-2 py-0.5 rounded-md ${
                        item.difference === 0
                          ? 'bg-status-successBg text-status-successText'
                          : item.difference < 0
                          ? 'bg-status-dangerBg text-status-dangerText'
                          : 'bg-status-warningBg text-status-warningText'
                      }`}
                    >
                      {item.difference > 0 ? `+${item.difference}` : item.difference}
                    </span>
                  </div>

                  <div className="flex justify-between text-ink-muted text-[11px]">
                    <span>Sistem: {item.system_stock} | Fisik: {item.physical_stock}</span>
                    <span>{formatDateIndo(item.audit_date)}</span>
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-ink-subtle italic pt-1 border-t border-cream-200">
                      "{item.notes}"
                    </p>
                  )}
                </div>
              ))}

              {auditHistory.length === 0 && (
                <div className="py-12 text-center text-ink-muted">
                  <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-40 text-ink-subtle" />
                  <p className="font-bold">Belum ada riwayat audit stok</p>
                  <p className="text-xs text-ink-muted mt-1">
                    Lakukan stok opname pertama Anda hari ini
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
