import { createClient, type Client } from '@libsql/client/web';
import { db, DEFAULT_CATEGORIES, DEFAULT_SETTINGS, saveStoreSettings } from './index';
import type { Product, Sale, SaleItem, Expense, StockAudit, ExpenseCategory, StoreSettings } from '../types';

export const TURSO_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT DEFAULT 'pcs',
    cost_price INTEGER NOT NULL,
    selling_price INTEGER NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER NOT NULL DEFAULT 5,
    image TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    receipt_number TEXT UNIQUE NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount INTEGER NOT NULL,
    total_cost INTEGER NOT NULL,
    gross_profit INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    cash_received INTEGER DEFAULT 0,
    change_given INTEGER DEFAULT 0,
    cashier_name TEXT DEFAULT 'Kasir Anugerah Store',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT DEFAULT 'pcs',
    unit_cost INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    subtotal_cost INTEGER NOT NULL,
    subtotal_profit INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    receipt_photo_url TEXT
);

CREATE TABLE IF NOT EXISTS stock_audits (
    id TEXT PRIMARY KEY,
    audit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    product_id TEXT NOT NULL,
    product_name TEXT,
    barcode TEXT,
    system_stock INTEGER NOT NULL,
    physical_stock INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS monthly_summaries (
    month_year TEXT PRIMARY KEY,
    total_sales_revenue INTEGER NOT NULL DEFAULT 0,
    total_cogs INTEGER NOT NULL DEFAULT 0,
    gross_profit INTEGER NOT NULL DEFAULT 0,
    total_expenses INTEGER NOT NULL DEFAULT 0,
    net_profit INTEGER NOT NULL DEFAULT 0,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    cash_revenue INTEGER NOT NULL DEFAULT 0,
    qris_revenue INTEGER NOT NULL DEFAULT 0,
    transfer_revenue INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_settings (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    store_address TEXT NOT NULL,
    store_phone TEXT NOT NULL,
    cashier_name TEXT NOT NULL,
    receipt_footer TEXT NOT NULL,
    categories TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

let cachedClient: Client | null = null;
let schemaEnsured = false;

interface SyncRegistry {
  products: string[];
  sales: string[];
  expenses: string[];
  stock_audits: string[];
}

function getSyncedIds(): SyncRegistry {
  try {
    const raw = localStorage.getItem('as_synced_ids');
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore error
  }
  return { products: [], sales: [], expenses: [], stock_audits: [] };
}

function saveSyncedIds(reg: SyncRegistry) {
  try {
    localStorage.setItem('as_synced_ids', JSON.stringify(reg));
  } catch {
    // Ignore error
  }
}

function getPendingDeletions(): SyncRegistry {
  try {
    const raw = localStorage.getItem('as_pending_deletions');
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore error
  }
  return { products: [], sales: [], expenses: [], stock_audits: [] };
}

function savePendingDeletions(reg: SyncRegistry) {
  try {
    localStorage.setItem('as_pending_deletions', JSON.stringify(reg));
  } catch {
    // Ignore error
  }
}

function recordPendingDeletion(table: keyof SyncRegistry, id: string) {
  const pending = getPendingDeletions();
  if (!pending[table].includes(id)) {
    pending[table].push(id);
    savePendingDeletions(pending);
  }
  // Hapus juga dari synced ids
  const synced = getSyncedIds();
  synced[table] = synced[table].filter((x) => x !== id);
  saveSyncedIds(synced);
}

export function isTursoConfigured(): boolean {
  const url = import.meta.env.VITE_TURSO_URL;
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;
  return Boolean(url && authToken && url.trim().length > 0 && authToken.trim().length > 0);
}

export function getTursoClient(): Client {
  if (cachedClient) return cachedClient;

  const url = import.meta.env.VITE_TURSO_URL;
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('Konfigurasi Turso belum lengkap di environment (VITE_TURSO_URL dan VITE_TURSO_AUTH_TOKEN).');
  }

  let formattedUrl = url.trim();
  if (formattedUrl.startsWith('libsql://')) {
    formattedUrl = formattedUrl.replace('libsql://', 'https://');
  }

  cachedClient = createClient({
    url: formattedUrl,
    authToken: authToken.trim(),
  });

  return cachedClient;
}

export async function ensureTursoSchema(): Promise<void> {
  if (schemaEnsured) return;
  try {
    const client = getTursoClient();
    const statements = TURSO_SCHEMA_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const sql of statements) {
      await client.execute(sql);
    }

    // Defensive migrations jika tabel dibuat pada versi lama
    try {
      await client.execute('ALTER TABLE products ADD COLUMN image TEXT;');
    } catch {
      // image sudah ada
    }
    try {
      await client.execute('ALTER TABLE stock_audits ADD COLUMN product_name TEXT;');
    } catch {
      // product_name sudah ada
    }
    try {
      await client.execute('ALTER TABLE stock_audits ADD COLUMN barcode TEXT;');
    } catch {
      // barcode sudah ada
    }

    schemaEnsured = true;
  } catch (err) {
    console.warn('Gagal memverifikasi skema Turso:', err);
  }
}

/**
 * Tes koneksi ke Turso melalui kredensial .env
 */
export async function testTursoConnection(): Promise<{ success: boolean; message: string }> {
  try {
    if (!isTursoConfigured()) {
      return { success: false, message: 'Kredensial Turso tidak ditemukan di .env' };
    }
    const client = getTursoClient();
    const result = await client.execute('SELECT 1 as connected;');
    if (result.rows.length > 0) {
      return { success: true, message: 'Koneksi ke database Turso Cloud aktif dan terhubung.' };
    }
    return { success: false, message: 'Gagal mendapatkan respon dari Turso Cloud.' };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Koneksi gagal: ${msg}` };
  }
}

/**
 * Simpan atau perbarui 1 produk langsung ke Turso di background
 */
export async function syncProductToTurso(product: Product): Promise<{ success: boolean; message?: string }> {
  if (!isTursoConfigured()) return { success: false, message: 'Turso tidak dikonfigurasi' };
  try {
    await ensureTursoSchema();
    const client = getTursoClient();
    await client.execute({
      sql: `INSERT OR REPLACE INTO products (id, barcode, name, category, unit, cost_price, selling_price, stock_quantity, min_stock_alert, image, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        product.id,
        product.barcode ?? null,
        product.name,
        product.category,
        product.unit || 'pcs',
        product.cost_price,
        product.selling_price,
        product.stock_quantity,
        product.min_stock_alert,
        product.image ?? null,
        product.is_active,
        product.created_at,
        product.updated_at,
      ],
    });

    // Tandai bahwa ID ini telah tersinkronisasi di Turso
    const synced = getSyncedIds();
    if (!synced.products.includes(product.id)) {
      synced.products.push(product.id);
      saveSyncedIds(synced);
    }

    recordLastSync();
    console.info(`[Turso Cloud] Produk "${product.name}" berhasil disinkronkan ke remote database.`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Turso Cloud] Gagal menyinkronkan produk ke Turso:', err);
    return { success: false, message: msg };
  }
}

