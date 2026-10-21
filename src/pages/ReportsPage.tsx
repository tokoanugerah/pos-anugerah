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
  Printer,
  FileSpreadsheet,
  Receipt,
} from 'lucide-react';
import type { Sale, Expense } from '../types';
import { formatRupiah, formatDateIndo } from '../utils/format';
import { db, getStoreSettings } from '../db';
import { playKeyClick, playSuccessBeep } from '../utils/sound';

export type ReportPeriodType = 'harian' | 'mingguan' | 'bulanan' | 'tahunan';

const MONTH_NAMES_INDO = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const ReportsPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Period filter states
  const [periodType, setPeriodType] = useState<ReportPeriodType>('bulanan');
  
  // Specific date/range states (defaulting to current date)
  const [todayDate] = useState(() => new Date());
  const todayDateStr = todayDate.toISOString().slice(0, 10);
  const currentMonthStr = todayDate.toISOString().slice(0, 7);
  const currentYearStr = String(todayDate.getFullYear());

  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [selectedWeekEnd, setSelectedWeekEnd] = useState<string>(todayDateStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      db.sales.orderBy('transaction_date').reverse().toArray(),
      db.expenses.orderBy('expense_date').reverse().toArray(),
    ]).then(([s, e]) => {
      if (isMounted) {
        setSales(s);
        setExpenses(e);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute Week Range (7 days up to selectedWeekEnd)
  const weekRange = useMemo(() => {
    const end = new Date(selectedWeekEnd);
    end.setHours(23, 59, 59, 999);
    const start = new Date(selectedWeekEnd);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return {
      start,
      end,
      startStr: start.toISOString().slice(0, 10),
      endStr: selectedWeekEnd,
    };
  }, [selectedWeekEnd]);

  // Human-readable title for current active period
  const activePeriodTitle = useMemo(() => {
    if (periodType === 'harian') {
      return `Harian: ${formatDateIndo(selectedDate)}`;
    }
    if (periodType === 'mingguan') {
      return `Mingguan (7 Hari): ${formatDateIndo(weekRange.start)} s/d ${formatDateIndo(weekRange.end)}`;
    }
    if (periodType === 'bulanan') {
      const [y, m] = selectedMonth.split('-');
      const monthIdx = parseInt(m, 10) - 1;
      const monthName = MONTH_NAMES_INDO[monthIdx] || m;
      return `Bulanan: ${monthName} ${y}`;
    }
    return `Tahunan: Periode Tahun ${selectedYear}`;
  }, [periodType, selectedDate, weekRange, selectedMonth, selectedYear]);

  // Filter Sales by selected period
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const sDateStr = s.transaction_date.slice(0, 10);
      const sMonthStr = s.transaction_date.slice(0, 7);
      const sYearStr = s.transaction_date.slice(0, 4);

      if (periodType === 'harian') {
        return sDateStr === selectedDate;
      }
      if (periodType === 'mingguan') {
        const sTime = new Date(s.transaction_date).getTime();
        return sTime >= weekRange.start.getTime() && sTime <= weekRange.end.getTime();
      }
      if (periodType === 'bulanan') {
        return sMonthStr === selectedMonth;
      }
      if (periodType === 'tahunan') {
        return sYearStr === selectedYear;
      }
      return true;
    });
  }, [sales, periodType, selectedDate, weekRange, selectedMonth, selectedYear]);

  // Filter Expenses by selected period
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const eDateStr = e.expense_date.slice(0, 10);
      const eMonthStr = e.expense_date.slice(0, 7);
      const eYearStr = e.expense_date.slice(0, 4);

      if (periodType === 'harian') {
        return eDateStr === selectedDate;
      }
      if (periodType === 'mingguan') {
        const eTime = new Date(e.expense_date).getTime();
        return eTime >= weekRange.start.getTime() && eTime <= weekRange.end.getTime();
      }
      if (periodType === 'bulanan') {
        return eMonthStr === selectedMonth;
      }
      if (periodType === 'tahunan') {
        return eYearStr === selectedYear;
      }
      return true;
    });
  }, [expenses, periodType, selectedDate, weekRange, selectedMonth, selectedYear]);

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

  // Print PDF Function (Monochrome Clean Black-and-White Table Document)
  const handlePrintPdf = () => {
    playKeyClick();
    const settings = getStoreSettings();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Mohon izinkan pop-up jendela pada peramban Anda untuk mencetak PDF laporan keuangan.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Laporan Keuangan - ${settings.storeName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 10px;
            line-height: 1.35;
            font-size: 11pt;
          }
          .header {
            border-bottom: 2.5px solid #000;
            padding-bottom: 8px;
            margin-bottom: 14px;
          }
          .store-name {
            font-size: 18pt;
            font-weight: 900;
            letter-spacing: -0.5px;
            text-transform: uppercase;
          }
          .store-meta {
            font-size: 9.5pt;
            color: #111;
            margin-top: 2px;
          }
          .report-heading {
            margin-top: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .report-title {
            font-size: 13pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.2px;
          }
          .report-subtitle {
            font-size: 10.5pt;
            font-weight: bold;
            margin-top: 2px;
          }
          .print-meta {
            font-size: 9pt;
            text-align: right;
            color: #333;
          }
          .section-title {
            font-size: 10.5pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 14px;
            margin-bottom: 5px;
            padding-bottom: 3px;
            border-bottom: 1.5px solid #000;
          }
          table.report-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 9.5pt;
          }
          table.report-table th, table.report-table td {
            border: 1px solid #000;
            padding: 5px 8px;
          }
          table.report-table th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 8.5pt;
            letter-spacing: 0.5px;
          }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .font-bold { font-weight: bold; }
          .bg-total {
            background-color: #f7f7f7;
            font-weight: 900;
          }
          .signature-section {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .signature-box {
            width: 220px;
            text-align: center;
            font-size: 9.5pt;
          }
          .signature-space {
            height: 55px;
          }
          .signature-line {
            border-bottom: 1.5px solid #000;
            font-weight: bold;
            padding-bottom: 2px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${settings.storeName}</div>
          <div class="store-meta">${settings.storeAddress} • Telp: ${settings.storePhone}</div>
          <div class="report-heading">
            <div>
              <div class="report-title">LAPORAN KEUANGAN & PEMBUKUAN RESMI</div>
              <div class="report-subtitle">${activePeriodTitle}</div>
            </div>
            <div class="print-meta">
              Dicetak: ${formatDateIndo(new Date())}<br>
              Kasir: ${settings.cashierName}
            </div>
          </div>
        </div>

        <!-- 1. RINGKASAN FINANSIAL & LABA BERSIH -->
        <div class="section-title">1. Ringkasan Laba Rugi Toko</div>
        <table class="report-table">
          <thead>
            <tr>
              <th class="text-left" style="width: 55%;">Komponen Keuangan</th>
              <th class="text-center" style="width: 15%;">Jumlah Data</th>
              <th class="text-right" style="width: 30%;">Nominal (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>1. Omset Penjualan (Kotor)</b><br><small>Total seluruh transaksi penjualan pada periode ini</small></td>
              <td class="text-center font-mono">${filteredSales.length} Nota</td>
              <td class="text-right font-mono font-bold">${formatRupiah(totalRevenue)}</td>
            </tr>
            <tr>
              <td><b>2. Modal Pokok Penjualan (HPP)</b><br><small>Total modal beli barang yang terjual</small></td>
              <td class="text-center font-mono">-</td>
              <td class="text-right font-mono">${formatRupiah(totalCOGS)}</td>
            </tr>
            <tr style="background-color: #fafafa;">
              <td><b>3. LABA KOTOR (GROSS PROFIT)</b><br><small>(Omset Penjualan dikurangi HPP Modal Beli)</small></td>
              <td class="text-center font-mono">-</td>
              <td class="text-right font-mono font-bold">${formatRupiah(grossProfit)}</td>
            </tr>
            <tr>
              <td><b>4. Total Beban Operasional & Kulakan</b><br><small>Biaya listrik, gaji, kulakan stok dan operasional toko</small></td>
              <td class="text-center font-mono">${filteredExpenses.length} Transaksi</td>
              <td class="text-right font-mono" style="color: #000;">- ${formatRupiah(totalExpenseAmount)}</td>
            </tr>
            <tr class="bg-total" style="font-size: 10.5pt;">
              <td><b>5. LABA BERSIH TOKO (NET PROFIT)</b><br><small>Keuntungan bersih riil setelah seluruh potongan biaya</small></td>
              <td class="text-center font-mono font-bold">-</td>
              <td class="text-right font-mono font-bold">${formatRupiah(netProfit)}</td>
            </tr>
          </tbody>
        </table>

        <!-- 2. REKONSILIASI KASIR & ARUS UANG MASUK -->
        <div class="section-title">2. Rekonsiliasi Kasir & Arus Kas Masuk</div>
        <table class="report-table">
          <thead>
            <tr>
              <th class="text-left" style="width: 45%;">Metode Pembayaran</th>
              <th class="text-left" style="width: 30%;">Bentuk / Rekening</th>
              <th class="text-right" style="width: 25%;">Nominal Diterima (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Uang Tunai (Cash)</b></td>
              <td>Wajib ada secara fisik di laci meja kasir</td>
              <td class="text-right font-mono font-bold">${formatRupiah(cashSales)}</td>
            </tr>
            <tr>
              <td><b>QRIS Statis (E-Wallet)</b></td>
              <td>Saldo dompet digital toko (ShopeePay/Gopay/OVO)</td>
              <td class="text-right font-mono font-bold">${formatRupiah(qrisSales)}</td>
            </tr>
            <tr>
              <td><b>Transfer Bank</b></td>
              <td>Mutasi rekening bank toko (BCA / BRI / Mandiri)</td>
              <td class="text-right font-mono font-bold">${formatRupiah(transferSales)}</td>
            </tr>
            <tr class="bg-total">
              <td colspan="2"><b>TOTAL ARUS KAS PENJUALAN MASUK</b></td>
              <td class="text-right font-mono font-bold">${formatRupiah(totalRevenue)}</td>
            </tr>
          </tbody>
        </table>

        <!-- 3. RINCIAN PENGELUARAN PADA PERIODE INI -->
        <div class="section-title">3. Rincian Pengeluaran & Biaya Toko (${filteredExpenses.length} Catatan)</div>
        <table class="report-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 6%;">No</th>
              <th class="text-left" style="width: 20%;">Tanggal</th>
              <th class="text-left" style="width: 20%;">Kategori</th>
              <th class="text-left" style="width: 34%;">Keterangan</th>
              <th class="text-right" style="width: 20%;">Nominal (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredExpenses.length > 0
                ? filteredExpenses
                    .map(
                      (e, idx) => `
              <tr>
                <td class="text-center font-mono">${idx + 1}</td>
                <td class="font-mono">${formatDateIndo(e.expense_date)}</td>
                <td><b>${e.category.replace('_', ' ')}</b></td>
                <td>${e.description}</td>
                <td class="text-right font-mono font-bold">- ${formatRupiah(e.amount)}</td>
              </tr>
            `
                    )
                    .join('')
                : `<tr><td colspan="5" class="text-center" style="padding: 12px; color: #444;">Tidak ada catatan pengeluaran pada periode ini.</td></tr>`
            }
            <tr class="bg-total">
              <td colspan="4" class="text-right"><b>TOTAL PENGELUARAN:</b></td>
              <td class="text-right font-mono font-bold">- ${formatRupiah(totalExpenseAmount)}</td>
            </tr>
          </tbody>
        </table>

        <!-- 4. RINGKASAN TRANSAKSI PENJUALAN TERAKHIR PADA PERIODE INI -->
        <div class="section-title">4. Riwayat Transaksi Penjualan Kasir (${filteredSales.length} Transaksi)</div>
        <table class="report-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 6%;">No</th>
              <th class="text-left" style="width: 22%;">No. Nota</th>
              <th class="text-left" style="width: 22%;">Waktu Transaksi</th>
              <th class="text-center" style="width: 14%;">Metode</th>
              <th class="text-right" style="width: 18%;">Omset (Rp)</th>
              <th class="text-right" style="width: 18%;">Laba Kotor (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredSales.length > 0
                ? filteredSales.slice(0, 30).map((s, idx) => `
              <tr>
                <td class="text-center font-mono">${idx + 1}</td>
                <td class="font-mono font-bold">${s.receipt_number}</td>
                <td class="font-mono">${formatDateIndo(s.transaction_date)}</td>
                <td class="text-center font-bold">${s.payment_method}</td>
                <td class="text-right font-mono font-bold">${formatRupiah(s.total_amount)}</td>
                <td class="text-right font-mono font-bold">+${formatRupiah(s.gross_profit)}</td>
              </tr>
            `).join('') + (filteredSales.length > 30 ? `<tr><td colspan="6" class="text-center" style="color:#555;">... Dan ${filteredSales.length - 30} transaksi lainnya ...</td></tr>` : '')
                : `<tr><td colspan="6" class="text-center" style="padding: 12px; color: #444;">Tidak ada transaksi penjualan pada periode ini.</td></tr>`
            }
            <tr class="bg-total">
              <td colspan="4" class="text-right"><b>TOTAL PENJUALAN KASIR:</b></td>
              <td class="text-right font-mono font-bold">${formatRupiah(totalRevenue)}</td>
              <td class="text-right font-mono font-bold">+${formatRupiah(grossProfit)}</td>
            </tr>
          </tbody>
        </table>

        <!-- TANDA TANGAN VALIDASI -->
        <div class="signature-section">
          <div class="signature-box">
            <div>Dibuat & Diverifikasi Oleh:</div>
            <div class="signature-space"></div>
            <div class="signature-line">( ${settings.cashierName} )</div>
            <div style="font-size: 8.5pt; color: #444; margin-top: 2px;">Kasir / Staf Operasional</div>
          </div>
          <div class="signature-box">
            <div>Mengetahui & Menyetujui:</div>
            <div class="signature-space"></div>
            <div class="signature-line">( Pemilik ${settings.storeName} )</div>
            <div style="font-size: 8.5pt; color: #444; margin-top: 2px;">Pemilik Toko / Manajemen</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    // Small delay to allow CSS rendering before triggering print
    setTimeout(() => {
      printWindow.print();
    }, 350);

    playSuccessBeep();
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Range Switcher */}
      <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
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

        {/* Action Button: Print PDF */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-5 py-3.5 bg-forest hover:bg-forest-light text-amber font-black rounded-2xl text-sm transition-all shadow-elevated flex items-center gap-2.5 active:scale-95 border border-amber/40"
          >
            <Printer className="w-5 h-5 stroke-[2.5]" />
            <span>Cetak ke PDF (Hitam Putih)</span>
          </button>
        </div>
      </div>

      {/* FILTER PERIOD CONTROLS BAR */}
      <div className="bg-card p-5 sm:p-6 rounded-3xl shadow-card border border-cream-300 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Period Selector Tabs: Harian, Mingguan, Bulanan, Tahunan */}
          <div className="flex flex-wrap items-center bg-cream-100 p-1.5 rounded-2xl border border-cream-300 shadow-sm gap-1">
            <button
              type="button"
              onClick={() => setPeriodType('harian')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                periodType === 'harian'
                  ? 'bg-amber text-forest font-black shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Laporan Harian
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('mingguan')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                periodType === 'mingguan'
                  ? 'bg-amber text-forest font-black shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Laporan Mingguan
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('bulanan')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                periodType === 'bulanan'
                  ? 'bg-amber text-forest font-black shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Laporan Bulanan
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('tahunan')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                periodType === 'tahunan'
                  ? 'bg-amber text-forest font-black shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Laporan Tahunan
            </button>
          </div>

          {/* Dynamic Date Pickers depending on periodType */}
          <div className="flex items-center gap-3">
            {periodType === 'harian' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-ink-muted">Pilih Tanggal:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-sm font-mono font-bold text-ink focus:outline-none focus:ring-2 focus:ring-amber"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayDateStr)}
                  className="px-3 py-2 bg-cream-200 hover:bg-cream-300 text-ink rounded-xl text-xs font-bold"
                >
                  Hari Ini
                </button>
              </div>
            )}

            {periodType === 'mingguan' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-ink-muted">Minggu Berakhir Pada:</label>
                <input
                  type="date"
                  value={selectedWeekEnd}
                  onChange={(e) => setSelectedWeekEnd(e.target.value)}
                  className="px-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-sm font-mono font-bold text-ink focus:outline-none focus:ring-2 focus:ring-amber"
                />
                <button
                  type="button"
                  onClick={() => setSelectedWeekEnd(todayDateStr)}
                  className="px-3 py-2 bg-cream-200 hover:bg-cream-300 text-ink rounded-xl text-xs font-bold"
                >
                  Minggu Ini
                </button>
              </div>
            )}

            {periodType === 'bulanan' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-ink-muted">Pilih Bulan & Tahun:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-sm font-mono font-bold text-ink focus:outline-none focus:ring-2 focus:ring-amber"
                />
                <button
                  type="button"
                  onClick={() => setSelectedMonth(currentMonthStr)}
                  className="px-3 py-2 bg-cream-200 hover:bg-cream-300 text-ink rounded-xl text-xs font-bold"
                >
                  Bulan Ini
                </button>
              </div>
            )}

            {periodType === 'tahunan' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-ink-muted">Pilih Tahun:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-4 py-2 bg-cream-50 border border-cream-300 rounded-xl text-sm font-mono font-bold text-ink focus:outline-none focus:ring-2 focus:ring-amber"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={String(y)}>
                      Tahun {y}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedYear(currentYearStr)}
                  className="px-3 py-2 bg-cream-200 hover:bg-cream-300 text-ink rounded-xl text-xs font-bold"
                >
                  Tahun Ini
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Selected Period Notification Pill */}
        <div className="flex items-center gap-2 text-xs text-forest bg-forest-surface px-4 py-2 rounded-2xl border border-forest/15">
          <Calendar className="w-4 h-4 text-forest flex-shrink-0" />
          <span className="font-bold">
            Menampilkan Laporan: <b className="font-extrabold">{activePeriodTitle}</b> ({filteredSales.length} transaksi penjualan, {filteredExpenses.length} catatan pengeluaran)
          </span>
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

      {/* 6. RINCIAN PENGELUARAN PADA PERIODE INI */}
      <div className="bg-card rounded-3xl shadow-card border border-cream-300 overflow-hidden">
        <div className="p-6 border-b border-cream-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-forest" />
            <div>
              <h3 className="font-extrabold text-lg text-ink">Rincian Pengeluaran & Biaya Toko</h3>
              <p className="text-xs text-ink-muted">Daftar beban operasional dan kulakan pada periode terpilih</p>
            </div>
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

      {/* 7. DAFTAR TRANSAKSI PENJUALAN PADA PERIODE INI */}
      <div className="bg-card rounded-3xl shadow-card border border-cream-300 overflow-hidden">
        <div className="p-6 border-b border-cream-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-forest" />
            <div>
              <h3 className="font-extrabold text-lg text-ink">Daftar Transaksi Penjualan Kasir</h3>
              <p className="text-xs text-ink-muted">Riwayat nota transaksi kasir pada periode terpilih</p>
            </div>
          </div>
          <span className="text-xs bg-forest-surface font-bold px-3 py-1.5 rounded-xl border border-forest/15 text-forest">
            {filteredSales.length} Nota • Omset: {formatRupiah(totalRevenue)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-100 border-b border-cream-300 text-xs font-extrabold text-ink-muted uppercase tracking-wider">
                <th className="py-4 px-6">No. Nota</th>
                <th className="py-4 px-6">Waktu Transaksi</th>
                <th className="py-4 px-6">Metode</th>
                <th className="py-4 px-6">Kasir</th>
                <th className="py-4 px-6 text-right">Omset (Total)</th>
                <th className="py-4 px-6 text-right">Laba Kotor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-sm">
              {filteredSales.map((s) => (
                <tr key={s.id} className="hover:bg-cream-50/70 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-forest text-xs">
                    {s.receipt_number}
                  </td>
                  <td className="py-4 px-6 text-xs text-ink-muted">
                    {formatDateIndo(s.transaction_date)}
                  </td>
                  <td className="py-4 px-6">
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
                  </td>
                  <td className="py-4 px-6 text-xs text-ink font-semibold">
                    {s.cashier_name}
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-extrabold text-sm text-ink">
                    {formatRupiah(s.total_amount)}
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-bold text-xs text-status-successText">
                    +{formatRupiah(s.gross_profit)}
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-ink-muted">
                    Tidak ada transaksi penjualan pada periode ini.
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
