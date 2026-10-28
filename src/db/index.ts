import Dexie, { type Table } from 'dexie';
import type { Product, Sale, SaleItem, Expense, StockAudit, MonthlySummary, StoreSettings } from '../types';

export class AnugerahStoreDB extends Dexie {
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;
  sale_items!: Table<SaleItem, string>;
  expenses!: Table<Expense, string>;
  stock_audits!: Table<StockAudit, string>;
  monthly_summaries!: Table<MonthlySummary, string>;

  constructor() {
    super('AnugerahStoreDB');
    this.version(2).stores({
      products: 'id, &barcode, name, category, unit, cost_price, selling_price, stock_quantity, is_active',
      sales: 'id, &receipt_number, transaction_date, payment_method, cashier_name',
      sale_items: 'id, sale_id, product_id',
      expenses: 'id, expense_date, category',
      stock_audits: 'id, audit_date, product_id, barcode',
      monthly_summaries: 'month_year',
    });
    this.version(3).stores({
      products: 'id, barcode, name, category, unit, cost_price, selling_price, stock_quantity, is_active',
      sales: 'id, &receipt_number, transaction_date, payment_method, cashier_name',
      sale_items: 'id, sale_id, product_id',
      expenses: 'id, expense_date, category',
      stock_audits: 'id, audit_date, product_id, barcode',
      monthly_summaries: 'month_year',
    });
  }
}

export const db = new AnugerahStoreDB();

// Default Categories for Products
export const DEFAULT_CATEGORIES: string[] = [
  'Sembako',
  'Makanan & Mie',
  'Minuman',
  'Bumbu & Dapur',
  'Sabun & Kebersihan',
  'Perawatan Diri',
  'Snack & Camilan',
  'Lainnya',
];

// Default Store Settings
export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Anugerah Store',
  storeAddress: 'Jl. Merdeka No. 45, Pasar Induk',
  storePhone: '0812-3456-7890',
  receiptFooter: 'Terima kasih telah berbelanja di Anugerah Store. Semoga berkah selalu!',
  cashierName: 'Kasir Anugerah Store',
  categories: DEFAULT_CATEGORIES,
};

export function getStoreSettings(): StoreSettings {
  try {
    const saved = localStorage.getItem('as_store_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        categories: Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : DEFAULT_CATEGORIES,
      };
    }
  } catch (e) {
    console.warn('Gagal membaca pengaturan toko:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveStoreSettings(settings: StoreSettings) {
  localStorage.setItem('as_store_settings', JSON.stringify(settings));
}

export function getProductCategories(): string[] {
  const settings = getStoreSettings();
  if (settings.categories && Array.isArray(settings.categories) && settings.categories.length > 0) {
    return settings.categories;
  }
  return DEFAULT_CATEGORIES;
}

export function saveProductCategories(categories: string[]) {
  const settings = getStoreSettings();
  settings.categories = categories;
  saveStoreSettings(settings);
}

/**
 * Inisialisasi basis data lokal Anugerah Store
 * Memastikan skema lokal siap dan konsisten
 * Tidak ada logika pembersih otomatis - semua data pengguna 100% aman dan permanen
 */
export async function initializeDatabase() {
  const prods = await db.products.toArray();

  // Pastikan setiap produk memiliki satuan (unit), default 'pcs'
  for (const p of prods) {
    if (!p.unit) {
      await db.products.update(p.id, { unit: 'pcs' });
    }
  }
}

/**
 * Kosongkan seluruh data toko (Hanya dipanggil atas konfirmasi manual pengguna)
 */
export async function clearAllStoreData() {
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
    }
  );

  // Simpan pengaturan standar
  saveStoreSettings(DEFAULT_SETTINGS);
}