/**
 * Hapus 1 produk dari Turso di background
 */
export async function deleteProductFromTurso(productId: string): Promise<void> {
  recordPendingDeletion('products', productId);
  if (!isTursoConfigured()) return;
  try {
    const client = getTursoClient();
    await client.execute({
      sql: `DELETE FROM products WHERE id = ?`,
      args: [productId],
    });
    // Jika berhasil dihapus di Turso, bersihkan dari antrean pending
    const pending = getPendingDeletions();
    pending.products = pending.products.filter((id) => id !== productId);
    savePendingDeletions(pending);
    recordLastSync();
    console.info(`[Turso Cloud] Produk ID "${productId}" berhasil dihapus dari remote database.`);
  } catch (err) {
    console.warn('[Turso Cloud] Gagal menghapus produk dari Turso, disimpan ke antrean offline:', err);
  }
}

/**
 * Simpan transaksi penjualan + rincian item ke Turso di background
 */
export async function syncSaleToTurso(sale: Sale, saleItems: SaleItem[]): Promise<{ success: boolean; message?: string }> {
  if (!isTursoConfigured()) return { success: false, message: 'Turso tidak dikonfigurasi' };
  try {
    await ensureTursoSchema();
    const client = getTursoClient();

    // 1. Simpan Header Nota
    await client.execute({
      sql: `INSERT OR REPLACE INTO sales (id, receipt_number, transaction_date, total_amount, total_cost, gross_profit, payment_method, cash_received, change_given, cashier_name, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sale.id,
        sale.receipt_number,
        sale.transaction_date,
        sale.total_amount,
        sale.total_cost,
        sale.gross_profit,
        sale.payment_method,
        sale.cash_received,
        sale.change_given,
        sale.cashier_name,
        sale.notes || null,
      ],
    });

    // 2. Simpan Item Penjualan & perbarui stok produk di remote Turso
    for (const item of saleItems) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO sale_items (id, sale_id, product_id, product_name, quantity, unit, unit_cost, unit_price, subtotal, subtotal_cost, subtotal_profit)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          item.id,
          item.sale_id,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit || 'pcs',
          item.unit_cost,
          item.unit_price,
          item.subtotal,
          item.subtotal_cost,
          item.subtotal_profit,
        ],
      });

      // Update stok remote produk jika ada
      await client.execute({
        sql: `UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [item.quantity, item.product_id],
      });
    }

    const synced = getSyncedIds();
    if (!synced.sales.includes(sale.id)) {
      synced.sales.push(sale.id);
      saveSyncedIds(synced);
    }

    recordLastSync();
    console.info(`[Turso Cloud] Transaksi #${sale.receipt_number} berhasil dicatat di Turso.`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Turso Cloud] Gagal mencatat transaksi ke Turso:', err);
    return { success: false, message: msg };
  }
}

