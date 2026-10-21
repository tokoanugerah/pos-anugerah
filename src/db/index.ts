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

// Initial Seed Products with explicit Units
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    barcode: '899999900101',
    name: 'Minyak Goreng Bimoli 2 Liter',
    category: 'Sembako',
    unit: 'pouch',
    cost_price: 33000,
    selling_price: 37500,
    stock_quantity: 48,
    min_stock_alert: 10,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_2',
    barcode: '899999900102',
    name: 'Beras Premium Rojolele 5 Kg',
    category: 'Sembako',
    unit: 'sak',
    cost_price: 68000,
    selling_price: 75000,
    stock_quantity: 24,
    min_stock_alert: 5,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_3',
    barcode: '899999900103',
    name: 'Gula Pasir Gulaku Putih 1 Kg',
    category: 'Sembako',
    unit: 'kg',
    cost_price: 15500,
    selling_price: 18000,
    stock_quantity: 35,
    min_stock_alert: 10,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_4',
    barcode: '899886620022',
    name: 'Indomie Goreng Spesial 85g',
    category: 'Makanan & Mie',
    unit: 'bungkus',
    cost_price: 2750,
    selling_price: 3500,
    stock_quantity: 120,
    min_stock_alert: 25,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_5',
    barcode: '899886620039',
    name: 'Indomie Kuah Kari Ayam 72g',
    category: 'Makanan & Mie',
    unit: 'bungkus',
    cost_price: 2700,
    selling_price: 3500,
    stock_quantity: 95,
    min_stock_alert: 20,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_6',
    barcode: '899999900106',
    name: 'Telur Ayam Ras Segar 1 Kg',
    category: 'Sembako',
    unit: 'kg',
    cost_price: 26000,
    selling_price: 29000,
    stock_quantity: 18,
    min_stock_alert: 8,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_7',
    barcode: '888600810105',
    name: 'Aqua Air Mineral Botol 600ml',
    category: 'Minuman',
    unit: 'botol',
    cost_price: 2900,
    selling_price: 4000,
    stock_quantity: 60,
    min_stock_alert: 15,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_8',
    barcode: '899100110022',
    name: 'Teh Pucuk Harum Melati 350ml',
    category: 'Minuman',
    unit: 'botol',
    cost_price: 2800,
    selling_price: 4000,
    stock_quantity: 45,
    min_stock_alert: 12,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_9',
    barcode: '899111810115',
    name: 'Kopi Kapal Api Spesial Mix 10sct',
    category: 'Minuman',
    unit: 'renceng',
    cost_price: 12500,
    selling_price: 15000,
    stock_quantity: 30,
    min_stock_alert: 10,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_10',
    barcode: '899999900110',
    name: 'Kecap Manis Bango Refill 520ml',
    category: 'Bumbu & Dapur',
    unit: 'pouch',
    cost_price: 21000,
    selling_price: 24500,
    stock_quantity: 22,
    min_stock_alert: 6,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_11',
    barcode: '899999900111',
    name: 'Sunlight Jeruk Nipis Refill 750ml',
    category: 'Sabun & Kebersihan',
    unit: 'pouch',
    cost_price: 13500,
    selling_price: 16500,
    stock_quantity: 34,
    min_stock_alert: 8,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_12',
    barcode: '899999900112',
    name: 'Sabun Mandi Lifebuoy Total 10 110g',
    category: 'Sabun & Kebersihan',
    unit: 'batang',
    cost_price: 4200,
    selling_price: 5500,
    stock_quantity: 50,
    min_stock_alert: 15,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_13',
    barcode: '899999900113',
    name: 'Deterjen Rinso Molto Bubuk 770g',
    category: 'Sabun & Kebersihan',
    unit: 'bungkus',
    cost_price: 20500,
    selling_price: 24000,
    stock_quantity: 4,
    min_stock_alert: 8,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_14',
    barcode: '899999900114',
    name: 'Biskuit Roma Kelapa 300g',
    category: 'Makanan & Mie',
    unit: 'bungkus',
    cost_price: 8900,
    selling_price: 11000,
    stock_quantity: 18,
    min_stock_alert: 5,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  },
  {
    id: 'prod_15',
    barcode: '899999900115',
    name: 'Susu Kental Manis Frisian Flag 370g',
    category: 'Makanan & Mie',
    unit: 'kaleng',
    cost_price: 11500,
    selling_price: 13500,
    stock_quantity: 0,
    min_stock_alert: 6,
    is_active: 1,
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
  }
];

