import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Zap,
  ShoppingBag,
  Briefcase,
  Layers,
  Trash2,
  Calendar,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import type { Expense, ExpenseCategory, Product } from '../types';
import { formatRupiah, formatDateIndo, generateId } from '../utils/format';
import { playSuccessBeep, playKeyClick } from '../utils/sound';
import { db } from '../db';

interface ExpensesPageProps {
  products: Product[];
  onRefresh: () => void;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({
  products,
  onRefresh,
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State with clean string numeric handlers
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('KULAKAN_STOK');
  const [formDescription, setFormDescription] = useState('');
  const [formAmountStr, setFormAmountStr] = useState<string>('');
  const [selectedRestockProductId, setSelectedRestockProductId] = useState<string>('');
  const [restockQtyStr, setRestockQtyStr] = useState<string>('10');

  const loadExpenses = async () => {
    const list = await db.expenses.orderBy('expense_date').reverse().toArray();
    setExpenses(list);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const categories: { key: string; label: string }[] = [
    { key: 'Semua', label: 'Semua Pengeluaran' },
    { key: 'KULAKAN_STOK', label: 'Kulakan Stok' },
    { key: 'LISTRIK', label: 'Listrik & Air' },
    { key: 'OPERASIONAL', label: 'Operasional Toko' },
    { key: 'GAJI', label: 'Gaji Karyawan' },
    { key: 'LAINNYA', label: 'Lainnya' },
  ];

  const filteredExpenses = useMemo(() => {
    if (selectedCategory === 'Semua') return expenses;
    return expenses.filter((e) => e.category === selectedCategory);
  }, [expenses, selectedCategory]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);

  // Handle Add Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const formAmount = Number(formAmountStr) || 0;
    const restockQty = Number(restockQtyStr) || 0;

    if (formAmount <= 0) {
      alert('Nominal biaya harus lebih dari Rp 0!');
      return;
    }

    try {
      const newExpenseId = generateId('exp');
      const nowIso = new Date().toISOString();

      let finalDescription = formDescription.trim();

      // If Restock and product selected, auto-update stock
      if (formCategory === 'KULAKAN_STOK' && selectedRestockProductId) {
        const prod = products.find((p) => p.id === selectedRestockProductId);
        if (prod) {
          const newStock = prod.stock_quantity + restockQty;
          await db.products.update(prod.id, {
            stock_quantity: newStock,
            updated_at: nowIso,
          });

          const itemUnit = prod.unit || 'pcs';
          if (!finalDescription) {
            finalDescription = `Kulakan Restok: ${prod.name} (+${restockQty} ${itemUnit})`;
          } else {
            finalDescription += ` (${prod.name} +${restockQty} ${itemUnit})`;
          }
        }
      }

      if (!finalDescription) {
        finalDescription = `Biaya ${formCategory}`;
      }

      const newExpense: Expense = {
        id: newExpenseId,
        expense_date: nowIso,
        category: formCategory,
        description: finalDescription,
        amount: formAmount,
      };

      await db.expenses.add(newExpense);
      playSuccessBeep();
      setIsModalOpen(false);
      loadExpenses();
      onRefresh();
    } catch (err) {
      console.error('Gagal mencatat pengeluaran:', err);
      alert('Gagal mencatat biaya.');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Hapus catatan pengeluaran ini?')) {
      playKeyClick();
      await db.expenses.delete(id);
      loadExpenses();
      onRefresh();
    }
  };

  const getCategoryIcon = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'KULAKAN_STOK':
        return <ShoppingBag className="w-4 h-4 text-forest" />;
      case 'LISTRIK':
        return <Zap className="w-4 h-4 text-amber-dark" />;
      case 'GAJI':
        return <Briefcase className="w-4 h-4 text-blue-700" />;
      case 'OPERASIONAL':
        return <Truck className="w-4 h-4 text-emerald-700" />;
      default:
        return <Layers className="w-4 h-4 text-ink-muted" />;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-forest tracking-wider uppercase bg-forest-surface px-3 py-1 rounded-full">
            Pengeluaran & Belanja Modal
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-ink mt-1.5">
            Kulakan & Biaya Operasional
          </h1>
          <p className="text-sm text-ink-muted">
            Catat pembelian stok dagangan (restock), tagihan listrik, kantong kresek, dan pengeluaran toko lainnya
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            playKeyClick();
            setFormCategory('KULAKAN_STOK');
            setFormDescription('');
            setFormAmountStr('');
            setSelectedRestockProductId('');
            setRestockQtyStr('10');
            setIsModalOpen(true);
          }}
          className="px-5 py-3.5 bg-amber hover:bg-amber-hover text-forest font-black rounded-2xl text-sm transition-all shadow-elevated flex items-center gap-2 active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>+ Catat Biaya / Kulakan Baru</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Expense Card */}
        <div className="bg-forest text-white p-6 rounded-3xl shadow-elevated">
          <p className="text-xs font-black text-amber uppercase tracking-wider">
            Total Pengeluaran ({selectedCategory})
          </p>
          <p className="text-3xl font-black font-mono mt-1 text-white">
            {formatRupiah(totalFilteredAmount)}
          </p>
          <p className="text-xs text-cream-200 mt-2">
            Dari {filteredExpenses.length} catatan pengeluaran
          </p>
        </div>

        {/* Kulakan Stok Card */}
        <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300">
          <div className="flex items-center gap-2 text-forest font-bold text-xs uppercase">
            <ShoppingBag className="w-4 h-4 text-forest" />
            <span>Porsi Belanja Kulakan Stok</span>
          </div>
          <p className="text-2xl font-black font-mono mt-2 text-ink">
            {formatRupiah(
              expenses
                .filter((e) => e.category === 'KULAKAN_STOK')
                .reduce((a, b) => a + b.amount, 0)
            )}
          </p>
          <p className="text-xs text-ink-muted mt-1">Investasi modal dagangan toko</p>
        </div>