/**
 * Hapus transaksi penjualan dari Turso di background
 */
export async function deleteSaleFromTurso(saleId: string): Promise<void> {
  recordPendingDeletion('sales', saleId);
  if (!isTursoConfigured()) return;
  try {
    const client = getTursoClient();
    await client.execute({
      sql: `DELETE FROM sales WHERE id = ?`,
      args: [saleId],
    });
    await client.execute({
      sql: `DELETE FROM sale_items WHERE sale_id = ?`,
      args: [saleId],
    });
    const pending = getPendingDeletions();
    pending.sales = pending.sales.filter((id) => id !== saleId);
    savePendingDeletions(pending);
    recordLastSync();
  } catch (err) {
    console.warn('[Turso Cloud] Gagal menghapus transaksi dari Turso:', err);
  }
}

/**
 * Simpan pengeluaran ke Turso di background
 */
export async function syncExpenseToTurso(expense: Expense): Promise<void> {
  if (!isTursoConfigured()) return;
  try {
    await ensureTursoSchema();
    const client = getTursoClient();
    await client.execute({
      sql: `INSERT OR REPLACE INTO expenses (id, expense_date, category, description, amount, receipt_photo_url)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        expense.id,
        expense.expense_date,
        expense.category,
        expense.description,
        expense.amount,
        expense.receipt_photo_url || null,
      ],
    });

    const synced = getSyncedIds();
    if (!synced.expenses.includes(expense.id)) {
      synced.expenses.push(expense.id);
      saveSyncedIds(synced);
    }

    recordLastSync();
  } catch (err) {
    console.warn('[Turso Cloud] Gagal menyimpan pengeluaran ke Turso:', err);
  }
}

/**
 * Hapus pengeluaran dari Turso di background
 */
export async function deleteExpenseFromTurso(expenseId: string): Promise<void> {
  recordPendingDeletion('expenses', expenseId);
  if (!isTursoConfigured()) return;
  try {
    const client = getTursoClient();
    await client.execute({
      sql: `DELETE FROM expenses WHERE id = ?`,
      args: [expenseId],
    });
    const pending = getPendingDeletions();
    pending.expenses = pending.expenses.filter((id) => id !== expenseId);
    savePendingDeletions(pending);
    recordLastSync();
  } catch (err) {
    console.warn('[Turso Cloud] Gagal menghapus pengeluaran dari Turso:', err);
  }
}

/**
 * Simpan audit stok ke Turso di background
 */
export async function syncStockAuditToTurso(audit: StockAudit): Promise<void> {
  if (!isTursoConfigured()) return;
  try {
    await ensureTursoSchema();
    const client = getTursoClient();
    await client.execute({
      sql: `INSERT OR REPLACE INTO stock_audits (id, audit_date, product_id, product_name, barcode, system_stock, physical_stock, difference, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        audit.id,
        audit.audit_date,
        audit.product_id,
        audit.product_name || null,
        audit.barcode || null,
        audit.system_stock,
        audit.physical_stock,
        audit.difference,
        audit.notes || null,
      ],
    });
    // Update stok produk ke nilai fisik
    await client.execute({
      sql: `UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [audit.physical_stock, audit.product_id],
    });

    const synced = getSyncedIds();
    if (!synced.stock_audits.includes(audit.id)) {
      synced.stock_audits.push(audit.id);
      saveSyncedIds(synced);
    }

    recordLastSync();
  } catch (err) {
    console.warn('[Turso Cloud] Gagal mencatat audit stok ke Turso:', err);
  }
}

/**
 * Simpan Profil Toko & Format Struk ke Turso di background
 */
export async function syncStoreSettingsToTurso(settings: StoreSettings): Promise<{ success: boolean; message?: string }> {
  if (!isTursoConfigured()) return { success: false, message: 'Turso tidak dikonfigurasi' };
  try {
    await ensureTursoSchema();
    const client = getTursoClient();
    await client.execute({
      sql: `INSERT OR REPLACE INTO store_settings (id, store_name, store_address, store_phone, cashier_name, receipt_footer, categories, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [
        'default',
        settings.storeName,
        settings.storeAddress,
        settings.storePhone,
        settings.cashierName,
        settings.receiptFooter,
        JSON.stringify(settings.categories && settings.categories.length > 0 ? settings.categories : DEFAULT_CATEGORIES),
      ],
    });
    recordLastSync();
    console.info('[Turso Cloud] Pengaturan toko dan kategori berhasil disimpan ke Turso Cloud.');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Turso Cloud] Gagal menyimpan pengaturan toko ke Turso:', err);
    return { success: false, message: msg };
  }
}

