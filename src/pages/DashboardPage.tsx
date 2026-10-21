import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  TrendingUp,
  Boxes,
  AlertTriangle,
  Award,
  AlertOctagon,
  ArrowRight,
  Eye,
  Plus,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { Sale, SaleItem, Product } from '../types';
import { formatRupiah, formatNumber, formatDateIndo } from '../utils/format';
import { ReceiptModal } from '../components/ReceiptModal';
import { db } from '../db';

export type DashboardPeriod = 'hari' | 'minggu' | 'bulan';

interface DashboardPageProps {
  products: Product[];
  onNavigateToPos: () => void;
  onNavigateToProducts: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  products,
  onNavigateToPos,
  onNavigateToProducts,
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [inspectSale, setInspectSale] = useState<Sale | null>(null);
  const [inspectSaleItems, setInspectSaleItems] = useState<SaleItem[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>('hari');

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      db.sales.orderBy('transaction_date').reverse().toArray(),
      db.sale_items.toArray(),
    ]).then(([s, si]) => {
      if (isMounted) {
        setSales(s);
        setSaleItems(si);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Today and boundary timestamps (stable)
  const [todayDate] = useState(() => new Date());
  const todayStr = todayDate.toISOString().slice(0, 10);
  const monthStr = todayDate.toISOString().slice(0, 7);

  const sevenDaysAgoDate = useMemo(() => {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [todayDate]);

  // Sales filtered by selected period
  const periodFilteredSales = useMemo(() => {
    return sales.filter((s) => {
      const sDateStr = s.transaction_date.slice(0, 10);
      if (period === 'hari') {
        return sDateStr === todayStr;
      }
      if (period === 'minggu') {
        const sTime = new Date(s.transaction_date).getTime();
        return sTime >= sevenDaysAgoDate.getTime();
      }
      if (period === 'bulan') {
        return s.transaction_date.slice(0, 7) === monthStr;
      }
      return true;
    });
  }, [sales, period, todayStr, monthStr, sevenDaysAgoDate]);

  const periodSaleIds = useMemo(() => {
    return new Set(periodFilteredSales.map((s) => s.id));
  }, [periodFilteredSales]);

  const periodFilteredSaleItems = useMemo(() => {
    return saleItems.filter((item) => periodSaleIds.has(item.sale_id));
  }, [saleItems, periodSaleIds]);

  const periodRevenue = useMemo(() => {
    return periodFilteredSales.reduce((acc, s) => acc + s.total_amount, 0);
  }, [periodFilteredSales]);

  const periodGrossProfit = useMemo(() => {
    return periodFilteredSales.reduce((acc, s) => acc + s.gross_profit, 0);
  }, [periodFilteredSales]);

  // Total Inventory Asset Valuation: Sum(stock_quantity * cost_price)
  const totalAssetValue = useMemo(() => {
    return products.reduce((acc, p) => acc + p.stock_quantity * p.cost_price, 0);
  }, [products]);

  const totalStockItemsCount = useMemo(() => {
    return products.reduce((acc, p) => acc + p.stock_quantity, 0);
  }, [products]);

  // Out of stock and Low stock
  const outOfStockProducts = useMemo(() => {
    return products.filter((p) => p.stock_quantity <= 0);
  }, [products]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_alert);
  }, [products]);

  // Top Selling Items for the selected period
  const topSelling = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; unit: string; revenue: number }>();

    periodFilteredSaleItems.forEach((item) => {
      const prod = products.find((p) => p.id === item.product_id);
      const current = map.get(item.product_id) || {
        name: item.product_name,
        qty: 0,
        unit: prod?.unit || item.unit || 'pcs',
        revenue: 0,
      };
      current.qty += item.quantity;
      current.revenue += item.subtotal;
      map.set(item.product_id, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [periodFilteredSaleItems, products]);

  // Dead-Stock Detection (Barang yang ada stok namun 0 terjual pada periode ini)
  const deadStockProducts = useMemo(() => {
    const soldProductIds = new Set(periodFilteredSaleItems.map((item) => item.product_id));
    return products
      .filter((p) => !soldProductIds.has(p.id) && p.stock_quantity > 0)
      .sort((a, b) => b.stock_quantity * b.cost_price - a.stock_quantity * a.cost_price);
  }, [products, periodFilteredSaleItems]);

  const handleInspectSale = (sale: Sale) => {
    const items = saleItems.filter((i) => i.sale_id === sale.id);
    setInspectSale(sale);
    setInspectSaleItems(items);
    setIsReceiptOpen(true);
  };

  const periodLabel = useMemo(() => {
    if (period === 'hari') return 'Hari Ini';
    if (period === 'minggu') return '7 Hari Terakhir';
    return 'Bulan Ini';
  }, [period]);

  return (
    <div className="w-full space-y-6">
      {/* Top Banner / Greeting Row */}
      <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-forest">
            <Sparkles className="w-5 h-5 text-amber-dark" />
            <span className="text-xs font-bold uppercase tracking-wider bg-forest-surface px-3 py-1 rounded-full">
              Pusat Kendali Toko
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-ink mt-1.5">
            Selamat Datang di Anugerah Store!
          </h1>
          <p className="text-sm text-ink-muted">
            Ringkasan performa penjualan, perputaran barang, dan estimasi nilai aset toko Anda
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Periode Dashboard: [per-hari, per-minggu, per-bulan] */}
          <div className="flex items-center bg-cream-100 p-1.5 rounded-2xl border border-cream-300 shadow-sm">
            <button
              type="button"
              onClick={() => setPeriod('hari')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                period === 'hari'
                  ? 'bg-amber text-forest font-black shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setPeriod('minggu')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                period === 'minggu'
                  ? 'bg-amber text-forest font-black shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Per-Minggu (7 Hari)
            </button>
            <button
              type="button"
              onClick={() => setPeriod('bulan')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                period === 'bulan'
                  ? 'bg-amber text-forest font-black shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Per-Bulan (30 Hari)
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-cream-100 px-3.5 py-2.5 rounded-2xl border border-cream-200 text-xs font-bold text-ink">
            <Clock className="w-4 h-4 text-forest" />
            <span>{formatDateIndo(todayDate)}</span>
          </div>

          <button
            type="button"
            onClick={onNavigateToPos}
            className="px-5 py-3 bg-amber hover:bg-amber-hover text-forest font-black rounded-2xl text-sm transition-all shadow-elevated flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span>+ Buka Kasir Baru</span>
          </button>
        </div>
      </div>

      {/* METRIC CARDS ROW (Bitepoint Aesthetic Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* HERO GREEN CARD: PENJUALAN PERIODE TERPILIH */}
        <div className="bg-forest text-white p-6 rounded-3xl shadow-elevated flex flex-col justify-between min-h-[160px] relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-amber uppercase tracking-wider">
              Penjualan ({periodLabel})
            </span>
            <div className="w-9 h-9 rounded-xl bg-forest-light flex items-center justify-center text-amber">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white">
              {periodFilteredSales.length} <span className="text-lg font-normal text-cream-200">Pesanan</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-cream-200 font-semibold">
              <span>Omset: <b className="text-amber font-mono text-sm">{formatRupiah(periodRevenue)}</b></span>
              <span className="text-emerald-300">• Laba: <b className="font-mono">{formatRupiah(periodGrossProfit)}</b></span>
            </div>
          </div>
        </div>

        {/* TOTAL NILAI ASET TOKO (STOK * HPP) */}
        <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col justify-between min-h-[160px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-forest uppercase tracking-wider">
              Total Nilai Aset Stok
            </span>
            <div className="w-9 h-9 rounded-xl bg-forest-surface flex items-center justify-center text-forest">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-forest">
              {formatRupiah(totalAssetValue)}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Dari {products.length} ragam barang ({formatNumber(totalStockItemsCount)} total unit fisik)
            </p>
          </div>
        </div>

        {/* TRANSAKSI PERIODE TERPILIH */}
        <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col justify-between min-h-[160px]">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-ink-muted uppercase tracking-wider">
              Transaksi ({periodLabel})
            </span>
            <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center text-ink-muted">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-ink">
              {periodFilteredSales.length} <span className="text-base font-normal text-ink-muted">Nota</span>
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Dari {sales.length} total riwayat nota di sistem
            </p>
          </div>
        </div>

        {/* PERINGATAN STOK MENIPIS & HABIS */}
        <div
          onClick={onNavigateToProducts}
          className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col justify-between min-h-[160px] cursor-pointer hover:border-amber transition-all"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-status-warningText uppercase tracking-wider">
              Peringatan Stok Rak
            </span>
            <div className="w-9 h-9 rounded-xl bg-status-warningBg flex items-center justify-center text-status-warningText">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-status-dangerText">
                {outOfStockProducts.length} Habis
              </span>
              <span className="text-sm font-bold text-status-warningText">
                / {lowStockProducts.length} Menipis
              </span>
            </div>
            <p className="text-xs text-forest font-bold mt-1 flex items-center gap-1 hover:underline">
              <span>Periksa di Katalog Produk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </p>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN DASHBOARD LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SISI KIRI: DAFTAR TRANSAKSI KASIR TERKINI (7 Kolom) */}
        <div className="lg:col-span-7 bg-card p-6 rounded-3xl shadow-card border border-cream-300 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-cream-200">
            <div>
              <h3 className="font-extrabold text-lg text-ink">
                Daftar Transaksi Kasir ({periodLabel})
              </h3>
              <p className="text-xs text-ink-muted">Transaksi penjualan kasir pada rentang waktu ini</p>
            </div>
            <span className="text-xs font-bold text-forest bg-forest-surface px-3 py-1 rounded-full">
              {periodFilteredSales.length} Tercatat
            </span>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {periodFilteredSales.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="p-4 bg-cream-50 hover:bg-cream-100 rounded-2xl border border-cream-200 flex items-center justify-between transition-colors gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-forest">
                      {s.receipt_number}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        s.payment_method === 'TUNAI'
                          ? 'bg-amber-light text-amber-dark'
                          : s.payment_method === 'QRIS'
                          ? 'bg-status-successBg text-status-successText'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {s.payment_method}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mt-1 truncate">
                    {formatDateIndo(s.transaction_date)} • {s.cashier_name}
                  </p>
                </div>

                <div className="text-right flex items-center gap-3">
                  <div>
                    <span className="font-mono font-black text-base text-ink block">
                      {formatRupiah(s.total_amount)}
                    </span>
                    <span className="font-mono text-xs text-status-successText font-bold">
                      +{formatRupiah(s.gross_profit)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleInspectSale(s)}
                    className="p-2.5 rounded-xl bg-white hover:bg-forest hover:text-white text-forest border border-cream-300 shadow-sm transition-all"
                    title="Lihat / Cetak Struk"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {periodFilteredSales.length === 0 && (
              <div className="py-12 text-center text-ink-muted">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-40 text-ink-subtle" />
                <p className="font-bold">Belum ada transaksi penjualan pada rentang {periodLabel}</p>
                <p className="text-xs text-ink-muted mt-1">
                  Buka kasir untuk memulai transaksi pertama
                </p>
              </div>
            )}
          </div>
        </div>

        {/* SISI KANAN: BARANG TERLARIS & DEAD-STOCK (5 Kolom) */}
        <div className="lg:col-span-5 space-y-6">
          {/* BARANG PALING LARIS */}
          <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream-200">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-dark" />
                <h3 className="font-extrabold text-base text-ink">
                  Barang Paling Laris ({periodLabel})
                </h3>
              </div>
              <span className="text-xs text-ink-muted font-semibold">Peringkat Penjualan</span>
            </div>

            <div className="space-y-2.5">
              {topSelling.map((item, index) => (
                <div
                  key={index}
                  className="p-3 bg-cream-50 rounded-2xl border border-cream-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-amber text-forest font-black text-xs flex items-center justify-center flex-shrink-0">
                      0{index + 1}
                    </span>
                    <div className="min-w-0">
                      <h5 className="font-bold text-xs sm:text-sm text-ink truncate">
                        {item.name}
                      </h5>
                      <span className="text-[11px] text-ink-muted">
                        Terjual: <b className="text-forest font-mono">{item.qty} {item.unit}</b>
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-extrabold text-xs sm:text-sm text-forest whitespace-nowrap">
                    {formatRupiah(item.revenue)}
                  </span>
                </div>
              ))}

              {topSelling.length === 0 && (
                <p className="py-6 text-center text-xs text-ink-muted">
                  Belum ada data barang terjual pada {periodLabel}
                </p>
              )}
            </div>
          </div>

          {/* DETEKSI BARANG MATI (DEAD-STOCK) */}
          <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream-200">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-status-warningText" />
                <h3 className="font-extrabold text-base text-ink">Deteksi Barang Mati ({periodLabel})</h3>
              </div>
              <span className="text-xs text-status-warningText font-bold bg-status-warningBg px-2 py-0.5 rounded-full">
                0 Terjual
              </span>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Barang bersisa stok yang belum bergerak pada {periodLabel}, menyebabkan modal tertahan:
            </p>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {deadStockProducts.slice(0, 10).map((p) => {
                const idleCapital = p.stock_quantity * p.cost_price;
                return (
                  <div
                    key={p.id}
                    className="p-3 bg-cream-50 rounded-2xl border border-cream-200 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <h5 className="font-bold text-ink truncate">{p.name}</h5>
                      <p className="text-[11px] text-ink-muted">
                        Modal Tertahan: <b className="text-status-warningText font-mono">{formatRupiah(idleCapital)}</b>
                      </p>
                    </div>
                    <span className="font-mono font-bold px-2 py-1 rounded-xl bg-status-warningBg text-status-warningText whitespace-nowrap">
                      {p.stock_quantity} {p.unit || 'pcs'}
                    </span>
                  </div>
                );
              })}

              {deadStockProducts.length === 0 && (
                <p className="py-4 text-center text-xs text-status-successText font-semibold">
                  Semua barang memiliki perputaran penjualan aktif.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inspect Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={inspectSale}
        items={inspectSaleItems}
      />
    </div>
  );
};
