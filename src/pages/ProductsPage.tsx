import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  PackagePlus,
  Search,
  Edit2,
  Trash2,
  Download,
  X,
  Check,
  Percent,
  ImagePlus,
  Upload,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import type { Product } from '../types';
import { formatRupiah, formatNumber, generateId } from '../utils/format';
import { playSuccessBeep, playKeyClick, playErrorBeep } from '../utils/sound';
import { ActionConfirmModal } from '../components/ActionConfirmModal';
import { ToastAlert, type ToastMessage } from '../components/ToastAlert';
import { AutoImageSearchModal } from '../components/AutoImageSearchModal';
import { db, getProductCategories, clearAllStoreData } from '../db';
import { compressProductImage } from '../utils/image';

interface ProductsPageProps {
  products: Product[];
  onRefresh: () => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoImageOpen, setIsAutoImageOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const productNameInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Confirmation Modals State
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmEditOpen, setIsConfirmEditOpen] = useState(false);

  // Toast feedback state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  // Otomatis bersihkan jika browser masih menyimpan data contoh tiruan awal
  useEffect(() => {
    const hasDummy = products.some(
      (p) =>
        p.id.startsWith('prod_') ||
        p.barcode === '899999900101' ||
        p.barcode === '899999900102' ||
        p.name.toLowerCase().includes('bimoli') ||
        p.name.toLowerCase().includes('rojolele')
    );
    if (hasDummy) {
      console.log('Terdeteksi sisa data contoh di Katalog Produk, membersihkan...');
      clearAllStoreData().then(() => {
        onRefresh();
      });
    }
  }, [products, onRefresh]);

  // Form State using Strings to eliminate sticky leading zero bug (024500)
  const [formImage, setFormImage] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Sembako');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formCostPriceStr, setFormCostPriceStr] = useState<string>('');
  const [formSellingPriceStr, setFormSellingPriceStr] = useState<string>('');
  const [formStockQuantityStr, setFormStockQuantityStr] = useState<string>('10');
  const [formMinStockAlertStr, setFormMinStockAlertStr] = useState<string>('5');

  // Dynamic categories from settings + any existing product categories
  const categories = useMemo(() => {
    const fromSettings = getProductCategories();
    const set = new Set<string>(['Semua', ...fromSettings]);
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const formAvailableCategories = useMemo(() => {
    const fromSettings = getProductCategories();
    const set = new Set<string>(fromSettings);
    if (formCategory) set.add(formCategory);
    return Array.from(set);
  }, [formCategory]);

  const standardUnits = useMemo(() => {
    return ['pcs', 'kg', 'liter', 'bungkus', 'botol', 'sak', 'pouch', 'renceng', 'dus', 'batang', 'kaleng', 'sachet'];
  }, []);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);

      let matchStock = true;
      if (stockFilter === 'out') {
        matchStock = p.stock_quantity <= 0;
      } else if (stockFilter === 'low') {
        matchStock = p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_alert;
      }

      return matchCategory && matchSearch && matchStock;
    });
  }, [products, selectedCategory, searchQuery, stockFilter]);

  // Open Modal for Add
  const handleOpenAddModal = () => {
    playKeyClick();
    const available = getProductCategories();
    setEditingProduct(null);
    setFormImage('');
    setFormSku('');
    setFormName('');
    setFormCategory(available[0] || 'Sembako');
    setFormUnit('pcs');
    setFormCostPriceStr('');
    setFormSellingPriceStr('');
    setFormStockQuantityStr('10');
    setFormMinStockAlertStr('5');
    setIsModalOpen(true);
    setTimeout(() => {
      productNameInputRef.current?.focus();
    }, 150);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (p: Product) => {
    playKeyClick();
    setEditingProduct(p);
    setFormImage(p.image || '');
    setFormSku(p.barcode || '');
    setFormName(p.name);
    setFormCategory(p.category);
    setFormUnit(p.unit || 'pcs');
    setFormCostPriceStr(p.cost_price > 0 ? String(p.cost_price) : '');
    setFormSellingPriceStr(p.selling_price > 0 ? String(p.selling_price) : '');
    setFormStockQuantityStr(String(p.stock_quantity));
    setFormMinStockAlertStr(String(p.min_stock_alert));
    setIsModalOpen(true);
  };

  // Handle image upload from camera or file picker
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const compressedDataUrl = await compressProductImage(file, 480, 0.82);
      setFormImage(compressedDataUrl);
      playSuccessBeep();
      addToast('success', 'Foto Produk Siap', 'Foto berhasil dikompres dan dimuat untuk produk ini.');
    } catch (err) {
      console.error('Gagal memproses gambar:', err);
      playErrorBeep();
      addToast('warning', 'Gagal Memuat Foto', 'Format gambar tidak didukung atau terjadi kesalahan sistem.');
    } finally {
      setIsProcessingImage(false);
      // Reset input value so re-selecting same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    playKeyClick();
    setFormImage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Clean numeric input handler: allows full deletion without leaving '0'
  const handleNumericInput = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setter(val);
  };

  const formCostPrice = Number(formCostPriceStr) || 0;
  const formSellingPrice = Number(formSellingPriceStr) || 0;
  const formStockQuantity = Number(formStockQuantityStr) || 0;
  const formMinStockAlert = Number(formMinStockAlertStr) || 1;

  // Prompt Save Product: if editing, triggers ActionConfirmModal first
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      playErrorBeep();
      addToast('warning', 'Data Belum Lengkap', 'Mohon isi nama barang.');
      return;
    }

    // If editing existing product, ask confirmation with detailed breakdown
    if (editingProduct) {
      playKeyClick();
      setIsConfirmEditOpen(true);
      return;
    }

    // If adding a brand new product
    await executeSaveProduct();
  };

  const executeSaveProduct = async () => {
    try {
      const nowIso = new Date().toISOString();
      const codeToUse = formSku.trim() || (editingProduct?.barcode ?? generateId('sku'));

      if (editingProduct) {
        await db.products.update(editingProduct.id, {
          barcode: codeToUse,
          name: formName.trim(),
          category: formCategory,
          unit: formUnit.trim() || 'pcs',
          cost_price: formCostPrice,
          selling_price: formSellingPrice,
          stock_quantity: formStockQuantity,
          min_stock_alert: formMinStockAlert,
          image: formImage || undefined,
          updated_at: nowIso,
        });

        playSuccessBeep();
        setIsConfirmEditOpen(false);
        setIsModalOpen(false);
        addToast(
          'success',
          'Perubahan Produk Disimpan',
          `Data produk "${formName}" berhasil diperbarui di katalog toko.`
        );
      } else {
        const newProduct: Product = {
          id: generateId('prod'),
          barcode: codeToUse,
          name: formName.trim(),
          category: formCategory,
          unit: formUnit.trim() || 'pcs',
          cost_price: formCostPrice,
          selling_price: formSellingPrice,
          stock_quantity: formStockQuantity,
          min_stock_alert: formMinStockAlert,
          image: formImage || undefined,
          is_active: 1,
          created_at: nowIso,
          updated_at: nowIso,
        };
        await db.products.add(newProduct);

        playSuccessBeep();
        setIsModalOpen(false);
        addToast(
          'success',
          'Produk Berhasil Ditambahkan',
          `"${formName}" telah terdaftar ke dalam stok toko.`
        );
      }

      onRefresh();
    } catch (err) {
      console.error('Gagal menyimpan produk:', err);
      addToast('warning', 'Gagal Menyimpan', 'Terjadi kesalahan sistem saat menyimpan ke basis data.');
    }
  };

  // Prompt Delete Product: triggers ActionConfirmModal
  const handlePromptDeleteProduct = (p: Product) => {
    playKeyClick();
    setProductToDelete(p);
    setIsConfirmDeleteOpen(true);
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await db.products.delete(productToDelete.id);
      playKeyClick();
      setIsConfirmDeleteOpen(false);
      addToast(
        'delete',
        'Produk Telah Dihapus',
        `"${productToDelete.name}" telah dihapus dari sistem toko.`
      );
      setProductToDelete(null);
      onRefresh();
    } catch (err) {
      console.error('Gagal menghapus produk:', err);
      addToast('warning', 'Gagal Menghapus', 'Terjadi kesalahan saat menghapus data produk.');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    playKeyClick();
    const headers = ['ID', 'Kode/SKU', 'Nama Barang', 'Kategori', 'Satuan', 'HPP Modal', 'Harga Jual', 'Stok', 'Batas Peringatan', 'Memiliki Foto'];
    const rows = products.map((p) => [
      p.id,
      p.barcode || '-',
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      p.unit || 'pcs',
      p.cost_price,
      p.selling_price,
      p.stock_quantity,
      p.min_stock_alert,
      p.image ? 'Ya' : 'Tidak',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Katalog_Produk_Anugerah_Store_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculated form profit & margin %
  const formProfit = formSellingPrice - formCostPrice;
  const formMarginPercent = formCostPrice > 0 ? ((formProfit / formCostPrice) * 100).toFixed(1) : '0';

  return (
    <div className="w-full space-y-6">
      {/* Top Header Bar */}
      <div className="bg-card p-6 rounded-3xl shadow-card border border-cream-300 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-forest tracking-wider uppercase bg-forest-surface px-3 py-1 rounded-full">
            Master Data & Inventaris
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-ink mt-1.5">
            Katalog Produk & Foto Barang
          </h1>
          <p className="text-sm text-ink-muted">
            Kelola foto produk, satuan unit, harga modal (HPP), harga jual ritel, serta ketersediaan stok
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-3 bg-cream-100 hover:bg-cream-200 text-ink font-bold rounded-2xl text-sm transition-colors border border-cream-300 flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-forest" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-5 py-3.5 bg-amber hover:bg-amber-hover text-forest font-black rounded-2xl text-sm transition-all shadow-elevated flex items-center gap-2 active:scale-95"
          >
            <PackagePlus className="w-5 h-5 text-forest" />
            <span>+ Tambah Barang Baru</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card p-5 rounded-3xl shadow-card border border-cream-300 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nama atau kategori barang..."
              className="w-full pl-11 pr-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-forest"
            />
          </div>

          {/* Quick Stock Status Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                stockFilter === 'all'
                  ? 'bg-forest text-white'
                  : 'bg-cream-100 text-ink-muted hover:bg-cream-200'
              }`}
            >
              Semua ({products.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                stockFilter === 'low'
                  ? 'bg-status-warningText text-white'
                  : 'bg-status-warningBg text-status-warningText'
              }`}
            >
              Menipis ({products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_alert).length})
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                stockFilter === 'out'
                  ? 'bg-status-dangerText text-white'
                  : 'bg-status-dangerBg text-status-dangerText'
              }`}
            >
              Habis ({products.filter((p) => p.stock_quantity <= 0).length})
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-cream-200">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-forest text-amber shadow-sm'
                  : 'bg-cream-100 text-ink-muted hover:bg-cream-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table of Products (Full Desktop Width) */}
      <div className="bg-card rounded-3xl shadow-card border border-cream-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-cream-100 border-b border-cream-300 text-xs font-extrabold text-ink-muted uppercase tracking-wider">
                <th className="py-4 px-4 text-center">Foto</th>
                <th className="py-4 px-6">Nama Barang</th>
                <th className="py-4 px-4">Kategori</th>
                <th className="py-4 px-4 text-center">Satuan</th>
                <th className="py-4 px-4 text-right">Modal (HPP)</th>
                <th className="py-4 px-4 text-right">Harga Jual</th>
                <th className="py-4 px-4 text-right">Margin / Laba</th>
                <th className="py-4 px-4 text-center">Stok</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200 text-sm">
              {filteredProducts.map((p) => {
                const profit = p.selling_price - p.cost_price;
                const marginPercent = p.cost_price > 0 ? ((profit / p.cost_price) * 100).toFixed(1) : '0';
                const isOutOfStock = p.stock_quantity <= 0;
                const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_alert;

                return (
                  <tr key={p.id} className="hover:bg-cream-50/70 transition-colors">
                    {/* Foto Produk */}
                    <td className="py-3 px-4 text-center">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover border border-cream-300 shadow-sm mx-auto"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-cream-100 border border-cream-300 flex items-center justify-center text-ink-subtle mx-auto">
                          <ImageIcon className="w-5 h-5 opacity-40" />
                        </div>
                      )}
                    </td>

                    {/* Name */}
                    <td className="py-4 px-6 font-bold text-ink">
                      <div>
                        <span>{p.name}</span>
                        {p.barcode && (
                          <span className="block font-mono text-[11px] text-ink-muted font-normal mt-0.5">
                            SKU: {p.barcode}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-4 text-xs font-semibold text-ink-muted">
                      {p.category}
                    </td>

                    {/* Unit */}
                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 bg-cream-100 text-ink font-bold text-xs rounded-xl border border-cream-200">
                        {p.unit || 'pcs'}
                      </span>
                    </td>

                    {/* Cost Price */}
                    <td className="py-4 px-4 text-right font-mono font-medium text-ink-muted">
                      {formatRupiah(p.cost_price)}
                    </td>

                    {/* Selling Price */}
                    <td className="py-4 px-4 text-right font-mono font-extrabold text-forest text-base">
                      {formatRupiah(p.selling_price)}
                    </td>

                    {/* Margin */}
                    <td className="py-4 px-4 text-right font-mono text-xs">
                      <span className="font-bold text-status-successText">
                        +{formatRupiah(profit)}
                      </span>
                      <span className="text-ink-muted block text-[10px]">
                        ({marginPercent}%)
                      </span>
                    </td>

                    {/* Stock */}
                    <td className="py-4 px-4 text-center font-mono font-extrabold text-base text-ink">
                      {formatNumber(p.stock_quantity)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4 text-center">
                      {isOutOfStock ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-status-dangerBg text-status-dangerText">
                          Habis
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-status-warningBg text-status-warningText">
                          Menipis (Min {p.min_stock_alert})
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-status-successBg text-status-successText">
                          Aman
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          className="p-2 rounded-xl bg-cream-100 hover:bg-cream-200 text-forest transition-colors"
                          title="Ubah Produk"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptDeleteProduct(p)}
                          className="p-2 rounded-xl bg-cream-100 hover:bg-status-dangerBg text-status-dangerText transition-colors"
                          title="Hapus Produk"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-3xl bg-forest-surface text-forest flex items-center justify-center">
                        <PackagePlus className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-ink">Katalog Barang Masih Kosong & Siap Diisi</h3>
                        <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                          Sistem siap digunakan! Silakan daftarkan produk dagangan toko Anda dengan menambahkan foto produk dan rincian harga di bawah ini.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-amber hover:bg-amber-hover text-forest font-black rounded-2xl text-sm shadow-elevated transition-transform active:scale-95"
                      >
                        <PackagePlus className="w-4 h-4" />
                        <span>+ Tambah Barang Pertama Sekarang</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-ink-muted font-semibold">
                    Tidak ada barang yang sesuai dengan filter atau kata kunci pencarian.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-card w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-modal border-2 border-cream-300 relative my-6">
            <div className="flex items-center justify-between pb-4 border-b border-cream-200">
              <h3 className="text-xl font-extrabold text-ink">
                {editingProduct ? 'Ubah Data Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-5 space-y-4">
              {/* Product Photo Upload Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                    Foto / Gambar Produk
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      playKeyClick();
                      setIsAutoImageOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber/20 hover:bg-amber text-forest border border-amber/60 rounded-xl text-xs font-black transition-all active:scale-95 shadow-xs"
                    title="Cari gambar otomatis berdasarkan nama produk"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-forest" />
                    <span>✨ Cari Gambar Otomatis</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />

                {formImage ? (
                  <div className="flex items-center gap-4 p-3 bg-cream-50 rounded-2xl border-2 border-cream-300">
                    <img
                      src={formImage}
                      alt="Preview"
                      className="w-20 h-20 rounded-xl object-cover border border-cream-300 shadow-sm flex-shrink-0"
                    />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-status-successText">
                        <Check className="w-4 h-4" />
                        <span>Foto Produk Terpasang</span>
                      </div>
                      <p className="text-[11px] text-ink-muted">
                        Foto tersimpan secara lokal dan otomatis tampil di katalog kasir.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            playKeyClick();
                            setIsAutoImageOpen(true);
                          }}
                          className="px-3 py-1.5 bg-amber hover:bg-amber-hover text-forest font-black text-xs rounded-xl flex items-center gap-1 transition-colors active:scale-95 shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Cari Ulang Otomatis</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-cream-200 hover:bg-cream-300 text-ink font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5 text-forest" />
                          <span>Ganti File/Foto HP</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="px-3 py-1.5 bg-status-dangerBg hover:bg-status-dangerBg/80 text-status-dangerText font-bold text-xs rounded-xl transition-colors"
                        >
                          Hapus Foto
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-cream-300 bg-cream-50 rounded-2xl p-4 sm:p-5 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber/30 text-forest flex items-center justify-center">
                      <ImagePlus className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-ink">
                        {isProcessingImage ? 'Mengompres Foto...' : 'Pasang Foto Produk'}
                      </p>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        Pilih foto otomatis dari internet, kamera HP, galeri, atau paste (Ctrl+V)
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          playKeyClick();
                          setIsAutoImageOpen(true);
                        }}
                        className="px-4 py-2 bg-amber hover:bg-amber-hover text-forest font-black rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                      >
                        <Sparkles className="w-4 h-4 text-forest" />
                        <span>✨ Cari Gambar Otomatis</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-cream-200 hover:bg-cream-300 text-ink font-bold rounded-xl text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Upload className="w-4 h-4 text-forest" />
                        <span>Kamera HP / Upload File</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Product Name with inline search helper */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                    Nama Barang Lengkap *
                  </label>
                  {formName.trim().length > 2 && !formImage && (
                    <button
                      type="button"
                      onClick={() => {
                        playKeyClick();
                        setIsAutoImageOpen(true);
                      }}
                      className="text-[11px] font-bold text-forest hover:text-amber-dark flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber" />
                      <span className="underline">Cari gambar untuk "{formName.slice(0, 18)}..."</span>
                    </button>
                  )}
                </div>
                <input
                  ref={productNameInputRef}
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Cth: Minyak Goreng Bimoli 2 Liter"
                  className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>

              {/* Category & Unit Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                    Kategori Produk
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                  >
                    {formAvailableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                    Satuan Unit (ex: pcs, kg, liter) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="unit-suggestions"
                      required
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      placeholder="pcs"
                      className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                    />
                    <datalist id="unit-suggestions">
                      {standardUnits.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Prices: Cost (HPP) & Selling Price with Clean Numeric Entry (No 024500) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                    Harga Modal / Beli (HPP) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formCostPriceStr}
                    onChange={handleNumericInput(setFormCostPriceStr)}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-mono font-bold text-base text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                  />
                  <span className="text-[11px] text-ink-muted mt-1 block">
                    {formatRupiah(formCostPrice)}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                    Harga Jual Toko (Rp) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formSellingPriceStr}
                    onChange={handleNumericInput(setFormSellingPriceStr)}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-cream-50 border-2 border-forest/40 rounded-2xl font-mono font-extrabold text-base text-forest focus:outline-none focus:ring-2 focus:ring-forest"
                  />
                  <span className="text-[11px] text-ink-muted mt-1 block">
                    {formatRupiah(formSellingPrice)}
                  </span>
                </div>
              </div>

              {/* Profit Preview */}
              <div className="p-4 bg-cream-100 rounded-2xl border border-cream-300 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-ink-muted">
                  <Percent className="w-4 h-4 text-forest" />
                  <span>Estimasi Laba Kotor per Unit:</span>
                </div>
                <div className="text-right font-mono font-extrabold text-sm text-forest">
                  <span>{formatRupiah(formProfit)}</span>
                  <span className="text-xs text-ink-muted ml-1.5">({formMarginPercent}%)</span>
                </div>
              </div>

              {/* Stock Quantity & Min Alert with Clean Numeric Entry */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                    Jumlah Stok Sekarang
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formStockQuantityStr}
                    onChange={handleNumericInput(setFormStockQuantityStr)}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-mono font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                    Batas Peringatan Menipis
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formMinStockAlertStr}
                    onChange={handleNumericInput(setFormMinStockAlertStr)}
                    placeholder="5"
                    className="w-full px-4 py-3 bg-cream-50 border border-cream-300 rounded-2xl font-mono font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                  />
                </div>
              </div>

              {/* SKU / Kode Barang (Opsional) */}
              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1">
                  Kode Barang / SKU Rak (Opsional)
                </label>
                <input
                  type="text"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  placeholder="Opsional - kosongkan jika ingin dibuatkan otomatis"
                  className="w-full px-4 py-2.5 bg-cream-50 border border-cream-300 rounded-2xl font-mono text-xs text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>

              {/* Action Buttons */}
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
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal for DELETING Product */}
      <ActionConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={executeDeleteProduct}
        type="delete"
        title="Hapus Produk dari Katalog?"
        description="Data barang berikut akan dihapus secara permanen dari sistem toko Anugerah Store:"
        details={
          productToDelete
            ? [
                { label: 'Nama Barang', value: productToDelete.name, highlight: true },
                { label: 'Kategori', value: productToDelete.category },
                { label: 'Satuan Unit', value: productToDelete.unit || 'pcs' },
                {
                  label: 'Sisa Stok Saat Ini',
                  value: `${productToDelete.stock_quantity} ${productToDelete.unit || 'pcs'}`,
                },
                { label: 'Modal Beli (HPP)', value: formatRupiah(productToDelete.cost_price) },
                { label: 'Harga Jual Kasir', value: formatRupiah(productToDelete.selling_price) },
                { label: 'Foto Produk', value: productToDelete.image ? 'Terpasang' : 'Tidak Ada' },
              ]
            : []
        }
        confirmText="Ya, Hapus Produk"
        cancelText="Batal"
      />

      {/* Action Confirmation Modal for EDITING / UPDATING Product */}
      <ActionConfirmModal
        isOpen={isConfirmEditOpen}
        onClose={() => setIsConfirmEditOpen(false)}
        onConfirm={executeSaveProduct}
        type="edit"
        title="Konfirmasi Perubahan Data Produk"
        description="Periksa kembali rincian data produk berikut sebelum disimpan ke sistem kasir:"
        details={[
          { label: 'Nama Barang', value: formName, highlight: true },
          { label: 'Foto Produk', value: formImage ? 'Terpasang' : 'Tanpa Foto' },
          { label: 'Kategori', value: formCategory },
          { label: 'Satuan Unit', value: formUnit },
          { label: 'Modal Beli (HPP)', value: formatRupiah(formCostPrice) },
          { label: 'Harga Jual Kasir', value: formatRupiah(formSellingPrice) },
          { label: 'Jumlah Stok Fisik', value: `${formStockQuantity} ${formUnit}` },
          { label: 'Peringatan Min. Stok', value: `${formMinStockAlert} ${formUnit}` },
        ]}
        confirmText="Ya, Simpan Perubahan"
        cancelText="Kembali Periksa"
      />

      {/* Auto Image Search Modal */}
      <AutoImageSearchModal
        isOpen={isAutoImageOpen}
        onClose={() => setIsAutoImageOpen(false)}
        productName={formName}
        onSelectImage={(imageDataUrl) => {
          setFormImage(imageDataUrl);
          addToast('success', 'Foto Produk Terpasang', 'Foto berhasil dipilih dan dikompres untuk produk toko.');
        }}
      />

      {/* Floating Feedback Toast Alerts */}
      <ToastAlert toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};