// Initial Seed Sales
export const INITIAL_SALES: { sale: Sale; items: SaleItem[] }[] = [
  {
    sale: {
      id: 'sale_1',
      receipt_number: 'NOTA-AS-20261020-0001',
      transaction_date: '2026-10-20T08:15:00Z',
      total_amount: 112500,
      total_cost: 101000,
      gross_profit: 11500,
      payment_method: 'TUNAI',
      cash_received: 120000,
      change_given: 7500,
      cashier_name: 'Kasir Anugerah Store',
      notes: 'Pelanggan Ibu Siti',
    },
    items: [
      {
        id: 'item_1_1',
        sale_id: 'sale_1',
        product_id: 'prod_2',
        product_name: 'Beras Premium Rojolele 5 Kg',
        quantity: 1,
        unit: 'sak',
        unit_cost: 68000,
        unit_price: 75000,
        subtotal: 75000,
        subtotal_cost: 68000,
        subtotal_profit: 7000,
      },
      {
        id: 'item_1_2',
        sale_id: 'sale_1',
        product_id: 'prod_1',
        product_name: 'Minyak Goreng Bimoli 2 Liter',
        quantity: 1,
        unit: 'pouch',
        unit_cost: 33000,
        unit_price: 37500,
        subtotal: 37500,
        subtotal_cost: 33000,
        subtotal_profit: 4500,
      },
    ],
  },
  {
    sale: {
      id: 'sale_2',
      receipt_number: 'NOTA-AS-20261020-0002',
      transaction_date: '2026-10-20T10:45:00Z',
      total_amount: 54000,
      total_cost: 44250,
      gross_profit: 9750,
      payment_method: 'QRIS',
      cash_received: 54000,
      change_given: 0,
      cashier_name: 'Kasir Anugerah Store',
    },
    items: [
      {
        id: 'item_2_1',
        sale_id: 'sale_2',
        product_id: 'prod_4',
        product_name: 'Indomie Goreng Spesial 85g',
        quantity: 5,
        unit: 'bungkus',
        unit_cost: 2750,
        unit_price: 3500,
        subtotal: 17500,
        subtotal_cost: 13750,
        subtotal_profit: 3750,
      },
      {
        id: 'item_2_2',
        sale_id: 'sale_2',
        product_id: 'prod_3',
        product_name: 'Gula Pasir Gulaku Putih 1 Kg',
        quantity: 1,
        unit: 'kg',
        unit_cost: 15500,
        unit_price: 18000,
        subtotal: 18000,
        subtotal_cost: 15500,
        subtotal_profit: 2500,
      },
      {
        id: 'item_2_3',
        sale_id: 'sale_2',
        product_id: 'prod_10',
        product_name: 'Kecap Manis Bango Refill 520ml',
        quantity: 1,
        unit: 'pouch',
        unit_cost: 15000,
        unit_price: 18500,
        subtotal: 18500,
        subtotal_cost: 15000,
        subtotal_profit: 3500,
      },
    ],
  },
  {
    sale: {
      id: 'sale_3',
      receipt_number: 'NOTA-AS-20261020-0003',
      transaction_date: '2026-10-20T13:20:00Z',
      total_amount: 87000,
      total_cost: 78000,
      gross_profit: 9000,
      payment_method: 'TRANSFER',
      cash_received: 87000,
      change_given: 0,
      cashier_name: 'Kasir Anugerah Store',
      notes: 'Transfer Bank BCA',
    },
    items: [
      {
        id: 'item_3_1',
        sale_id: 'sale_3',
        product_id: 'prod_6',
        product_name: 'Telur Ayam Ras Segar 1 Kg',
        quantity: 3,
        unit: 'kg',
        unit_cost: 26000,
        unit_price: 29000,
        subtotal: 87000,
        subtotal_cost: 78000,
        subtotal_profit: 9000,
      },
    ],
  },
];

// Initial Seed Expenses
export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp_1',
    expense_date: '2026-10-18T09:00:00Z',
    category: 'LISTRIK',
    description: 'Token Listrik PLN Toko 2200 VA',
    amount: 150000,
  },
  {
    id: 'exp_2',
    expense_date: '2026-10-19T14:30:00Z',
    category: 'OPERASIONAL',
    description: 'Kantong Kresek Ramah Lingkungan 1 Bal',
    amount: 45000,
  },
  {
    id: 'exp_3',
    expense_date: '2026-10-20T07:30:00Z',
    category: 'KULAKAN_STOK',
    description: 'Kulakan Tambahan Beras Rojolele 10 Sak',
    amount: 680000,
  },
];

/**
 * Inisialisasi basis data lokal jika masih kosong
 */
export async function initializeDatabase() {
  const count = await db.products.count();
  if (count === 0) {
    console.log('Mengisi data awal Anugerah Store ke Dexie.js (IndexedDB)...');
    await db.products.bulkAdd(INITIAL_PRODUCTS);

    for (const item of INITIAL_SALES) {
      await db.sales.add(item.sale);
      await db.sale_items.bulkAdd(item.items);
    }

    await db.expenses.bulkAdd(INITIAL_EXPENSES);
  } else {
    // Migration: ensure every product has a unit field if missing
    const prods = await db.products.toArray();
    for (const p of prods) {
      if (!p.unit) {
        await db.products.update(p.id, { unit: 'pcs' });
      }
    }
  }
}

/**
 * Reset data ke pengaturan awal
 */
export async function resetDatabaseToInitial() {
  await db.products.clear();
  await db.sales.clear();
  await db.sale_items.clear();
  await db.expenses.clear();
  await db.stock_audits.clear();
  await db.monthly_summaries.clear();

  await db.products.bulkAdd(INITIAL_PRODUCTS);
  for (const item of INITIAL_SALES) {
    await db.sales.add(item.sale);
    await db.sale_items.bulkAdd(item.items);
  }
  await db.expenses.bulkAdd(INITIAL_EXPENSES);
}