        {/* Biaya Utilitas & Operasional Card */}
        <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300">
          <div className="flex items-center gap-2 text-forest font-bold text-xs uppercase">
            <Zap className="w-4 h-4 text-amber-dark" />
            <span>Biaya Operasional Toko</span>
          </div>
          <p className="text-2xl font-black font-mono mt-2 text-ink">
            {formatRupiah(
              expenses
                .filter((e) => e.category !== 'KULAKAN_STOK')
                .reduce((a, b) => a + b.amount, 0)
            )}
          </p>
          <p className="text-xs text-ink-muted mt-1">Listrik, air, gaji & kresek</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setSelectedCategory(c.key)}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              selectedCategory === c.key
                ? 'bg-forest text-amber shadow-sm ring-1 ring-forest/20'
                : 'bg-card text-ink-muted hover:bg-cream-100 border border-cream-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Expense Table (Full Desktop Width) */}
      <div className="bg-card rounded-3xl shadow-card border border-cream-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-100 border-b border-cream-300 text-xs font-extrabold text-ink-muted uppercase tracking-wider">
                <th className="py-4 px-6">Tanggal & Waktu</th>
                <th className="py-4 px-4">Kategori Biaya</th>
                <th className="py-4 px-6">Keterangan Pengeluaran</th>
                <th className="py-4 px-6 text-right">Jumlah Biaya (Rp)</th>
                <th className="py-4 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-sm">
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-cream-50/70 transition-colors">
                  <td className="py-4 px-6 text-xs text-ink-muted flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-ink-subtle" />
                    <span>{formatDateIndo(e.expense_date)}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cream-100 border border-cream-300 text-ink">
                      {getCategoryIcon(e.category)}
                      {e.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-semibold text-ink">
                    {e.description}
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-extrabold text-base text-status-dangerText">
                    - {formatRupiah(e.amount)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(e.id)}
                      className="p-2 rounded-xl bg-cream-100 hover:bg-status-dangerBg text-status-dangerText transition-colors"
                      title="Hapus Catatan Ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-ink-muted">
                    Belum ada catatan pengeluaran pada kategori ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Pengeluaran with Clean Numeric Input (No sticky zeroes) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-card w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-modal border-2 border-cream-300 relative my-6">
            <div className="flex items-center justify-between pb-4 border-b border-cream-200">
              <h3 className="text-xl font-extrabold text-ink">Catat Biaya / Kulakan</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-5 space-y-4">
              {/* Category Selection */}
              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Kategori Pengeluaran *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                >
                  <option value="KULAKAN_STOK">Kulakan Stok (Belanja Barang Dagangan)</option>
                  <option value="LISTRIK">Listrik, Air & Utilitas</option>
                  <option value="OPERASIONAL">Operasional (Plastik, Lakban, Transport)</option>
                  <option value="GAJI">Gaji Karyawan Toko</option>
                  <option value="LAINNYA">Lain-lain</option>
                </select>
              </div>

              {/* Special options when Kulakan: Auto Restock product */}
              {formCategory === 'KULAKAN_STOK' && (
                <div className="p-4 bg-forest-surface rounded-2xl border border-forest/20 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-forest">
                    <AlertCircle className="w-4 h-4 text-forest" />
                    <span>Otomatis Tambah Stok Produk Toko? (Opsional)</span>
                  </div>
                  <div>
                    <select
                      value={selectedRestockProductId}
                      onChange={(e) => {
                        setSelectedRestockProductId(e.target.value);
                        const prod = products.find((p) => p.id === e.target.value);
                        if (prod) {
                          const q = Number(restockQtyStr) || 1;
                          setFormAmountStr(String(prod.cost_price * q));
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-forest/30 rounded-xl text-xs font-semibold text-ink"
                    >
                      <option value="">-- Pilih Barang yang Dikulak (Tidak Wajib) --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stok Saat Ini: {p.stock_quantity} {p.unit || 'pcs'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedRestockProductId && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-forest">
                        Jumlah Tambahan ({products.find(p => p.id === selectedRestockProductId)?.unit || 'pcs'}):
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={restockQtyStr}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setRestockQtyStr(val);
                          const prod = products.find((p) => p.id === selectedRestockProductId);
                          if (prod) {
                            setFormAmountStr(String(prod.cost_price * (Number(val) || 0)));
                          }
                        }}
                        placeholder="0"
                        className="w-24 px-3 py-1.5 bg-white border border-forest/30 rounded-xl font-mono font-bold text-sm text-ink"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Keterangan / Rincian Biaya
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Cth: Beli kantong plastik 5 pack / Beli beras 10 sak"
                  className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-semibold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>

              {/* Amount with Clean Numeric Input (Can delete cleanly without sticky zero) */}
              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Nominal Biaya Dikeluarkan (Rp) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formAmountStr}
                  onChange={(e) => setFormAmountStr(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  className="w-full px-4 py-3.5 bg-cream-50 border-2 border-forest/30 rounded-2xl font-mono font-extrabold text-xl text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
                <span className="text-xs text-ink-muted mt-1 block">
                  {formatRupiah(Number(formAmountStr) || 0)}
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/3 py-3.5 bg-cream-200 hover:bg-cream-300 text-ink font-bold rounded-2xl text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3.5 bg-amber hover:bg-amber-hover text-forest font-extrabold rounded-2xl text-base shadow-sm flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  Simpan Biaya
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
