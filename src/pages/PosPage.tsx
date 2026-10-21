import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Camera,
  ShoppingBag,
  ArrowRight,
  Package,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { Product, CartItem, Sale, SaleItem } from '../types';
import { formatRupiah } from '../utils/format';
import { playSuccessBeep, playErrorBeep, playKeyClick } from '../utils/sound';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { PaymentModal } from '../components/PaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { ActionConfirmModal } from '../components/ActionConfirmModal';
import { ToastAlert, type ToastMessage } from '../components/ToastAlert';
import { generateId } from '../utils/format';
import { db, getProductCategories } from '../db';

interface PosPageProps {
  products: Product[];
  onProductStockUpdate: () => void;
}

export const PosPage: React.FC<PosPageProps> = ({
  products,
  onProductStockUpdate,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [completedSaleItems, setCompletedSaleItems] = useState<SaleItem[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [scannerNotification, setScannerNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Cart Delete & Clear Confirmation State
  const [cartItemToDelete, setCartItemToDelete] = useState<CartItem | null>(null);
  const [isConfirmDeleteCartOpen, setIsConfirmDeleteCartOpen] = useState(false);
  const [isConfirmClearCartOpen, setIsConfirmClearCartOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'delete' | 'warning' | 'info', title: string, description?: string) => {
    const id = generateId('toast');
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Extract unique categories (combines settings and existing products)
  const categories = useMemo(() => {
    const fromSettings = getProductCategories();
    const set = new Set<string>(['Semua', ...fromSettings]);
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filter products by category & search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchQuery && p.is_active === 1;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart calculations
  const totalAmount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const totalCost = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.cost_price * item.quantity, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Notification timer
  const showNotification = (text: string, type: 'success' | 'error') => {
    setScannerNotification({ text, type });
    setTimeout(() => {
      setScannerNotification(null);
    }, 2800);
  };

  // Add Product to Cart
  const handleAddToCart = (product: Product, qtyToAdd = 1) => {
    if (product.stock_quantity <= 0) {
      playErrorBeep();
      showNotification(`Stok ${product.name} telah habis!`, 'error');
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);

      if (existingIndex > -1) {
        const currentQty = prevCart[existingIndex].quantity;
        const newQty = currentQty + qtyToAdd;

        if (newQty > product.stock_quantity) {
          playErrorBeep();
          showNotification(`Stok maksimum hanya ${product.stock_quantity} ${product.unit || 'pcs'}!`, 'error');
          return prevCart;
        }

        playSuccessBeep();
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          subtotal: newQty * product.selling_price,
        };
        showNotification(`${product.name} ditambah (Qty: ${newQty} ${product.unit || 'pcs'})`, 'success');
        return updated;
      } else {
        playSuccessBeep();
        showNotification(`${product.name} masuk keranjang`, 'success');
        return [
          ...prevCart,
          {
            product,
            quantity: qtyToAdd,
            subtotal: qtyToAdd * product.selling_price,
          },
        ];
      }
    });
  };

  // Update Cart Quantity
  const handleUpdateQuantity = (productId: string, delta: number) => {
    playKeyClick();
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stock_quantity) {
              playErrorBeep();
              showNotification(`Batas stok tercapai (${item.product.stock_quantity} ${item.product.unit || 'pcs'})`, 'error');
              return item;
            }
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * item.product.selling_price,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove Item from Cart with theme confirmation modal
  const handlePromptRemoveFromCart = (item: CartItem) => {
    playKeyClick();
    setCartItemToDelete(item);
    setIsConfirmDeleteCartOpen(true);
  };

  const executeRemoveFromCart = () => {
    if (!cartItemToDelete) return;
    setCart((prev) => prev.filter((item) => item.product.id !== cartItemToDelete.product.id));
    playKeyClick();
    setIsConfirmDeleteCartOpen(false);
    addToast(
      'delete',
      'Item Dihapus dari Keranjang',
      `"${cartItemToDelete.product.name}" (${cartItemToDelete.quantity} ${cartItemToDelete.product.unit || 'pcs'}) telah dikeluarkan.`
    );
    setCartItemToDelete(null);
  };

  // Clear entire Cart with theme confirmation modal
  const handlePromptClearCart = () => {
    if (cart.length === 0) return;
    playKeyClick();
    setIsConfirmClearCartOpen(true);
  };

  const executeClearCart = () => {
    const totalCount = cart.length;
    setCart([]);
    playKeyClick();
    setIsConfirmClearCartOpen(false);
    addToast('delete', 'Keranjang Dikosongkan', `Seluruh ${totalCount} barang belanjaan telah dibatalkan.`);
  };

  // Barcode Handler (from input or physical scanner)
  const handleBarcodeProcess = (scannedCode: string) => {
    const cleanCode = scannedCode.trim();
    if (!cleanCode) return;

    // Search product by barcode
    const found = products.find(
      (p) => p.barcode === cleanCode || p.barcode.toLowerCase() === cleanCode.toLowerCase()
    );

    if (found) {
      handleAddToCart(found, 1);
      setBarcodeInput('');
    } else {
      playErrorBeep();
      showNotification(`Barcode [${cleanCode}] belum terdaftar di Anugerah Store!`, 'error');
      setBarcodeInput('');
    }
  };

  // Setup USB / Bluetooth Physical Barcode Scanner Auto-intercept
  useBarcodeScanner({
    onScan: (code) => {
      handleBarcodeProcess(code);
    },
    enabled: !isPaymentOpen && !isReceiptOpen && !isCameraOpen,
  });

  // Hotkey support: F9 to pay, F2 to focus scanner
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setIsPaymentOpen(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [cart]);

  // Payment Success Callback
  const handlePaymentSuccess = async (sale: Sale, saleItems: SaleItem[]) => {
    try {
      await db.sales.add(sale);
      await db.sale_items.bulkAdd(saleItems);

      // Reduce stock quantity in Dexie.js
      for (const item of saleItems) {
        const prod = await db.products.get(item.product_id);
        if (prod) {
          const newStock = Math.max(0, prod.stock_quantity - item.quantity);
          await db.products.update(item.product_id, {
            stock_quantity: newStock,
            updated_at: new Date().toISOString(),
          });
        }
      }

      setCart([]);
      setIsPaymentOpen(false);
      setCompletedSale(sale);
      setCompletedSaleItems(saleItems);
      setIsReceiptOpen(true);
      onProductStockUpdate();
    } catch (err) {
      console.error('Gagal mencatat transaksi:', err);
      addToast('warning', 'Kendala Transaksi', 'Terjadi kendala saat menyimpan transaksi ke database lokal.');
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Top Banner Alert / Notification */}
      {scannerNotification && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-elevated border-2 font-bold text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            scannerNotification.type === 'success'
              ? 'bg-status-successBg border-status-successText text-status-successText'
              : 'bg-status-dangerBg border-status-dangerText text-status-dangerText'
          }`}
        >
          {scannerNotification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{scannerNotification.text}</span>
        </div>
      )}

      {/* Main Single-Screen POS Layout - Maximizing Desktop Space */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SISI KIRI & TENGAH: Scanner Barcode + Kategori + Grid Produk (8 Kolom) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* BARCODE SCANNER HERO INPUT */}
          <div className="bg-card p-5 rounded-3xl shadow-card border border-cream-300">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Barcode className="w-7 h-7 text-forest" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  data-scanner-input="true"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeProcess(barcodeInput);
                    }
                  }}
                  placeholder="Arahkan Scanner Fisik / Ketik Barcode di sini..."
                  className="w-full pl-14 pr-4 py-3.5 bg-cream-50 border-2 border-cream-300 rounded-2xl text-base sm:text-lg font-mono font-bold text-ink focus:outline-none focus:ring-4 focus:ring-amber/30 focus:border-forest transition-all"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleBarcodeProcess(barcodeInput)}
                  className="px-6 py-3.5 bg-forest hover:bg-forest-light text-white font-extrabold rounded-2xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Search className="w-4 h-4" /> Masukkan
                </button>
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="px-4 py-3.5 bg-amber hover:bg-amber-hover text-forest font-extrabold rounded-2xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                  title="Gunakan Kamera HP / Laptop untuk Scan Barcode"
                >
                  <Camera className="w-5 h-5 text-forest" />
                  <span className="hidden sm:inline">Kamera</span>
                </button>
              </div>
            </div>

            {/* Quick Guidance Tag */}
            <div className="mt-2.5 flex items-center justify-between text-xs text-ink-muted">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-status-successText animate-pulse inline-block" />
                Sensor Scanner USB/Bluetooth Siap Menerima Barcode Otomatis
              </span>
              <span className="hidden md:inline bg-cream-200 px-2.5 py-0.5 rounded-md font-mono text-[11px]">
                Tekan F2 untuk Fokus Scanner
              </span>
            </div>
          </div>

          {/* FILTER KATEGORI & PENCARIAN NAMA */}
          <div className="bg-card p-4 rounded-3xl shadow-card border border-cream-300 space-y-3">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-5 h-5 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama barang cepat (cth: Minyak, Beras, Indomie)..."
                className="w-full pl-11 pr-4 py-2.5 bg-cream-100 border border-cream-300 rounded-2xl text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-forest"
              />
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    playKeyClick();
                    setSelectedCategory(cat);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-forest text-white shadow-sm'
                      : 'bg-cream-100 text-ink-muted hover:bg-cream-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* GRID KATALOG PRODUK (Desktop full utilization: 4 to 5 columns on big screens) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5">
            {filteredProducts.map((p) => {
              const isOutOfStock = p.stock_quantity <= 0;
              const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_alert;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isOutOfStock) handleAddToCart(p, 1);
                  }}
                  className={`bg-card p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none relative group ${
                    isOutOfStock
                      ? 'opacity-60 border-cream-300 cursor-not-allowed bg-cream-50'
                      : 'border-cream-200 hover:border-forest/40 hover:shadow-card hover:-translate-y-0.5'
                  }`}
                >
                  <div>
                    {/* Category & Stock Status Badges */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider truncate">
                        {p.category}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-status-dangerBg text-status-dangerText">
                          Habis
                        </span>
                      ) : isLowStock ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-status-warningBg text-status-warningText">
                          Sisa {p.stock_quantity} {p.unit || 'pcs'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-ink-subtle">
                          {p.stock_quantity} {p.unit || 'pcs'}
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <h4 className="font-bold text-ink text-sm sm:text-base leading-snug line-clamp-2 min-h-[2.6rem]">
                      {p.name}
                    </h4>

                    {/* Barcode code */}
                    <p className="font-mono text-[11px] text-ink-subtle mt-1 truncate">
                      {p.barcode}
                    </p>
                  </div>

                  {/* Price & Add Button */}
                  <div className="mt-3.5 pt-3 border-t border-cream-200 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-extrabold text-base text-forest block">
                        {formatRupiah(p.selling_price)}
                      </span>
                      <span className="text-[10px] text-ink-subtle">
                        /{p.unit || 'pcs'}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(p, 1);
                      }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold transition-all ${
                        isOutOfStock
                          ? 'bg-cream-300 text-ink-subtle cursor-not-allowed'
                          : 'bg-amber group-hover:bg-amber-hover text-forest active:scale-95 shadow-sm'
                      }`}
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center bg-card rounded-3xl border border-cream-300">
                <Package className="w-12 h-12 text-ink-subtle mx-auto mb-2 opacity-50" />
                <p className="font-bold text-ink">Tidak ada produk yang sesuai kriteria pencarian</p>
                <p className="text-xs text-ink-muted mt-1">
                  Coba ubah kata kunci pencarian atau scan barcode lain
                </p>
              </div>
            )}
          </div>
        </div>

        {/* SISI KANAN: STICKY KERANJANG KASIR (4 Kolom) */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-6 space-y-4">
          <div className="bg-card rounded-3xl shadow-card border-2 border-cream-300 flex flex-col h-[calc(100vh-60px)] max-h-[860px]">
            {/* Header Keranjang */}
            <div className="p-5 border-b border-cream-200 flex items-center justify-between bg-cream-50/70 rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-forest flex items-center justify-center text-amber">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-ink">Keranjang Kasir</h3>
                  <p className="text-xs text-ink-muted">
                    {cart.length} ragam barang ({totalItemsCount} total item)
                  </p>
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handlePromptClearCart}
                  className="text-xs font-bold text-status-dangerText hover:bg-status-dangerBg/50 px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                  title="Batalkan Seluruh Keranjang"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan</span>
                </button>
              )}
            </div>

            {/* List Item Keranjang with Unit Display */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => {
                const itemUnit = item.product.unit || 'pcs';
                return (
                  <div
                    key={item.product.id}
                    className="bg-cream-50 p-4 rounded-2xl border border-cream-300 flex flex-col gap-2 hover:border-forest/30 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <h5 className="font-bold text-ink text-sm leading-tight">
                          {item.product.name}
                        </h5>
                        <span className="font-mono text-xs text-ink-muted">
                          @ {formatRupiah(item.product.selling_price)} / {itemUnit}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePromptRemoveFromCart(item)}
                        className="text-ink-subtle hover:text-status-dangerText p-1 transition-colors"
                        title="Hapus barang ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity Controls with explicit unit display */}
                    <div className="flex items-center justify-between pt-1 border-t border-cream-200">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, -1)}
                          className="w-8 h-8 rounded-xl bg-white border border-cream-300 text-ink font-bold flex items-center justify-center hover:bg-cream-200 active:scale-95 transition-all"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <div className="px-2 py-1 bg-white rounded-xl border border-cream-200 flex items-center gap-1">
                          <span className="font-mono font-black text-sm text-ink">
                            {item.quantity}
                          </span>
                          <span className="text-xs font-semibold text-ink-muted">
                            {itemUnit}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.product.id, 1)}
                          className="w-8 h-8 rounded-xl bg-forest text-white font-bold flex items-center justify-center hover:bg-forest-light active:scale-95 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <span className="font-mono font-extrabold text-base text-forest">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-ink-subtle">
                  <div className="w-16 h-16 rounded-3xl bg-cream-100 flex items-center justify-center mb-3">
                    <ShoppingBag className="w-8 h-8 text-cream-400" />
                  </div>
                  <p className="font-bold text-ink">Keranjang Belanja Masih Kosong</p>
                  <p className="text-xs text-ink-muted mt-1 max-w-[200px]">
                    Scan barcode kemasan barang atau pilih produk dari katalog di sebelah kiri
                  </p>
                </div>
              )}
            </div>

            {/* Footer Keranjang: Total & Tombol Bayar Sekarang */}
            <div className="p-5 border-t border-cream-300 bg-cream-100/90 rounded-b-3xl space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-ink-muted">
                  <span>Jumlah Total Barang:</span>
                  <span>{totalItemsCount} item ({cart.length} ragam)</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-ink uppercase tracking-wide">
                    TOTAL BELANJA:
                  </span>
                  <span className="text-2xl sm:text-3xl font-black font-mono text-forest tracking-tight">
                    {formatRupiah(totalAmount)}
                  </span>
                </div>
              </div>

              {/* Big Golden Amber CTA Button */}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => {
                  playKeyClick();
                  setIsPaymentOpen(true);
                }}
                className={`w-full py-4 px-6 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-elevated transition-all min-h-[60px] ${
                  cart.length === 0
                    ? 'bg-cream-300 text-ink-subtle cursor-not-allowed shadow-none'
                    : 'bg-amber hover:bg-amber-hover text-forest active:scale-[0.98]'
                }`}
              >
                <span>BAYAR SEKARANG (F9)</span>
                <ArrowRight className="w-5 h-5 stroke-[3]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onDetected={(code) => handleBarcodeProcess(code)}
      />

      {isPaymentOpen && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          cartItems={cart}
          totalAmount={totalAmount}
          totalCost={totalCost}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={completedSale}
        items={completedSaleItems}
      />

      {/* Confirmation Modal for DELETING Item from Cart */}
      <ActionConfirmModal
        isOpen={isConfirmDeleteCartOpen}
        onClose={() => {
          setIsConfirmDeleteCartOpen(false);
          setCartItemToDelete(null);
        }}
        onConfirm={executeRemoveFromCart}
        type="delete"
        title="Hapus Barang dari Keranjang?"
        description="Barang berikut akan dikeluarkan dari daftar belanja kasir:"
        details={
          cartItemToDelete
            ? [
                {
                  label: 'Nama Barang',
                  value: cartItemToDelete.product.name,
                  highlight: true,
                },
                {
                  label: 'Jumlah di Keranjang',
                  value: `${cartItemToDelete.quantity} ${cartItemToDelete.product.unit || 'pcs'}`,
                },
                {
                  label: 'Harga Satuan',
                  value: formatRupiah(cartItemToDelete.product.selling_price),
                },
                {
                  label: 'Subtotal Pengurangan',
                  value: formatRupiah(cartItemToDelete.subtotal),
                  highlight: true,
                },
              ]
            : []
        }
        confirmText="Ya, Hapus dari Keranjang"
        cancelText="Batal"
      />

      {/* Confirmation Modal for CLEARING Cart */}
      <ActionConfirmModal
        isOpen={isConfirmClearCartOpen}
        onClose={() => setIsConfirmClearCartOpen(false)}
        onConfirm={executeClearCart}
        type="warning"
        title="Kosongkan Semua Keranjang?"
        description="Seluruh belanjaan kasir saat ini akan dibatalkan dan dikosongkan secara bersih:"
        details={[
          { label: 'Ragam Barang', value: `${cart.length} jenis produk` },
          { label: 'Total Unit Barang', value: `${totalItemsCount} unit fisik` },
          {
            label: 'Total Tagihan Saat Ini',
            value: formatRupiah(totalAmount),
            highlight: true,
          },
        ]}
        confirmText="Ya, Kosongkan Keranjang"
        cancelText="Kembali ke Kasir"
      />

      {/* Floating Feedback Toast Alerts */}
      <ToastAlert toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};
