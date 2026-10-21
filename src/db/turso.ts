import { createClient } from '@libsql/client/web';
import { db } from './index';

export const TURSO_SCHEMA_SQL = `
-- 1. Master Data Produk Anugerah Store
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT DEFAULT 'pcs',
    cost_price INTEGER NOT NULL,
    selling_price INTEGER NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_alert INTEGER NOT NULL DEFAULT 5,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transaksi Penjualan (Header Nota)
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

-- 3. Rincian Item Penjualan
CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT DEFAULT 'pcs',
    unit_cost INTEGER NOT NULL,
    unit_price INTEGER NOT NULL,
    subtotal INTEGER NOT NULL,
    subtotal_cost INTEGER NOT NULL,
    subtotal_profit INTEGER NOT NULL
);

-- 4. Pengeluaran & Pembelanjaan (Kulakan Stok & Operasional Toko)
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    receipt_photo_url TEXT
);

-- 5. Pencatatan Stok Opname (Audit Fisik Anugerah Store)
CREATE TABLE IF NOT EXISTS stock_audits (
    id TEXT PRIMARY KEY,
    audit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    product_id TEXT NOT NULL REFERENCES products(id),
    system_stock INTEGER NOT NULL,
    physical_stock INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    notes TEXT
);

-- 6. Ringkasan Bulanan (Agregasi Cepat untuk Laporan)
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

export function getTursoClient() {
  const url = import.meta.env.VITE_TURSO_URL;
  const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('URL Database Turso atau Auth Token belum disetel di file .env (VITE_TURSO_URL dan VITE_TURSO_AUTH_TOKEN).');
  }

  let formattedUrl = url.trim();
  if (formattedUrl.startsWith('libsql://')) {
    formattedUrl = formattedUrl.replace('libsql://', 'https://');
  }

  return createClient({
    url: formattedUrl,
    authToken: authToken.trim(),
  });
}

/**
 * Tes koneksi ke Turso melalui deklarasi .env
 */
export async function testTursoConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const client = getTursoClient();
    const result = await client.execute('SELECT 1 as connected;');
    if (result.rows.length > 0) {
      return { success: true, message: 'Koneksi ke database Turso dari .env berhasil terhubung!' };
    }
    return { success: false, message: 'Gagal mendapatkan respon dari Turso.' };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Koneksi gagal: ${msg}` };
  }
}

/**
 * Sinkronisasi data lokal (Dexie) ke Turso (Cloud Backup) menggunakan kredensial .env
 */
export async function syncLocalToTurso(): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
  try {
    const client = getTursoClient();
    const products = await db.products.toArray();
    const sales = await db.sales.toArray();
    const saleItems = await db.sale_items.toArray();
    const expenses = await db.expenses.toArray();

    // Ensure schema exists
    const statements = TURSO_SCHEMA_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const sql of statements) {
      await client.execute(sql);
    }

    // Batch upsert products
    for (const p of products) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO products (id, barcode, name, category, unit, cost_price, selling_price, stock_quantity, min_stock_alert, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [p.id, p.barcode, p.name, p.category, p.unit || 'pcs', p.cost_price, p.selling_price, p.stock_quantity, p.min_stock_alert, p.is_active, p.created_at, p.updated_at],
      });
    }

    // Batch upsert sales
    for (const s of sales) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO sales (id, receipt_number, transaction_date, total_amount, total_cost, gross_profit, payment_method, cash_received, change_given, cashier_name, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [s.id, s.receipt_number, s.transaction_date, s.total_amount, s.total_cost, s.gross_profit, s.payment_method, s.cash_received, s.change_given, s.cashier_name, s.notes || null],
      });
    }

    // Batch upsert sale items
    for (const item of saleItems) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO sale_items (id, sale_id, product_id, product_name, quantity, unit, unit_cost, unit_price, subtotal, subtotal_cost, subtotal_profit)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [item.id, item.sale_id, item.product_id, item.product_name, item.quantity, item.unit || 'pcs', item.unit_cost, item.unit_price, item.subtotal, item.subtotal_cost, item.subtotal_profit],
      });
    }

    // Batch upsert expenses
    for (const e of expenses) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO expenses (id, expense_date, category, description, amount, receipt_photo_url)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [e.id, e.expense_date, e.category, e.description, e.amount, e.receipt_photo_url || null],
      });
    }

    return {
      success: true,
      message: 'Sinkronisasi berhasil! Data toko tersimpan aman di Turso Cloud.',
      counts: {
        produk: products.length,
        transaksi: sales.length,
        item: saleItems.length,
        pengeluaran: expenses.length,
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