/**
 * Tarik Profil Toko & Format Struk dari Turso Cloud ke Local
 */
export async function pullStoreSettingsFromTurso(): Promise<StoreSettings | null> {
  if (!isTursoConfigured()) return null;
  try {
    await ensureTursoSchema();
    const client = getTursoClient();
    const res = await client.execute("SELECT * FROM store_settings WHERE id = 'default' LIMIT 1");
    if (res.rows.length > 0) {
      const row = res.rows[0];
      let categories = DEFAULT_CATEGORIES;
      try {
        if (row.categories) {
          const parsed = JSON.parse(String(row.categories));
          if (Array.isArray(parsed) && parsed.length > 0) {
            categories = parsed;
          }
        }
      } catch {
        // Fallback default
      }

      const remoteSettings: StoreSettings = {
        storeName: String(row.store_name),
        storeAddress: String(row.store_address),
        storePhone: String(row.store_phone),
        cashierName: String(row.cashier_name),
        receiptFooter: String(row.receipt_footer),
        categories,
      };

      saveStoreSettings(remoteSettings);
      return remoteSettings;
    }
  } catch (err) {
    console.warn('[Turso Cloud] Gagal mengunduh pengaturan toko dari Turso:', err);
  }
  return null;
}

/**
 * PUSH PENUH: Sinkronisasi seluruh data lokal Dexie ke Turso Cloud
 */
