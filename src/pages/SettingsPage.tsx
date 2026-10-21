import React, { useState } from 'react';
import {
  Download,
  Upload,
  Store,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  FileCheck,
  Shield,
  Clock,
} from 'lucide-react';
import {
  getStoreSettings,
  saveStoreSettings,
  resetDatabaseToInitial,
  db,
} from '../db';
import type { StoreSettings } from '../types';
import { playSuccessBeep, playErrorBeep, playKeyClick } from '../utils/sound';
import { formatDateIndo } from '../utils/format';

interface SettingsPageProps {
  onRefreshAll: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onRefreshAll }) => {
  const [settings, setSettings] = useState<StoreSettings>(getStoreSettings());
  const [saveAlert, setSaveAlert] = useState(false);
  const [restoreStats, setRestoreStats] = useState<string | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoreSettings(settings);
    playSuccessBeep();
    setSaveAlert(true);
    setTimeout(() => setSaveAlert(false), 2500);
    onRefreshAll();
  };

  // Export 100% Complete IndexedDB backup (All tables + settings)
  const handleExportBackup = async () => {
    playKeyClick();
    try {
      const products = await db.products.toArray();
      const sales = await db.sales.toArray();
      const sale_items = await db.sale_items.toArray();
      const expenses = await db.expenses.toArray();
      const stock_audits = await db.stock_audits.toArray();
      const monthly_summaries = await db.monthly_summaries.toArray();

      const backupPayload = {
        app: 'Anugerah Store',
        version: 2,
        exportedAt: new Date().toISOString(),
        storeSettings: settings,
        data: {
          products,
          sales,
          sale_items,
          expenses,
          stock_audits,
          monthly_summaries,
        },
        counts: {
          products: products.length,
          sales: sales.length,
          sale_items: sale_items.length,
          expenses: expenses.length,
          stock_audits: stock_audits.length,
        },
      };

      const now = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
      const filename = `Cadangan_Lengkap_AnugerahStore_${datePart}_${timePart}.json`;

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const updatedSettings = {
        ...settings,
        lastBackupDate: new Date().toISOString(),
      };
      setSettings(updatedSettings);
      saveStoreSettings(updatedSettings);

      playSuccessBeep();
      setRestoreStats(`Berkas cadangan berhasil diunduh! (${products.length} produk, ${sales.length} transaksi, ${expenses.length} biaya).`);
    } catch (err) {
      console.error('Gagal mencadangkan database:', err);
      playErrorBeep();
      alert('Terjadi kesalahan saat mengumpulkan data cadangan.');
    }
  };

  // Restore 100% Complete IndexedDB backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const json = JSON.parse(content);

        // Support both direct root array structure and wrapped payload format
        const products = json.data?.products || json.products;
        const sales = json.data?.sales || json.sales;
        const sale_items = json.data?.sale_items || json.sale_items || [];
        const expenses = json.data?.expenses || json.expenses || [];
        const stock_audits = json.data?.stock_audits || json.stock_audits || [];
        const monthly_summaries = json.data?.monthly_summaries || json.monthly_summaries || [];
        const importedSettings = json.storeSettings || settings;

        if (!Array.isArray(products) || !Array.isArray(sales)) {
          throw new Error('Format file tidak valid. Berkas JSON harus memuat data produk dan penjualan Anugerah Store.');
        }

        const confirmText =
          `Ditemukan data cadangan:\n` +
          `• Produk: ${products.length} item\n` +
          `• Transaksi Kasir: ${sales.length} nota\n` +
          `• Rincian Item: ${sale_items.length} baris\n` +
          `• Catatan Pengeluaran: ${expenses.length} biaya\n` +
          `• Riwayat Stok Opname: ${stock_audits.length} audit\n\n` +
          `Apakah Anda yakin ingin memulihkan seluruh data ini? Data saat ini akan digantikan oleh isi file cadangan.`;

        if (!confirm(confirmText)) {
          // Reset file input
          e.target.value = '';
          return;
        }

        // Perform atomic restore in transaction
        await db.transaction(
          'rw',
          [db.products, db.sales, db.sale_items, db.expenses, db.stock_audits, db.monthly_summaries],
          async () => {
            await db.products.clear();
            await db.sales.clear();
            await db.sale_items.clear();
            await db.expenses.clear();
            await db.stock_audits.clear();
            await db.monthly_summaries.clear();

            if (products.length > 0) await db.products.bulkAdd(products);
            if (sales.length > 0) await db.sales.bulkAdd(sales);
            if (sale_items.length > 0) await db.sale_items.bulkAdd(sale_items);
            if (expenses.length > 0) await db.expenses.bulkAdd(expenses);
            if (stock_audits.length > 0) await db.stock_audits.bulkAdd(stock_audits);
            if (monthly_summaries.length > 0) await db.monthly_summaries.bulkAdd(monthly_summaries);
          }
        );

        if (importedSettings) {
          saveStoreSettings(importedSettings);
          setSettings(importedSettings);
        }

        playSuccessBeep();
        setRestoreStats(
          `Pemulihan Berhasil! ${products.length} produk, ${sales.length} transaksi, dan ${expenses.length} catatan pengeluaran berhasil dipulihkan secara utuh.`
        );
        onRefreshAll();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        playErrorBeep();
        alert('Gagal memulihkan file cadangan: ' + msg);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Reset to default seed
  const handleResetSeed = async () => {
    if (confirm('Apakah Anda yakin ingin me-reset database ke data contoh awal Anugerah Store? Data transaksi saat ini akan dihapus.')) {
      playKeyClick();
      await resetDatabaseToInitial();
      playSuccessBeep();
      setRestoreStats('Database berhasil dimuat ulang ke data contoh awal!');
      onRefreshAll();
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300">
        <span className="text-xs font-bold text-forest tracking-wider uppercase bg-forest-surface px-3 py-1 rounded-full">
          Konfigurasi Sistem
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-ink mt-1.5">
          Pengaturan Toko & Keamanan Data
        </h1>
        <p className="text-sm text-ink-muted">
          Atur informasi struk kasir dan kelola pencadangan data lokal (JSON) agar aman dari risiko kehilangan
        </p>
      </div>

      {saveAlert && (
        <div className="p-4 bg-status-successBg border border-status-successText text-status-successText rounded-2xl font-bold text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>Pengaturan profil Anugerah Store berhasil disimpan!</span>
        </div>
      )}

      {restoreStats && (
        <div className="p-4 bg-forest-surface border border-forest/30 text-forest rounded-2xl font-bold text-sm flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-forest" />
          <span>{restoreStats}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* KOLOM KIRI: CADANGAN DATA LOKAL (JSON) (7 Kolom) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card p-6 sm:p-8 rounded-3xl shadow-card border border-cream-300 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-cream-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-forest-surface flex items-center justify-center text-forest">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-ink">
                    Cadangan Data Lokal (JSON Backup)
                  </h3>
                  <p className="text-xs text-ink-muted">Penyelamat data komprehensif toko</p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-status-successBg text-status-successText flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                100% Mandiri & Aman
              </span>
            </div>

            <div className="p-4 bg-cream-50 rounded-2xl border border-cream-200 text-xs text-ink-muted leading-relaxed space-y-2">
              <p>
                • Seluruh database tersimpan di peramban (IndexedDB) kasir tanpa biaya sewa server.
              </p>
              <p>
                • <b>Saran Keamanan:</b> Unduh salinan cadangan berkala (misalnya setiap tutup toko sore/malam hari) ke flashdisk atau Google Drive komputer toko.
              </p>
              {settings.lastBackupDate && (
                <p className="text-forest font-semibold flex items-center gap-1.5 pt-1 border-t border-cream-200">
                  <Clock className="w-3.5 h-3.5" />
                  Cadangan Terakhir Diunduh: {formatDateIndo(settings.lastBackupDate)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* TOMBOL UNDUH CADANGAN */}
              <button
                type="button"
                onClick={handleExportBackup}
                className="py-4 px-5 bg-forest hover:bg-forest-light text-white font-extrabold rounded-2xl text-sm shadow-elevated flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
              >
                <Download className="w-5 h-5 text-amber" />
                <span>Unduh Cadangan Lengkap (JSON)</span>
              </button>

              {/* TOMBOL PULIHKAN DARI FILE */}
              <label className="py-4 px-5 bg-amber hover:bg-amber-hover text-forest font-black rounded-2xl text-sm shadow-elevated flex items-center justify-center gap-2.5 transition-all cursor-pointer text-center active:scale-[0.98]">
                <Upload className="w-5 h-5 stroke-[2.5]" />
                <span>Pulihkan dari File JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-4 border-t border-cream-200 flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                Perlu reset untuk latihan atau demonstrasi?
              </span>
              <button
                type="button"
                onClick={handleResetSeed}
                className="text-xs text-status-dangerText hover:underline font-bold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Data Contoh Awal (Demo Reset)</span>
              </button>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: PROFIL TOKO & FORMAT STRUK (5 Kolom) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-card p-6 sm:p-8 rounded-3xl shadow-card border border-cream-300">
            <div className="flex items-center gap-2.5 pb-4 border-b border-cream-200">
              <Store className="w-5 h-5 text-forest" />
              <h3 className="font-extrabold text-lg text-ink">Profil & Format Struk Toko</h3>
            </div>

            <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Nama Toko (Tampil di Nota Kasir)
                </label>
                <input
                  type="text"
                  required
                  value={settings.storeName}
                  onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                  className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-black text-forest text-base focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Alamat Lengkap Toko
                </label>
                <input
                  type="text"
                  value={settings.storeAddress}
                  onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                  placeholder="Cth: Jl. Merdeka No. 45, Pasar Induk"
                  className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-semibold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Nomor Telepon / WhatsApp Toko
                </label>
                <input
                  type="text"
                  value={settings.storePhone}
                  onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
                  placeholder="Cth: 0812-3456-7890"
                  className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-semibold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Nama Kasir Standar
                </label>
                <input
                  type="text"
                  value={settings.cashierName}
                  onChange={(e) => setSettings({ ...settings, cashierName: e.target.value })}
                  className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-semibold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Pesan Catatan Kaki Struk (Footer Nota)
                </label>
                <textarea
                  rows={2}
                  value={settings.receiptFooter}
                  onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                  className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-semibold text-xs text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-forest hover:bg-forest-light text-white font-extrabold rounded-2xl text-sm shadow-sm transition-all"
              >
                Simpan Profil Toko
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
