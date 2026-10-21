import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Banknote,
  QrCode,
  Building2,
  Calendar,
  DollarSign,
  TrendingDown,
  Layers,
} from 'lucide-react';
import type { Sale, Expense } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/format';
import { db } from '../db';

export const ReportsPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [timeRange, setTimeRange] = useState<'today' | 'month' | 'all'>('month');

  const loadData = async () => {
    const s = await db.sales.orderBy('transaction_date').reverse().toArray();
    const e = await db.expenses.orderBy('expense_date').reverse().toArray();
    setSales(s);
    setExpenses(e);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter by Time Range
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);

    return sales.filter((s) => {
      const sDate = s.transaction_date.slice(0, 10);
      const sMonth = s.transaction_date.slice(0, 7);

      if (timeRange === 'today') return sDate === todayStr;
      if (timeRange === 'month') return sMonth === monthStr;
      return true;
    });
  }, [sales, timeRange]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);

    return expenses.filter((e) => {
      const eDate = e.expense_date.slice(0, 10);
      const eMonth = e.expense_date.slice(0, 7);

      if (timeRange === 'today') return eDate === todayStr;
      if (timeRange === 'month') return eMonth === monthStr;
      return true;
    });
  }, [expenses, timeRange]);

  // Financial Metrics:
  // 1. Omset Penjualan (Revenue)
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + s.total_amount, 0);
  }, [filteredSales]);

  // 2. Modal HPP (COGS)
  const totalCOGS = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + s.total_cost, 0);
  }, [filteredSales]);

  // 3. Laba Kotor (Gross Profit)
  const grossProfit = totalRevenue - totalCOGS;

  // 4. Pengeluaran & Kulakan
  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [filteredExpenses]);

  // 5. Laba Bersih Toko (Net Profit)
  const netProfit = grossProfit - totalExpenseAmount;

  // 6. Rekonsiliasi Kasir & Arus Uang Masuk
  const cashSales = useMemo(() => {
    return filteredSales
      .filter((s) => s.payment_method === 'TUNAI')
      .reduce((acc, s) => acc + s.total_amount, 0);
  }, [filteredSales]);

  const qrisSales = useMemo(() => {
    return filteredSales
      .filter((s) => s.payment_method === 'QRIS')
      .reduce((acc, s) => acc + s.total_amount, 0);
  }, [filteredSales]);

  const transferSales = useMemo(() => {
    return filteredSales
      .filter((s) => s.payment_method === 'TRANSFER')
      .reduce((acc, s) => acc + s.total_amount, 0);
  }, [filteredSales]);

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Range Switcher */}
      <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-forest tracking-wider uppercase bg-forest-surface px-3 py-1 rounded-full">
            Laporan Keuangan & Pembukuan
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-ink mt-1.5">
            Laba Kotor, Laba Bersih & Arus Kas
          </h1>
          <p className="text-sm text-ink-muted">
            Transparansi finansial usaha toko ritel Anugerah Store dan rincian kas fisik vs saldo bank
          </p>
        </div>

        {/* Time Filter Pills */}
        <div className="flex bg-cream-100 p-1.5 rounded-2xl border border-cream-300">
          <button
            type="button"
            onClick={() => setTimeRange('today')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              timeRange === 'today'
                ? 'bg-amber text-forest font-black shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              timeRange === 'month'
                ? 'bg-amber text-forest font-black shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => setTimeRange('all')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              timeRange === 'all'
                ? 'bg-amber text-forest font-black shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Semua Waktu
          </button>
        </div>
      </div>

      {/* 4 CORE FINANCIAL CARDS (Bitepoint Aesthetic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. OMSET PENJUALAN (Hero Deep Forest Green #084C46) */}
        <div className="bg-forest text-white p-6 rounded-3xl shadow-elevated flex flex-col justify-between min-h-[170px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-amber uppercase tracking-wider">
              1. Omset Penjualan
            </span>
            <span className="text-xs bg-forest-light px-2.5 py-0.5 rounded-full font-bold">
              {filteredSales.length} Transaksi
            </span>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
              {formatRupiah(totalRevenue)}
            </p>
            <p className="text-xs text-cream-200 mt-1">
              Modal HPP: <span className="font-mono">{formatRupiah(totalCOGS)}</span>
            </p>
          </div>
        </div>

        {/* 2. LABA KOTOR (GROSS PROFIT) */}
        <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col justify-between min-h-[170px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-status-successText uppercase tracking-wider">
              2. Laba Kotor (Gross Profit)
            </span>
            <div className="w-8 h-8 rounded-xl bg-status-successBg flex items-center justify-center text-status-successText">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-forest">
              {formatRupiah(grossProfit)}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              (Omset Penjualan dikurangi HPP Modal Beli)
            </p>
          </div>
        </div>

        {/* 3. PENGELUARAN & KULAKAN */}
        <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col justify-between min-h-[170px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-status-dangerText uppercase tracking-wider">
              3. Pengeluaran & Kulakan
            </span>
            <div className="w-8 h-8 rounded-xl bg-status-dangerBg flex items-center justify-center text-status-dangerText">
              <TrendingDown className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-status-dangerText">
              - {formatRupiah(totalExpenseAmount)}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Dari {filteredExpenses.length} catatan pengeluaran
            </p>
          </div>
        </div>

        {/* 4. LABA BERSIH TOKO (NET PROFIT) */}
        <div className="bg-amber-light p-6 rounded-3xl border-2 border-amber flex flex-col justify-between min-h-[170px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black text-amber-dark uppercase tracking-wider">
              4. Laba Bersih Toko (Net Profit)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber text-forest flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-forest">
              {formatRupiah(netProfit)}
            </p>
            <p className="text-xs text-amber-dark font-bold mt-1">
              Keuntungan riil setelah dipotong beban operasional
            </p>
          </div>
        </div>
      </div>

      {/* 5. REKONSILIASI KASIR & ARUS UANG MASUK */}
      <div className="bg-card p-6 sm:p-8 rounded-3xl shadow-card border border-cream-300 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-forest" />
            <h3 className="font-extrabold text-lg text-ink">
              Rekonsiliasi Kasir & Arus Uang Masuk
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
            Pastikan pembagian saldo sesuai dengan wujud uang masuk saat tutup kasir harian:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* UANG TUNAI FISIK */}
          <div className="p-6 rounded-3xl bg-cream-50 border-2 border-forest/30 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-forest">
                <Banknote className="w-5 h-5 text-forest" />
                <span>UANG TUNAI DI LACI KASIR</span>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-forest text-amber">
                Fisik Laci
              </span>
            </div>
            <div>
              <p className="text-3xl font-black font-mono text-ink">
                {formatRupiah(cashSales)}
              </p>
              <p className="text-xs text-ink-muted mt-1">
                Wajib ada secara fisik di laci meja kasir saat toko tutup
              </p>
            </div>
          </div>

          {/* QRIS STATIS */}
          <div className="p-6 rounded-3xl bg-cream-50 border-2 border-emerald-300 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                <QrCode className="w-5 h-5 text-emerald-700" />
                <span>SALDO QRIS STATIS</span>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-status-successBg text-status-successText">
                E-Wallet
              </span>
            </div>
            <div>
              <p className="text-3xl font-black font-mono text-ink">
                {formatRupiah(qrisSales)}
              </p>
              <p className="text-xs text-ink-muted mt-1">
                Saldo tersimpan di akun QRIS / dompet digital toko
              </p>
            </div>
          </div>

          {/* TRANSFER BANK */}
          <div className="p-6 rounded-3xl bg-cream-50 border-2 border-blue-300 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-blue-800">
                <Building2 className="w-5 h-5 text-blue-700" />
                <span>TRANSFER BANK RESMI</span>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-xl bg-blue-100 text-blue-700">
                Rekening Bank
              </span>
            </div>
            <div>
              <p className="text-3xl font-black font-mono text-ink">
                {formatRupiah(transferSales)}
              </p>
              <p className="text-xs text-ink-muted mt-1">
                Saldo masuk ke mutasi rekening bank (BCA / BRI)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RINCIAN PENGELUARAN PADA PERIODE INI */}
      <div className="bg-card rounded-3xl shadow-card border border-cream-300 overflow-hidden">
        <div className="p-6 border-b border-cream-200 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg text-ink">Rincian Pengeluaran & Biaya Toko</h3>
            <p className="text-xs text-ink-muted">Daftar beban operasional dan kulakan pada periode terpilih</p>
          </div>
          <span className="text-xs bg-cream-100 font-bold px-3 py-1.5 rounded-xl border border-cream-300 text-ink">
            Total Biaya: {formatRupiah(totalExpenseAmount)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-100 border-b border-cream-300 text-xs font-extrabold text-ink-muted uppercase tracking-wider">
                <th className="py-4 px-6">Tanggal & Waktu</th>
                <th className="py-4 px-6">Kategori</th>
                <th className="py-4 px-6">Keterangan Biaya</th>
                <th className="py-4 px-6 text-right">Nominal Pengeluaran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-sm">
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-cream-50/70 transition-colors">
                  <td className="py-4 px-6 text-xs text-ink-muted flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-ink-subtle" />
                    <span>{formatDateIndo(e.expense_date)}</span>
                  </td>
                  <td className="py-4 px-6 font-bold text-xs text-ink">
                    <span className="px-3 py-1 rounded-full bg-cream-100 border border-cream-300">
                      {e.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-semibold text-ink">
                    {e.description}
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-extrabold text-base text-status-dangerText">
                    - {formatRupiah(e.amount)}
                  </td>
                </tr>
              ))}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-ink-muted">
                    Tidak ada catatan pengeluaran pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