export async function syncLocalToTurso(): Promise<{
  success: boolean;
  message: string;
  counts: Record<string, number>;
}> {
  if (!isTursoConfigured()) {
    return {
      success: false,
      message: 'Kredensial database Turso belum disetel di .env',
      counts: {},
    };
  }

  try {
    await ensureTursoSchema();
    const client = getTursoClient();

    // 0. Proses penghapusan tertunda (pending deletions) terlebih dahulu
    const pending = getPendingDeletions();
    for (const pid of pending.products) {
      await client.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [pid] });
    }
    for (const sid of pending.sales) {
      await client.execute({ sql: 'DELETE FROM sales WHERE id = ?', args: [sid] });
      await client.execute({ sql: 'DELETE FROM sale_items WHERE sale_id = ?', args: [sid] });
    }
    for (const eid of pending.expenses) {
      await client.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [eid] });
    }
    for (const aid of pending.stock_audits) {
      await client.execute({ sql: 'DELETE FROM stock_audits WHERE id = ?', args: [aid] });
    }
    // Kosongkan pending deletions setelah berhasil dikirim
    savePendingDeletions({ products: [], sales: [], expenses: [], stock_audits: [] });

    const products = await db.products.toArray();
    const sales = await db.sales.toArray();
    const saleItems = await db.sale_items.toArray();
    const expenses = await db.expenses.toArray();
    const stockAudits = await db.stock_audits.toArray();

    // 1. Batch upsert products
    for (const p of products) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO products (id, barcode, name, category, unit, cost_price, selling_price, stock_quantity, min_stock_alert, image, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.id,
          p.barcode ?? null,
          p.name,
          p.category,
          p.unit || 'pcs',
          p.cost_price,
          p.selling_price,
          p.stock_quantity,
          p.min_stock_alert,
          p.image ?? null,
          p.is_active,
          p.created_at,
          p.updated_at,
        ],
      });
    }

    // 2. Batch upsert sales
    for (const s of sales) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO sales (id, receipt_number, transaction_date, total_amount, total_cost, gross_profit, payment_method, cash_received, change_given, cashier_name, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          s.id,
          s.receipt_number,
          s.transaction_date,
          s.total_amount,
          s.total_cost,
          s.gross_profit,
          s.payment_method,
          s.cash_received,
          s.change_given,
          s.cashier_name,
          s.notes || null,
        ],
      });
    }

    // 3. Batch upsert sale items
    for (const item of saleItems) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO sale_items (id, sale_id, product_id, product_name, quantity, unit, unit_cost, unit_price, subtotal, subtotal_cost, subtotal_profit)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          item.id,
          item.sale_id,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit || 'pcs',
          item.unit_cost,
          item.unit_price,
          item.subtotal,
          item.subtotal_cost,
          item.subtotal_profit,
        ],
      });
    }

    // 4. Batch upsert expenses
    for (const e of expenses) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO expenses (id, expense_date, category, description, amount, receipt_photo_url)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [e.id, e.expense_date, e.category, e.description, e.amount, e.receipt_photo_url || null],
      });
    }

    // 5. Batch upsert stock audits
    for (const a of stockAudits) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO stock_audits (id, audit_date, product_id, product_name, barcode, system_stock, physical_stock, difference, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          a.id,
          a.audit_date,
          a.product_id,
          a.product_name || null,
          a.barcode || null,
          a.system_stock,
          a.physical_stock,
          a.difference,
          a.notes || null,
        ],
      });
    }

    // Perbarui registry ID yang sudah tersinkronisasi
    saveSyncedIds({
      products: products.map((p) => p.id),
      sales: sales.map((s) => s.id),
      expenses: expenses.map((e) => e.id),
      stock_audits: stockAudits.map((a) => a.id),
    });

    recordLastSync();

    return {
      success: true,
      message: 'Sinkronisasi berhasil! Seluruh data lokal toko tersimpan di Turso Cloud.',
      counts: {
        produk: products.length,
        transaksi: sales.length,
        item: saleItems.length,
        pengeluaran: expenses.length,
        auditStok: stockAudits.length,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Sinkronisasi gagal: ${msg}`,
      counts: {},
    };
  }
}

/**
 * PULL PENUH & REKONSILIASI PENGHAPUSAN (DELETE RECONCILIATION):
 * Ambil data dari Turso Cloud dan hapus data lokal yang sudah dihapus di Turso.
 */
export async function pullTursoToLocal(): Promise<{
  success: boolean;
  message: string;
  counts: Record<string, number>;
}> {
  if (!isTursoConfigured()) {
    return {
      success: false,
      message: 'Kredensial database Turso belum disetel di .env',
      counts: {},
    };
  }

  try {
    await ensureTursoSchema();
    const client = getTursoClient();
    const syncedRegistry = getSyncedIds();

    // 1. Ambil Produk dari Turso
    const prodRes = await client.execute('SELECT * FROM products');
    const remoteProducts: Product[] = prodRes.rows.map((row) => ({
      id: String(row.id),
      barcode: row.barcode ? String(row.barcode) : undefined,
      name: String(row.name),
      category: String(row.category),
      unit: (row.unit ? String(row.unit) : 'pcs') as Product['unit'],
      cost_price: Number(row.cost_price),
      selling_price: Number(row.selling_price),
      stock_quantity: Number(row.stock_quantity),
      min_stock_alert: Number(row.min_stock_alert),
      image: row.image ? String(row.image) : undefined,
      is_active: Number(row.is_active) === 1 ? 1 : 0,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));

    const remoteProductIds = new Set(remoteProducts.map((p) => p.id));
    const localProducts = await db.products.toArray();

    // REKONSILIASI PENGHAPUSAN PRODUK:
    // Jika sebuah produk lokal sebelumnya sudah pernah tersinkron ke Turso (ada di syncedRegistry),
    // tapi saat ini TIDAK ADA di Turso, berarti produk tersebut TELAH DIHAPUS di Turso!
    // Hapus dari Dexie lokal agar tidak muncul kembali!
    for (const lp of localProducts) {
      if (syncedRegistry.products.includes(lp.id) && !remoteProductIds.has(lp.id)) {
        await db.products.delete(lp.id);
        console.info(`[Turso Reconciliation] Produk "${lp.name}" telah dihapus di remote database, menghapus dari lokal.`);
      }
    }

    if (remoteProducts.length > 0) {
      await db.products.bulkPut(remoteProducts);
    }

    // 2. Ambil Transaksi Penjualan
    const salesRes = await client.execute('SELECT * FROM sales');
    const remoteSales: Sale[] = salesRes.rows.map((row) => ({
      id: String(row.id),
      receipt_number: String(row.receipt_number),
      transaction_date: String(row.transaction_date),
      total_amount: Number(row.total_amount),
      total_cost: Number(row.total_cost),
      gross_profit: Number(row.gross_profit),
      payment_method: String(row.payment_method) as Sale['payment_method'],
      cash_received: Number(row.cash_received),
      change_given: Number(row.change_given),
      cashier_name: String(row.cashier_name),
      notes: row.notes ? String(row.notes) : undefined,
    }));

    const remoteSaleIds = new Set(remoteSales.map((s) => s.id));
    const localSales = await db.sales.toArray();
    for (const ls of localSales) {
      if (syncedRegistry.sales.includes(ls.id) && !remoteSaleIds.has(ls.id)) {
        await db.sales.delete(ls.id);
      }
    }

    if (remoteSales.length > 0) {
      await db.sales.bulkPut(remoteSales);
    }

    // 3. Ambil Item Penjualan
    const itemsRes = await client.execute('SELECT * FROM sale_items');
    const remoteItems: SaleItem[] = itemsRes.rows.map((row) => ({
      id: String(row.id),
      sale_id: String(row.sale_id),
      product_id: String(row.product_id),
      product_name: String(row.product_name),
      quantity: Number(row.quantity),
      unit: (row.unit ? String(row.unit) : 'pcs') as SaleItem['unit'],
      unit_cost: Number(row.unit_cost),
      unit_price: Number(row.unit_price),
      subtotal: Number(row.subtotal),
      subtotal_cost: Number(row.subtotal_cost),
      subtotal_profit: Number(row.subtotal_profit),
    }));

    const remoteItemIds = new Set(remoteItems.map((i) => i.id));
    const localItems = await db.sale_items.toArray();
    for (const li of localItems) {
      if (!remoteItemIds.has(li.id)) {
        await db.sale_items.delete(li.id);
      }
    }

    if (remoteItems.length > 0) {
      await db.sale_items.bulkPut(remoteItems);
    }

    // 4. Ambil Pengeluaran
    const expRes = await client.execute('SELECT * FROM expenses');
    const remoteExpenses: Expense[] = expRes.rows.map((row) => ({
      id: String(row.id),
      expense_date: String(row.expense_date),
      category: (row.category ? String(row.category) : 'Lainnya') as ExpenseCategory,
      description: String(row.description),
      amount: Number(row.amount),
      receipt_photo_url: row.receipt_photo_url ? String(row.receipt_photo_url) : undefined,
    }));

    const remoteExpIds = new Set(remoteExpenses.map((e) => e.id));
    const localExpenses = await db.expenses.toArray();
    for (const le of localExpenses) {
      if (syncedRegistry.expenses.includes(le.id) && !remoteExpIds.has(le.id)) {
        await db.expenses.delete(le.id);
      }
    }

    if (remoteExpenses.length > 0) {
      await db.expenses.bulkPut(remoteExpenses);
    }

    // 5. Ambil Audit Stok
    const auditRes = await client.execute('SELECT * FROM stock_audits');
    const remoteAudits: StockAudit[] = auditRes.rows.map((row) => ({
      id: String(row.id),
      audit_date: String(row.audit_date),
      product_id: String(row.product_id),
      product_name: row.product_name ? String(row.product_name) : 'Produk',
      barcode: row.barcode ? String(row.barcode) : undefined,
      system_stock: Number(row.system_stock),
      physical_stock: Number(row.physical_stock),
      difference: Number(row.difference),
      notes: row.notes ? String(row.notes) : undefined,
    }));

    const remoteAuditIds = new Set(remoteAudits.map((a) => a.id));
    const localAudits = await db.stock_audits.toArray();
    for (const la of localAudits) {
      if (syncedRegistry.stock_audits.includes(la.id) && !remoteAuditIds.has(la.id)) {
        await db.stock_audits.delete(la.id);
      }
    }

    if (remoteAudits.length > 0) {
      await db.stock_audits.bulkPut(remoteAudits);
    }

    // Perbarui synced registry ke keadaan terkini
    saveSyncedIds({
      products: remoteProducts.map((p) => p.id),
      sales: remoteSales.map((s) => s.id),
      expenses: remoteExpenses.map((e) => e.id),
      stock_audits: remoteAudits.map((a) => a.id),
    });

    recordLastSync();

    return {
      success: true,
      message: 'Berhasil mengunduh dan menyelaraskan data dengan Turso Cloud!',
      counts: {
        produk: remoteProducts.length,
        transaksi: remoteSales.length,
        item: remoteItems.length,
        pengeluaran: remoteExpenses.length,
        auditStok: remoteAudits.length,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Gagal mengunduh dari Turso: ${msg}`,
      counts: {},
    };
  }
}

