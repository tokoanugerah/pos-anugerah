import React, { useState, useEffect, useCallback } from 'react';
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
  Tags,
  Plus,
  Trash2,
  RotateCcw,
  CloudUpload,
  CloudDownload,
  Database,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  getStoreSettings,
  saveStoreSettings,
  clearAllStoreData,
  db,
  DEFAULT_CATEGORIES,
  getProductCategories,
  saveProductCategories,
} from '../db';
import {
  syncLocalToTurso,
  pullTursoToLocal,
  testTursoConnection,
  getTursoCloudStats,
  getLastSyncTime,
  isTursoConfigured,
  syncStoreSettingsToTurso,
  pullStoreSettingsFromTurso,
} from '../db/turso';
import type { StoreSettings } from '../types';
import { playSuccessBeep, playErrorBeep, playKeyClick } from '../utils/sound';
import { formatDateIndo, generateId } from '../utils/format';
import { ActionConfirmModal } from '../components/ActionConfirmModal';
import { ToastAlert, type ToastMessage } from '../components/ToastAlert';

interface SettingsPageProps {
  onRefreshAll: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onRefreshAll }) => {
  const [settings, setSettings] = useState<StoreSettings>(getStoreSettings());
  const [saveAlert, setSaveAlert] = useState(false);
  const [restoreStats, setRestoreStats] = useState<string | null>(null);

  // Category management states
  const [categories, setCategories] = useState<string[]>(() => getProductCategories());
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryAlert, setCategoryAlert] = useState<string | null>(null);

  // Theme-Matching Confirmation Modal & Toast States
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isConfirmDeleteCategoryOpen, setIsConfirmDeleteCategoryOpen] = useState(false);
  const [isConfirmResetCategoryOpen, setIsConfirmResetCategoryOpen] = useState(false);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);

  interface PendingRestore {
    products: unknown[];
    sales: unknown[];
    sale_items: unknown[];
    expenses: unknown[];
    stock_audits: unknown[];
    monthly_summaries: unknown[];
    importedSettings?: StoreSettings;
  }
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Turso Cloud Database States
  const [tursoStatus, setTursoStatus] = useState<'checking' | 'connected' | 'disconnected' | 'unconfigured'>('checking');
  const [tursoStats, setTursoStats] = useState<{ products: number; sales: number; expenses: number } | null>(null);
  const [localStats, setLocalStats] = useState<{ products: number; sales: number; expenses: number } | null>(null);
  const [isTursoSyncing, setIsTursoSyncing] = useState(false);
  const [isTursoPulling, setIsTursoPulling] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string | null>(() => {
    const ts = getLastSyncTime();
    return ts ? formatDateIndo(ts) : null;
  });

  const refreshTursoInfo = useCallback(async () => {
    if (!isTursoConfigured()) {
      setTursoStatus('unconfigured');
      return;
    }
    setTursoStatus('checking');
    try {
      const [conn, stats, prodCount, saleCount, expCount] = await Promise.all([
        testTursoConnection(),
        getTursoCloudStats(),
        db.products.count(),
        db.sales.count(),
        db.expenses.count(),
      ]);
      setTursoStatus(conn.success ? 'connected' : 'disconnected');
      if (stats.connected) {
        setTursoStats({
          products: stats.counts.products,
          sales: stats.counts.sales,
          expenses: stats.counts.expenses,
        });
      }
      setLocalStats({
        products: prodCount,
        sales: saleCount,
        expenses: expCount,
      });
      const ts = getLastSyncTime();
      if (ts) setLastSyncText(formatDateIndo(ts));
    } catch {
      setTursoStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      if (!isTursoConfigured()) {
        if (!isCancelled) setTursoStatus('unconfigured');
        return;
      }
      try {
        const [conn, stats, prodCount, saleCount, expCount] = await Promise.all([
          testTursoConnection(),
          getTursoCloudStats(),
          db.products.count(),
          db.sales.count(),
          db.expenses.count(),
        ]);
        if (isCancelled) return;
        setTursoStatus(conn.success ? 'connected' : 'disconnected');
        if (stats.connected) {
          setTursoStats({
            products: stats.counts.products,
            sales: stats.counts.sales,
            expenses: stats.counts.expenses,
          });
        }
        setLocalStats({
          products: prodCount,
          sales: saleCount,
          expenses: expCount,
        });
        const ts = getLastSyncTime();
        if (ts) setLastSyncText(formatDateIndo(ts));
      } catch {
        if (!isCancelled) setTursoStatus('disconnected');
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handlePushToTurso = async () => {
    setIsTursoSyncing(true);
    playKeyClick();
    try {
      const res = await syncLocalToTurso();
      await syncStoreSettingsToTurso({ ...settings, categories });
      if (res.success) {
        playSuccessBeep();
        addToast(
          'success',
          'Sinkronisasi Cloud Berhasil',
          `${res.counts.produk ?? 0} produk, ${res.counts.transaksi ?? 0} transaksi, serta profil toko & kategori berhasil disimpan ke Turso Cloud.`
        );
        await refreshTursoInfo();
        onRefreshAll();
      } else {
        playErrorBeep();
        addToast('warning', 'Sinkronisasi Terkendala', res.message);
      }
    } catch (err: unknown) {
      playErrorBeep();
      const msg = err instanceof Error ? err.message : String(err);
      addToast('warning', 'Gagal Sinkronisasi', msg);
    } finally {
      setIsTursoSyncing(false);
    }
  };

  const handlePullFromTurso = async () => {
    setIsTursoPulling(true);
    playKeyClick();
    try {
      const res = await pullTursoToLocal();
      const remoteSettings = await pullStoreSettingsFromTurso();
      if (remoteSettings) {
        setSettings(remoteSettings);
        if (remoteSettings.categories) setCategories(remoteSettings.categories);
      }
      if (res.success) {
        playSuccessBeep();
        addToast(
          'success',
          'Data Cloud Berhasil Diunduh',
          `${res.counts.produk ?? 0} produk & ${res.counts.transaksi ?? 0} transaksi berhasil diselaraskan ke perangkat ini.`
        );
        await refreshTursoInfo();
        onRefreshAll();
      } else {
        playErrorBeep();
        addToast('warning', 'Gagal Mengunduh', res.message);
      }
    } catch (err: unknown) {
      playErrorBeep();
      const msg = err instanceof Error ? err.message : String(err);
      addToast('warning', 'Gagal Mengunduh', msg);
    } finally {
      setIsTursoPulling(false);
    }
  };

  const addToast = (type: 'success' | 'delete' | 'warning' | 'info', title: string, description?: string) => {
    const id = generateId('toast');
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings = {
      ...settings,
      categories,
    };
    saveStoreSettings(updatedSettings);
    syncStoreSettingsToTurso(updatedSettings).catch(console.warn);
    playSuccessBeep();
    setSaveAlert(true);
    addToast('success', 'Pengaturan Profil Disimpan', 'Profil toko & format struk telah disimpan di lokal dan disinkronkan ke database Cloud Turso.');
    setTimeout(() => setSaveAlert(false), 2500);
    onRefreshAll();
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;

    // Check if category already exists (case-insensitive)
    const exists = categories.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      playErrorBeep();
      setCategoryAlert(`Kategori "${trimmed}" sudah ada di daftar.`);
      addToast('warning', 'Kategori Duplikat', `Kategori "${trimmed}" sudah terdaftar.`);
      setTimeout(() => setCategoryAlert(null), 2500);
      return;
    }

    const updated = [...categories, trimmed];
    setCategories(updated);
    saveProductCategories(updated);
    const updatedSettings = { ...getStoreSettings(), categories: updated };
    syncStoreSettingsToTurso(updatedSettings).catch(console.warn);
    setNewCategoryInput('');
    playSuccessBeep();
    setCategoryAlert(`Kategori "${trimmed}" berhasil ditambahkan!`);
    addToast('success', 'Kategori Ditambahkan', `"${trimmed}" kini tersimpan di database & dapat dipilih saat input barang baru.`);
    setTimeout(() => setCategoryAlert(null), 2500);
    onRefreshAll();
  };

  const handlePromptDeleteCategory = (catToDelete: string) => {
    if (categories.length <= 1) {
      addToast('warning', 'Tidak Dapat Dihapus', 'Minimal harus ada 1 kategori barang di sistem toko.');
      return;
    }
    playKeyClick();
    setCategoryToDelete(catToDelete);
    setIsConfirmDeleteCategoryOpen(true);
  };

  const executeDeleteCategory = () => {
    if (!categoryToDelete) return;
    const updated = categories.filter((c) => c !== categoryToDelete);
    setCategories(updated);
    saveProductCategories(updated);
    const updatedSettings = { ...getStoreSettings(), categories: updated };
    syncStoreSettingsToTurso(updatedSettings).catch(console.warn);
    playKeyClick();
    setIsConfirmDeleteCategoryOpen(false);
    addToast('delete', 'Kategori Dihapus', `Kategori "${categoryToDelete}" telah dihapus.`);
    setCategoryAlert(`Kategori "${categoryToDelete}" berhasil dihapus.`);
    setTimeout(() => setCategoryAlert(null), 2500);
    setCategoryToDelete(null);
    onRefreshAll();
  };

  const handlePromptResetCategories = () => {
    playKeyClick();
    setIsConfirmResetCategoryOpen(true);
  };

  const executeResetCategories = () => {
    setCategories(DEFAULT_CATEGORIES);
    saveProductCategories(DEFAULT_CATEGORIES);
    const updatedSettings = { ...getStoreSettings(), categories: DEFAULT_CATEGORIES };
    syncStoreSettingsToTurso(updatedSettings).catch(console.warn);
    playSuccessBeep();
    setIsConfirmResetCategoryOpen(false);
    addToast('success', 'Kategori Direset', 'Daftar kategori dikembalikan ke pilihan standar sistem & disinkronkan ke database.');
    setCategoryAlert('Daftar kategori berhasil dikembalikan ke standar awal.');
    setTimeout(() => setCategoryAlert(null), 2500);
    onRefreshAll();
  };

  const handlePromptClearAll = () => {
    playKeyClick();
    setIsConfirmClearAllOpen(true);
  };

  const executeClearAll = async () => {
    try {
      await clearAllStoreData();
      playSuccessBeep();
      setIsConfirmClearAllOpen(false);
      setSettings(getStoreSettings());
      setCategories(getProductCategories());
      setRestoreStats('Sistem berhasil dikosongkan! Seluruh data produk & transaksi telah bersih dan siap diisi.');
      addToast(
        'delete',
        'Sistem Bersih Seperti Baru',
        'Seluruh produk dan transaksi toko telah dikosongkan. Toko siap diisi dari awal.'
      );
      onRefreshAll();
    } catch (err) {
      console.error(err);
      addToast('warning', 'Gagal Mengosongkan', 'Terjadi kesalahan sistem saat mengosongkan database.');
    }
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
        storeSettings: {
          ...settings,
          categories,
        },
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
      addToast('warning', 'Gagal Mencadangkan', 'Terjadi kesalahan saat mengumpulkan data cadangan.');
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

        setPendingRestore({
          products,
          sales,
          sale_items,
          expenses,
          stock_audits,
          monthly_summaries,
          importedSettings,
        });
        playKeyClick();
        setIsConfirmRestoreOpen(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        playErrorBeep();
        addToast('warning', 'Format File Salah', msg);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const executeRestoreBackup = async () => {
    if (!pendingRestore) return;
    try {
      const {
        products,
        sales,
        sale_items,
        expenses,
        stock_audits,
        monthly_summaries,
        importedSettings,
      } = pendingRestore;

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

          if (products.length > 0) await db.products.bulkAdd(products as never);
          if (sales.length > 0) await db.sales.bulkAdd(sales as never);
          if (sale_items.length > 0) await db.sale_items.bulkAdd(sale_items as never);
          if (expenses.length > 0) await db.expenses.bulkAdd(expenses as never);
          if (stock_audits.length > 0) await db.stock_audits.bulkAdd(stock_audits as never);
          if (monthly_summaries.length > 0) await db.monthly_summaries.bulkAdd(monthly_summaries as never);
        }
      );

      if (importedSettings) {
        saveStoreSettings(importedSettings);
        setSettings(importedSettings);
        if (Array.isArray(importedSettings.categories) && importedSettings.categories.length > 0) {
          setCategories(importedSettings.categories);
          saveProductCategories(importedSettings.categories);
        }
      }

      playSuccessBeep();
      setIsConfirmRestoreOpen(false);
      setRestoreStats(
        `Pemulihan Berhasil! ${products.length} produk, ${sales.length} transaksi, dan ${expenses.length} catatan pengeluaran berhasil dipulihkan secara utuh.`
      );
      addToast(
        'success',
        'Data Toko Berhasil Dipulihkan',
        `${products.length} produk & ${sales.length} transaksi telah aktif kembali.`
      );
      setPendingRestore(null);
      onRefreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      playErrorBeep();
      addToast('warning', 'Gagal Memulihkan', msg);
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
          Atur informasi struk kasir, jenis kategori produk, dan kelola pencadangan data lokal (JSON)
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
        {/* KOLOM KIRI: CADANGAN DATA LOKAL & KATEGORI (7 Kolom) */}
        <div className="lg:col-span-7 space-y-6">
          {/* MANAJEMEN KATEGORI BARANG */}
          <div className="bg-card p-6 sm:p-8 rounded-3xl shadow-card border border-cream-300 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-cream-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-forest-surface flex items-center justify-center text-forest">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-ink">
                    Manajemen Kategori Barang
                  </h3>
                  <p className="text-xs text-ink-muted">Kelola kategori produk toko yang dapat dipilih saat input barang</p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-forest-surface text-forest">
                {categories.length} Kategori
              </span>
            </div>

            {categoryAlert && (
              <div className="p-3 bg-amber-light border border-amber text-forest rounded-xl font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-dark" />
                <span>{categoryAlert}</span>
              </div>
            )}

            {/* Form Tambah Kategori Baru */}
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                placeholder="Ketik nama kategori baru (cth: Frozen Food, Kosmetik)..."
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="flex-1 px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-semibold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
              />
              <button
                type="submit"
                className="px-5 py-3 bg-amber hover:bg-amber-hover text-forest font-black rounded-2xl text-sm transition-all shadow-sm flex items-center gap-1.5 active:scale-95 flex-shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Tambah</span>
              </button>
            </form>

            {/* List of Categories */}
            <div>
              <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2.5">
                Daftar Kategori Aktif (Dapat Dipilih Saat Tambah Produk):
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center gap-2 px-3.5 py-2 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-xl text-xs font-extrabold text-ink transition-colors group"
                  >
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handlePromptDeleteCategory(cat)}
                      className="text-ink-subtle hover:text-status-dangerText transition-colors p-0.5 rounded-md hover:bg-white"
                      title={`Hapus kategori ${cat}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-cream-200 flex items-center justify-between">
              <span className="text-[11px] text-ink-muted">
                Kategori tersimpan otomatis di sistem kasir dan terikut dalam berkas cadangan JSON
              </span>
              <button
                type="button"
                onClick={handlePromptResetCategories}
                className="text-xs text-ink-subtle hover:text-forest font-bold flex items-center gap-1 transition-colors"
                title="Kembalikan daftar ke bawaan standar sistem"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Standar</span>
              </button>
            </div>
          </div>

          {/* DATABASE CLOUD TURSO LIBSQL */}
          <div className="bg-card p-6 sm:p-8 rounded-3xl shadow-card border border-cream-300 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-cream-200 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-forest-surface flex items-center justify-center text-forest">
                  <Database className="w-5 h-5 text-forest" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-ink flex items-center gap-2">
                    Database Cloud Turso (libSQL)
                    <span className="text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-md bg-amber/20 text-forest border border-amber/30">
                      Real-time Sync
                    </span>
                  </h3>
                  <p className="text-xs text-ink-muted">Sinkronisasi otomatis antar-perangkat & cadangan cloud</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {tursoStatus === 'checking' && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber/10 text-amber-900 border border-amber/30 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                    Memeriksa Koneksi...
                  </span>
                )}
                {tursoStatus === 'connected' && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-status-successBg text-status-successText flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5" />
                    Terhubung ke Cloud Turso
                  </span>
                )}
                {tursoStatus === 'disconnected' && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-status-dangerBg text-status-dangerText flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5" />
                    Koneksi Cloud Terputus
                  </span>
                )}
                {tursoStatus === 'unconfigured' && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-cream-200 text-ink-muted flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Kredensial Belum Terpasang
                  </span>
                )}
                <button
                  type="button"
                  onClick={refreshTursoInfo}
                  className="p-1.5 rounded-xl text-ink-muted hover:text-forest hover:bg-cream-100 transition-colors"
                  title="Periksa Ulang Koneksi"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Information Box */}
            <div className="p-4 bg-cream-50 rounded-2xl border border-cream-200 text-xs text-ink-muted leading-relaxed space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-semibold text-ink">
                  Endpoint Server: <code className="text-[11px] font-mono text-forest bg-forest-surface px-1.5 py-0.5 rounded">pos-anugerah-tokoanugerah.aws-ap-northeast-1.turso.io</code>
                </span>
                {lastSyncText && (
                  <span className="text-[11px] text-forest font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Terakhir Sinkron: {lastSyncText}
                  </span>
                )}
              </div>
              <p>
                • <b>Sinkronisasi Otomatis Aktif:</b> Setiap kali Anda menambah/mengubah produk atau kasir menyelesaikan transaksi nota, data langsung tercatat ke database lokal dan secara otomatis dikirim ke remote Turso Cloud di latar belakang.
              </p>
              <p>
                • <b>Multi-Perangkat (Laptop & HP):</b> Anda dapat menggunakan sistem di komputer kasir toko dan di HP secara bersamaan. Gunakan tombol "Tarik Data dari Cloud" pada HP/perangkat baru untuk menyalin seluruh data produk dan riwayat penjualan.
              </p>
            </div>

            {/* Comparison Counters: Local vs Cloud */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-canvas p-3.5 rounded-2xl border border-cream-300 text-center">
                <span className="text-[11px] font-bold text-ink-muted block uppercase tracking-wider">Produk</span>
                <div className="mt-1 flex items-baseline justify-center gap-1.5">
                  <span className="text-lg font-black text-forest">{localStats?.products ?? 0}</span>
                  <span className="text-[10px] text-ink-subtle">lokal</span>
                  <span className="text-xs text-ink-subtle">/</span>
                  <span className="text-lg font-black text-amber-700">{tursoStats?.products ?? 0}</span>
                  <span className="text-[10px] text-ink-subtle">cloud</span>
                </div>
              </div>

              <div className="bg-canvas p-3.5 rounded-2xl border border-cream-300 text-center">
                <span className="text-[11px] font-bold text-ink-muted block uppercase tracking-wider">Transaksi</span>
                <div className="mt-1 flex items-baseline justify-center gap-1.5">
                  <span className="text-lg font-black text-forest">{localStats?.sales ?? 0}</span>
                  <span className="text-[10px] text-ink-subtle">lokal</span>
                  <span className="text-xs text-ink-subtle">/</span>
                  <span className="text-lg font-black text-amber-700">{tursoStats?.sales ?? 0}</span>
                  <span className="text-[10px] text-ink-subtle">cloud</span>
                </div>
              </div>

              <div className="bg-canvas p-3.5 rounded-2xl border border-cream-300 text-center">
                <span className="text-[11px] font-bold text-ink-muted block uppercase tracking-wider">Pengeluaran</span>
                <div className="mt-1 flex items-baseline justify-center gap-1.5">
                  <span className="text-lg font-black text-forest">{localStats?.expenses ?? 0}</span>
                  <span className="text-[10px] text-ink-subtle">lokal</span>
                  <span className="text-xs text-ink-subtle">/</span>
                  <span className="text-lg font-black text-amber-700">{tursoStats?.expenses ?? 0}</span>
                  <span className="text-[10px] text-ink-subtle">cloud</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* TOMBOL PUSH KE CLOUD */}
              <button
                type="button"
                onClick={handlePushToTurso}
                disabled={isTursoSyncing || isTursoPulling}
                className="py-3.5 px-5 bg-forest hover:bg-forest-light disabled:opacity-50 text-white font-extrabold rounded-2xl text-sm shadow-elevated flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
              >
                {isTursoSyncing ? (
                  <>
                    <Loader2 className="w-5 h-5 text-amber animate-spin" />
                    <span>Mengirim Data ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-5 h-5 text-amber" />
                    <span>Sinkronkan Sekarang (Kirim ke Cloud)</span>
                  </>
                )}
              </button>

              {/* TOMBOL TARIK DARI CLOUD */}
              <button
                type="button"
                onClick={handlePullFromTurso}
                disabled={isTursoSyncing || isTursoPulling}
                className="py-3.5 px-5 bg-amber hover:bg-amber-hover disabled:opacity-50 text-forest font-black rounded-2xl text-sm shadow-elevated flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
              >
                {isTursoPulling ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Mengunduh dari Cloud...</span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="w-5 h-5 stroke-[2.5]" />
                    <span>Tarik Data dari Cloud (Download)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CADANGAN DATA LOKAL (JSON BACKUP) */}
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

            <div className="pt-4 border-t border-cream-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePromptClearAll}
                className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-status-dangerText border border-red-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-status-dangerText" />
                <span>Kosongkan Seluruh Data (Mulai Baru)</span>
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

      {/* Confirmation Modal for DELETING Category */}
      <ActionConfirmModal
        isOpen={isConfirmDeleteCategoryOpen}
        onClose={() => {
          setIsConfirmDeleteCategoryOpen(false);
          setCategoryToDelete(null);
        }}
        onConfirm={executeDeleteCategory}
        type="delete"
        title="Hapus Kategori Barang?"
        description="Kategori ini tidak akan muncul lagi sebagai opsi pengelompokan produk baru di kasir:"
        details={
          categoryToDelete
            ? [
                { label: 'Nama Kategori', value: categoryToDelete, highlight: true },
                { label: 'Tipe', value: 'Kategori Produk Toko' },
              ]
            : []
        }
        confirmText="Ya, Hapus Kategori"
        cancelText="Batal"
      />

      {/* Confirmation Modal for RESETTING Categories to Default */}
      <ActionConfirmModal
        isOpen={isConfirmResetCategoryOpen}
        onClose={() => setIsConfirmResetCategoryOpen(false)}
        onConfirm={executeResetCategories}
        type="warning"
        title="Kembalikan Kategori ke Standar?"
        description="Daftar kategori produk akan dikembalikan ke 8 kategori bawaan sistem Anugerah Store:"
        details={[
          {
            label: 'Kategori Standar',
            value: DEFAULT_CATEGORIES.join(', '),
          },
        ]}
        confirmText="Ya, Reset ke Standar"
        cancelText="Batal"
      />

      {/* Confirmation Modal for CLEARING ALL STORE DATA (FRESH START) */}
      <ActionConfirmModal
        isOpen={isConfirmClearAllOpen}
        onClose={() => setIsConfirmClearAllOpen(false)}
        onConfirm={executeClearAll}
        type="delete"
        title="Kosongkan Seluruh Data Toko?"
        description="Perhatian: Anda akan menghapus SELURUH data produk, riwayat transaksi kasir, pengeluaran, dan audit stok. Sistem akan kembali bersih total seperti baru dan siap diisi dari awal."
        details={[
          {
            label: 'Tindakan',
            value: 'Hapus Bersih Total Database Toko',
            highlight: true,
          },
          {
            label: 'Kondisi Sistem',
            value: 'Sistem siap diisi dengan produk & transaksi riil toko',
          },
          {
            label: 'Saran',
            value: 'Pastikan sudah mengunduh cadangan JSON jika data lama masih diperlukan',
          },
        ]}
        confirmText="Ya, Kosongkan & Mulai Baru"
        cancelText="Batal"
      />

      {/* Confirmation Modal for RESTORING JSON Backup */}
      <ActionConfirmModal
        isOpen={isConfirmRestoreOpen}
        onClose={() => {
          setIsConfirmRestoreOpen(false);
          setPendingRestore(null);
        }}
        onConfirm={executeRestoreBackup}
        type="warning"
        title="Konfirmasi Pemulihan Berkas Cadangan (JSON)"
        description="Data saat ini akan digantikan secara utuh oleh isi file cadangan yang diunggah:"
        details={
          pendingRestore
            ? [
                {
                  label: 'Data Produk Terdaftar',
                  value: `${pendingRestore.products.length} item barang`,
                  highlight: true,
                },
                {
                  label: 'Riwayat Transaksi Kasir',
                  value: `${pendingRestore.sales.length} nota transaksi`,
                },
                {
                  label: 'Rincian Item Terjual',
                  value: `${pendingRestore.sale_items.length} baris barang`,
                },
                {
                  label: 'Catatan Pengeluaran & Biaya',
                  value: `${pendingRestore.expenses.length} data biaya`,
                },
                {
                  label: 'Riwayat Stok Opname',
                  value: `${pendingRestore.stock_audits.length} catatan audit`,
                },
              ]
            : []
        }
        confirmText="Ya, Pulihkan Sekarang"
        cancelText="Batalkan Pemulihan"
      />

      {/* Floating Feedback Toast Alerts */}
      <ToastAlert toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};
