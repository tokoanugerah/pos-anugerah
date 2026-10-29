import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Package,
  CheckCircle2,
  AlertTriangle,
  X,
  Scale,
  Calculator,
} from 'lucide-react';
import type { Product, CartItem, Sale, SaleItem } from '../types';
import { formatRupiah, formatQty, generateId } from '../utils/format';
import { playSuccessBeep, playErrorBeep, playKeyClick } from '../utils/sound';
import { PaymentModal } from '../components/PaymentModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { ActionConfirmModal } from '../components/ActionConfirmModal';
import { ToastAlert, type ToastMessage } from '../components/ToastAlert';
import { db, getProductCategories } from '../db';
import { syncSaleToTurso } from '../db/turso';

const isWeightOrVolumeUnit = (unit?: string): boolean => {
  if (!unit) return false;
  const u = unit.toLowerCase().trim();
  return ['kg', 'liter', 'gram', 'ml', 'ons'].includes(u);
};

interface PosPageProps {
  products: Product[];
  onProductStockUpdate: () => void;
  onNavigateToProducts?: () => void;
}

export const PosPage: React.FC<PosPageProps> = ({
  products,
  onProductStockUpdate,
  onNavigateToProducts,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [completedSaleItems, setCompletedSaleItems] = useState<SaleItem[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Cart Delete & Clear Confirmation State
  const [cartItemToDelete, setCartItemToDelete] = useState<CartItem | null>(null);
  const [isConfirmDeleteCartOpen, setIsConfirmDeleteCartOpen] = useState(false);
  const [isConfirmClearCartOpen, setIsConfirmClearCartOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Fractional / Budget Calculator & Direct Editing States
  const [budgetModalItem, setBudgetModalItem] = useState<CartItem | null>(null);
  const [budgetAmountInput, setBudgetAmountInput] = useState<string>('5000');
  const [editingQtyMap, setEditingQtyMap] = useState<Record<string, string>>({});

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
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchQuery && p.is_active === 1;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart calculations with zero floating-point inaccuracies
  const totalAmount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const totalCost = useMemo(() => {
    return cart.reduce((acc, item) => acc + Math.round(item.product.cost_price * item.quantity), 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Notification timer
  const showNotification = (text: string, type: 'success' | 'error') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
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
        const newQty = parseFloat((currentQty + qtyToAdd).toFixed(3));

        if (newQty > product.stock_quantity) {
          playErrorBeep();
          showNotification(`Stok maksimum hanya ${formatQty(product.stock_quantity)} ${product.unit || 'pcs'}!`, 'error');
          return prevCart;
        }

        playSuccessBeep();
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          subtotal: Math.round(newQty * product.selling_price),
        };
        showNotification(`${product.name} ditambah (Qty: ${formatQty(newQty)} ${product.unit || 'pcs'})`, 'success');
        return updated;
      } else {
        playSuccessBeep();
        showNotification(`${product.name} masuk keranjang`, 'success');
        return [
          ...prevCart,
          {
            product,
            quantity: qtyToAdd,
            subtotal: Math.round(qtyToAdd * product.selling_price),
          },
        ];
      }
    });
  };

  // Stepper quantity adjustment (+ / -) supporting intelligent fractional steps
  const handleStepQuantity = (item: CartItem, direction: 1 | -1) => {
    playKeyClick();
    const isBulk = isWeightOrVolumeUnit(item.product.unit);
    let step = 1;

    if (isBulk) {
      if (direction === -1) {
        if (item.quantity <= 1 && item.quantity > 0.25) {
          step = 0.25;
        } else if (item.quantity <= 0.25) {
          handlePromptRemoveFromCart(item);
          return;
        } else {
          step = 1;
        }
      } else {
        if (item.quantity < 1) {
          step = 0.25;
        } else {
          step = 1;
        }
      }
    }

    const rawNewQty = item.quantity + direction * step;
    const newQty = parseFloat(rawNewQty.toFixed(3));

    if (newQty <= 0) {
      handlePromptRemoveFromCart(item);
      return;
    }

    if (newQty > item.product.stock_quantity) {
      playErrorBeep();
      showNotification(
        `Batas stok tercapai (${formatQty(item.product.stock_quantity)} ${item.product.unit || 'pcs'})`,
        'error'
      );
      return;
    }

    setCart((prevCart) =>
      prevCart.map((c) => {
        if (c.product.id === item.product.id) {
          return {
            ...c,
            quantity: newQty,
            subtotal: Math.round(newQty * c.product.selling_price),
          };
        }
        return c;
      })
    );
  };

  // Set exact quantity (from Quick Fraction chips or Budget Calculator)
  const handleSetExactQuantity = (productId: string, targetQty: number) => {
    setCart((prevCart) => {
      return prevCart.map((c) => {
        if (c.product.id === productId) {
          const roundedQty = parseFloat(targetQty.toFixed(3));
          if (roundedQty <= 0) return c;
          if (roundedQty > c.product.stock_quantity) {
            playErrorBeep();
            showNotification(
              `Stok maksimum hanya ${formatQty(c.product.stock_quantity)} ${c.product.unit || 'pcs'}!`,
              'error'
            );
            return c;
          }
          playKeyClick();
          return {
            ...c,
            quantity: roundedQty,
            subtotal: Math.round(roundedQty * c.product.selling_price),
          };
        }
        return c;
      });
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

  // Hotkey support: F9 to pay, / or Ctrl+K to focus search
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0) setIsPaymentOpen(true);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchInputRef.current?.focus();
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

      // Reduce stock quantity in Dexie.js (with clean 2-decimal rounding)
      for (const item of saleItems) {
        const prod = await db.products.get(item.product_id);
        if (prod) {
          const newStock = Math.max(0, Number((prod.stock_quantity - item.quantity).toFixed(2)));
          await db.products.update(item.product_id, {
            stock_quantity: newStock,
            updated_at: new Date().toISOString(),
          });
        }
      }

      // Sinkronisasi otomatis ke remote database Turso Cloud
      await syncSaleToTurso(sale, saleItems);

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
      {notification && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-elevated border-2 font-bold text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            notification.type === 'success'
              ? 'bg-status-successBg border-status-successText text-status-successText'
              : 'bg-status-dangerBg border-status-dangerText text-status-dangerText'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Main Single-Screen POS Layout - Maximizing Desktop Space */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SISI KIRI & TENGAH: Pencarian + Kategori + Grid Produk Berfoto (8 Kolom) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* SEARCH BAR & KATEGORI */}
          <div className="bg-card p-4 sm:p-5 rounded-3xl shadow-card border border-cream-300 space-y-3.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-5 h-5 text-forest absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama barang cepat (cth: Minyak, Beras, Indomie)..."
                className="w-full pl-12 pr-10 py-3.5 bg-cream-50 border-2 border-cream-300 rounded-2xl text-base font-bold text-ink focus:outline-none focus:ring-4 focus:ring-amber/30 focus:border-forest transition-all"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
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
                      ? 'bg-forest text-amber shadow-sm'
                      : 'bg-cream-100 text-ink-muted hover:bg-cream-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* GRID KATALOG PRODUK BERFOTO */}
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
                  className={`bg-card p-3.5 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none relative group overflow-hidden ${
                    isOutOfStock
                      ? 'opacity-60 border-cream-300 cursor-not-allowed bg-cream-50'
                      : 'border-cream-200 hover:border-forest/40 hover:shadow-card hover:-translate-y-0.5'
                  }`}
                >
                  <div>
                    {/* Product Photo or Placeholder */}
                    <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-cream-100 border border-cream-200 mb-3 flex items-center justify-center">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-ink-subtle">
                          <Package className="w-8 h-8 opacity-40" />
                          <span className="text-[10px] text-ink-muted mt-1">Tanpa Foto</span>
                        </div>
                      )}
                      {/* Category Tag overlay */}
                      <span className="absolute top-2 left-2 text-[10px] font-extrabold text-forest bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm">
                        {p.category}
                      </span>
                      {/* Out / Low stock badge overlay */}
                      {isOutOfStock ? (
                        <span className="absolute top-2 right-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-status-dangerBg text-status-dangerText shadow-sm">
                          Habis
                        </span>
                      ) : isLowStock ? (
                        <span className="absolute top-2 right-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-status-warningBg text-status-warningText shadow-sm">
                          Sisa {formatQty(p.stock_quantity)}
                        </span>
                      ) : null}
                    </div>

                    {/* Product Name */}
                    <h4 className="font-bold text-ink text-sm sm:text-base leading-snug line-clamp-2 min-h-[2.6rem]">
                      {p.name}
                    </h4>
                  </div>

                  {/* Price & Add Button */}
                  <div className="mt-3 pt-2.5 border-t border-cream-200 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-extrabold text-base text-forest block">
                        {formatRupiah(p.selling_price)}
                      </span>
                      <span className="text-[10px] text-ink-subtle">
                        /{p.unit || 'pcs'} • Stok: {formatQty(p.stock_quantity)}
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

            {products.length === 0 ? (
              <div className="col-span-full py-16 px-6 text-center bg-card rounded-3xl border border-cream-300">
                <div className="w-14 h-14 rounded-2xl bg-forest-surface text-forest flex items-center justify-center mx-auto mb-3">
                  <Package className="w-7 h-7" />
                </div>
                <p className="font-black text-lg text-ink">Katalog Kasir Siap Diisi</p>
                <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                  Belum ada produk terdaftar di sistem toko. Silakan tambahkan barang dengan foto di menu "Katalog Produk" untuk mulai melayani transaksi kasir.
                </p>
                {onNavigateToProducts && (
                  <button
                    type="button"
                    onClick={() => {
                      playKeyClick();
                      onNavigateToProducts();
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-amber hover:bg-amber-hover text-forest font-black rounded-2xl text-xs shadow-elevated transition-transform active:scale-95"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Buka Menu Katalog Produk Sekarang</span>
                  </button>
                )}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-card rounded-3xl border border-cream-300">
                <Package className="w-12 h-12 text-ink-subtle mx-auto mb-2 opacity-50" />
                <p className="font-bold text-ink">Tidak ada produk yang sesuai kriteria pencarian</p>
                <p className="text-xs text-ink-muted mt-1">
                  Coba ubah kata kunci pencarian atau pilih kategori lain
                </p>
              </div>
            ) : null}
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
                    {cart.length} ragam barang ({formatQty(totalItemsCount)} total item)
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

            {/* List Item Keranjang with Unit & Image Display */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => {
                const itemUnit = item.product.unit || 'pcs';
                const isBulk = isWeightOrVolumeUnit(itemUnit);

                return (
                  <div
                    key={item.product.id}
                    className="bg-cream-50 p-3.5 rounded-2xl border border-cream-300 flex flex-col gap-2.5 hover:border-forest/30 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {/* Product Thumbnail */}
                      {item.product.image ? (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-11 h-11 rounded-xl object-cover border border-cream-300 shadow-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-cream-100 border border-cream-300 flex items-center justify-center text-ink-subtle flex-shrink-0">
                          <Package className="w-5 h-5 opacity-40" />
                        </div>
                      )}

                      <div className="flex-1 pr-1 min-w-0">
                        <h5 className="font-bold text-ink text-sm leading-tight truncate">
                          {item.product.name}
                        </h5>
                        <span className="font-mono text-xs text-ink-muted">
                          @ {formatRupiah(item.product.selling_price)} / {itemUnit}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePromptRemoveFromCart(item)}
                        className="text-ink-subtle hover:text-status-dangerText p-1.5 transition-colors"
                        title="Hapus barang ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity Controls: Stepper + Direct Numeric/Decimal Input Field */}
                    <div className="flex items-center justify-between pt-2 border-t border-cream-200">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStepQuantity(item, -1)}
                          className="w-8 h-8 rounded-xl bg-white border border-cream-300 text-ink font-bold flex items-center justify-center hover:bg-cream-200 active:scale-95 transition-all shadow-sm"
                          title="Kurangi kuantitas"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        {/* Direct Editable Quantity Input Field */}
                        <div className="px-2 py-1 bg-white rounded-xl border-2 border-cream-300 focus-within:border-forest flex items-center gap-1 shadow-inner transition-all min-w-[78px] justify-center">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingQtyMap[item.product.id] !== undefined ? editingQtyMap[item.product.id] : formatQty(item.quantity)}
                            onFocus={(e) => {
                              setEditingQtyMap((prev) => ({ ...prev, [item.product.id]: String(item.quantity) }));
                              e.target.select();
                            }}
                            onChange={(e) => {
                              const val = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                              const parts = val.split('.');
                              const cleanVal = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : val;
                              setEditingQtyMap((prev) => ({ ...prev, [item.product.id]: cleanVal }));
                            }}
                            onBlur={() => {
                              const valStr = editingQtyMap[item.product.id];
                              if (valStr !== undefined) {
                                const parsed = parseFloat(valStr);
                                if (!isNaN(parsed) && parsed > 0) {
                                  handleSetExactQuantity(item.product.id, parsed);
                                }
                                setEditingQtyMap((prev) => {
                                  const copy = { ...prev };
                                  delete copy[item.product.id];
                                  return copy;
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-12 text-center font-mono font-black text-sm text-ink bg-transparent focus:outline-none"
                            title="Klik untuk ketik langsung jumlah / desimal eceran"
                          />
                          <span className="text-xs font-bold text-ink-muted select-none">
                            {itemUnit}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStepQuantity(item, 1)}
                          className="w-8 h-8 rounded-xl bg-forest text-white font-bold flex items-center justify-center hover:bg-forest-light active:scale-95 transition-all shadow-sm"
                          title="Tambah kuantitas"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-extrabold text-base text-forest block">
                          {formatRupiah(item.subtotal)}
                        </span>
                      </div>
                    </div>

                    {/* Quick Fraction Chips & Budget Calculator for Bulk/Weighed items */}
                    {isBulk && (
                      <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-extrabold text-ink-subtle uppercase tracking-wider mr-0.5">
                          Takaran:
                        </span>
                        {[
                          { label: '¼ ' + itemUnit, qty: 0.25 },
                          { label: '½ ' + itemUnit, qty: 0.5 },
                          { label: '¾ ' + itemUnit, qty: 0.75 },
                          { label: '1 ' + itemUnit, qty: 1 },
                          { label: '2 ' + itemUnit, qty: 2 },
                        ].map((frac) => {
                          const isSelected = Math.abs(item.quantity - frac.qty) < 0.001;
                          return (
                            <button
                              key={frac.label}
                              type="button"
                              onClick={() => handleSetExactQuantity(item.product.id, frac.qty)}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-black border transition-all ${
                                isSelected
                                  ? 'bg-forest text-amber border-forest shadow-sm scale-105'
                                  : 'bg-white hover:bg-cream-200 text-ink border-cream-300'
                              }`}
                            >
                              {frac.label}
                            </button>
                          );
                        })}

                        {/* Tombol Beli Berdasarkan Rp (Budget) */}
                        <button
                          type="button"
                          onClick={() => {
                            playKeyClick();
                            setBudgetModalItem(item);
                            setBudgetAmountInput('5000');
                          }}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-black bg-amber/20 hover:bg-amber text-forest border border-amber/60 flex items-center gap-1 transition-all shadow-sm active:scale-95"
                          title="Beli dengan nominal uang tertentu (cth: beli 5 ribu)"
                        >
                          <Calculator className="w-3 h-3 text-forest" />
                          <span>Beli Rp...</span>
                        </button>
                      </div>
                    )}
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
                    Klik gambar atau nama produk dari katalog di sebelah kiri untuk menambah pesanan
                  </p>
                </div>
              )}
            </div>

            {/* Footer Keranjang: Total & Tombol Bayar Sekarang */}
            <div className="p-5 border-t border-cream-300 bg-cream-100/90 rounded-b-3xl space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-ink-muted">
                  <span>Jumlah Total Barang:</span>
                  <span>{formatQty(totalItemsCount)} total item ({cart.length} ragam)</span>
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
          { label: 'Total Kuantitas Barang', value: `${formatQty(totalItemsCount)} total takaran` },
          {
            label: 'Total Tagihan Saat Ini',
            value: formatRupiah(totalAmount),
            highlight: true,
          },
        ]}
        confirmText="Ya, Kosongkan Keranjang"
        cancelText="Kembali ke Kasir"
      />

      {/* Modal Hitung Takaran dari Budget Rupiah */}
      {budgetModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-3xl p-6 shadow-modal border-2 border-cream-300 relative my-6">
            <div className="flex items-center justify-between pb-3.5 border-b border-cream-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-forest text-amber flex items-center justify-center shadow-sm">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-ink">Beli Berdasarkan Rupiah</h3>
                  <p className="text-[11px] text-ink-muted">Hitung takaran timbangan otomatis</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBudgetModalItem(null)}
                className="p-2 rounded-xl bg-cream-100 hover:bg-cream-200 text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Product Info */}
              <div className="p-3.5 bg-cream-100 rounded-2xl border border-cream-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-ink text-sm block">{budgetModalItem.product.name}</span>
                  <span className="text-xs text-ink-muted font-mono">
                    Harga: {formatRupiah(budgetModalItem.product.selling_price)} / {budgetModalItem.product.unit || 'pcs'}
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-white rounded-xl border border-cream-300 text-forest">
                  Stok: {formatQty(budgetModalItem.product.stock_quantity)} {budgetModalItem.product.unit || 'pcs'}
                </span>
              </div>

              {/* Rupiah Input */}
              <div>
                <label className="text-xs font-bold text-ink-muted uppercase tracking-wider block mb-1.5">
                  Nominal Uang Pembelian (Rp):
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-extrabold text-forest text-base">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={budgetAmountInput}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setBudgetAmountInput(clean);
                    }}
                    placeholder="Contoh: 5000"
                    className="w-full pl-12 pr-4 py-3 bg-cream-50 border-2 border-forest/40 rounded-2xl font-mono font-extrabold text-lg text-forest focus:outline-none focus:ring-4 focus:ring-amber/30"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="text-[11px] font-bold text-ink-muted block mb-1.5">Pilihan Cepat Nominal:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[2000, 3000, 5000, 10000, 15000, 20000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        playKeyClick();
                        setBudgetAmountInput(String(amt));
                      }}
                      className={`py-2 px-3 rounded-xl font-mono font-bold text-xs border transition-all ${
                        budgetAmountInput === String(amt)
                          ? 'bg-forest text-amber border-forest shadow-sm scale-105'
                          : 'bg-white hover:bg-cream-100 text-ink border-cream-300'
                      }`}
                    >
                      {formatRupiah(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              {(() => {
                const enteredBudget = Number(budgetAmountInput) || 0;
                const unitPrice = budgetModalItem.product.selling_price;
                const calculatedQty = unitPrice > 0 ? parseFloat((enteredBudget / unitPrice).toFixed(3)) : 0;
                const unit = budgetModalItem.product.unit || 'pcs';
                const isOverStock = calculatedQty > budgetModalItem.product.stock_quantity;

                return (
                  <div className="p-4 bg-forest/5 rounded-2xl border-2 border-forest/20 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-ink-muted">Takaran Didapat:</span>
                      <span className="font-mono font-black text-xl text-forest">
                        {formatQty(calculatedQty)} {unit}
                      </span>
                    </div>

                    {unit.toLowerCase() === 'kg' && (
                      <div className="flex justify-between text-xs text-ink-subtle">
                        <span>Setara Berat:</span>
                        <span className="font-mono font-bold text-forest">{Math.round(calculatedQty * 1000)} gram</span>
                      </div>
                    )}

                    <div className="flex justify-between text-xs font-bold text-ink pt-1.5 border-t border-forest/15">
                      <span>Total Tagihan:</span>
                      <span className="font-mono text-forest font-extrabold text-sm">{formatRupiah(enteredBudget)}</span>
                    </div>

                    {isOverStock && (
                      <p className="text-xs font-bold text-status-dangerText bg-status-dangerBg p-2.5 rounded-xl border border-status-dangerText/30">
                        Peringatan: Takaran ({formatQty(calculatedQty)} {unit}) melebihi stok yang ada ({formatQty(budgetModalItem.product.stock_quantity)} {unit})!
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBudgetModalItem(null)}
                  className="flex-1 py-3 bg-cream-200 hover:bg-cream-300 text-ink font-bold rounded-2xl text-sm transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={
                    !Number(budgetAmountInput) ||
                    (budgetModalItem.product.selling_price > 0 &&
                      Number(budgetAmountInput) / budgetModalItem.product.selling_price > budgetModalItem.product.stock_quantity)
                  }
                  onClick={() => {
                    const enteredBudget = Number(budgetAmountInput) || 0;
                    const unitPrice = budgetModalItem.product.selling_price;
                    if (unitPrice > 0 && enteredBudget > 0) {
                      const calculatedQty = parseFloat((enteredBudget / unitPrice).toFixed(3));
                      handleSetExactQuantity(budgetModalItem.product.id, calculatedQty);
                      setBudgetModalItem(null);
                    }
                  }}
                  className="flex-1 py-3 bg-amber hover:bg-amber-hover disabled:bg-cream-300 disabled:text-ink-subtle text-forest font-extrabold rounded-2xl text-sm shadow-md transition-all active:scale-95"
                >
                  Terapkan Takaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast Alerts */}
      <ToastAlert toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};
