import { createClient, type Client } from '@libsql/client/web';
import { db } from './index';
import type { Product, Sale, SaleItem, Expense, StockAudit, ExpenseCategory } from '../types';

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
`;

let cachedClient: Client | null = null;
let schemaEnsured = false;

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
export async function syncProductToTurso(product: Product): Promise<void> {
  if (!isTursoConfigured()) return;
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
    recordLastSync();
    console.info(`[Turso Cloud] Produk "${product.name}" berhasil disinkronkan ke remote database.`);
  } catch (err) {
    console.warn('[Turso Cloud] Gagal menyinkronkan produk ke Turso:', err);
  }
}

/**
 * Hapus 1 produk dari Turso di background
 */
export async function deleteProductFromTurso(productId: string): Promise<void> {
  if (!isTursoConfigured()) return;
  try {
    const client = getTursoClient();
    await client.execute({
      sql: `DELETE FROM products WHERE id = ?`,
      args: [productId],
    });
    recordLastSync();
  } catch (err) {
    console.warn('[Turso Cloud] Gagal menghapus produk dari Turso:', err);
  }
}

/**
 * Simpan transaksi penjualan + rincian item ke Turso di background
 */
export async function syncSaleToTurso(sale: Sale, saleItems: SaleItem[]): Promise<void> {
  if (!isTursoConfigured()) return;
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

    recordLastSync();
    console.info(`[Turso Cloud] Transaksi #${sale.receipt_number} berhasil dicatat di Turso.`);
  } catch (err) {
    console.warn('[Turso Cloud] Gagal mencatat transaksi ke Turso:', err);
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
    recordLastSync();
  } catch (err) {
    console.warn('[Turso Cloud] Gagal menyimpan pengeluaran ke Turso:', err);
  }
}

/**
 * Hapus pengeluaran dari Turso di background
 */
export async function deleteExpenseFromTurso(expenseId: string): Promise<void> {
  if (!isTursoConfigured()) return;
  try {
    const client = getTursoClient();
    await client.execute({
      sql: `DELETE FROM expenses WHERE id = ?`,
      args: [expenseId],
    });
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
    recordLastSync();
  } catch (err) {
    console.warn('[Turso Cloud] Gagal mencatat audit stok ke Turso:', err);
  }
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
 * PULL PENUH: Ambil data dari Turso Cloud dan gabungkan ke Dexie lokal
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

    if (remoteAudits.length > 0) {
      await db.stock_audits.bulkPut(remoteAudits);
    }

    recordLastSync();

    return {
      success: true,
      message: 'Berhasil mengunduh data dari Turso Cloud ke perangkat ini!',
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