/**
 * SINKRONISASI DUA ARAH (BIDIRECTIONAL SYNC):
 * 1. Tarik & selaraskan data dari Cloud Turso ke Dexie lokal (termasuk penghapusan).
 * 2. Dorong data lokal baru (yang dibuat saat offline) ke Turso Cloud.
 * 3. Selaraskan profil toko & kategori barang.
 */
export async function syncBidirectional(): Promise<{
  success: boolean;
  message: string;
  pulled: Record<string, number>;
  pushed: Record<string, number>;
  settings?: StoreSettings | null;
}> {
  if (!isTursoConfigured()) {
    return {
      success: false,
      message: 'Kredensial database Turso belum disetel di .env',
      pulled: {},
      pushed: {},
    };
  }

  try {
    // 1. Tarik dan rekonsiliasi data dari Cloud
    const pullRes = await pullTursoToLocal();

    // 2. Tarik Profil Toko & Kategori dari Turso
    const remoteSettings = await pullStoreSettingsFromTurso();

    // 3. Dorong data lokal yang belum ada di Turso
    const pushRes = await syncLocalToTurso();

    // 4. Jika profil toko di Turso belum ada, unggah pengaturan lokal
    if (!remoteSettings) {
      const localSettings = { ...DEFAULT_SETTINGS };
      await syncStoreSettingsToTurso(localSettings);
    }

    return {
      success: pullRes.success && pushRes.success,
      message: 'Sinkronisasi dua arah dengan Cloud Turso berhasil selesai.',
      pulled: pullRes.counts,
      pushed: pushRes.counts,
      settings: remoteSettings,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Sinkronisasi dua arah gagal: ${msg}`,
      pulled: {},
      pushed: {},
    };
  }
}

/**
 * Statistik jumlah baris tabel di Turso Cloud
 */
export async function getTursoCloudStats(): Promise<{
  connected: boolean;
  counts: {
    products: number;
    sales: number;
    sale_items: number;
    expenses: number;
    stock_audits: number;
  };
}> {
  if (!isTursoConfigured()) {
    return {
      connected: false,
      counts: { products: 0, sales: 0, sale_items: 0, expenses: 0, stock_audits: 0 },
    };
  }

  try {
    await ensureTursoSchema();
    const client = getTursoClient();

    const [p, s, si, e, a] = await Promise.all([
      client.execute('SELECT COUNT(*) as c FROM products'),
      client.execute('SELECT COUNT(*) as c FROM sales'),
      client.execute('SELECT COUNT(*) as c FROM sale_items'),
      client.execute('SELECT COUNT(*) as c FROM expenses'),
      client.execute('SELECT COUNT(*) as c FROM stock_audits'),
    ]);

    return {
      connected: true,
      counts: {
        products: Number(p.rows[0]?.c ?? 0),
        sales: Number(s.rows[0]?.c ?? 0),
        sale_items: Number(si.rows[0]?.c ?? 0),
        expenses: Number(e.rows[0]?.c ?? 0),
        stock_audits: Number(a.rows[0]?.c ?? 0),
      },
    };
  } catch (err) {
    console.warn('Gagal membaca statistik Turso:', err);
    return {
      connected: false,
      counts: { products: 0, sales: 0, sale_items: 0, expenses: 0, stock_audits: 0 },
    };
  }
}

function recordLastSync() {
  try {
    localStorage.setItem('as_turso_last_sync', new Date().toISOString());
  } catch {
    // Ignore localStorage error
  }
}

export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem('as_turso_last_sync');
  } catch {
    return null;
  }
}
