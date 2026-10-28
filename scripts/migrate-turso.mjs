import { createClient } from '@libsql/client';

const client = createClient({
  url: 'https://pos-anugerah-tokoanugerah.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI1NTgxNDksImlkIjoiMDFhMTVjODAtMDAwMS03MTNlLTg4NGQtZDdjNzRlNmI2YzYzIiwia2lkIjoiZzhvY3ZyeHdMcVZrWVh6ZWhEc1MzZVR1aEItMWNWaFN0bi1lSWZsWlF3USIsInJpZCI6ImEyN2VmMTQ2LWFlNGMtNDJjZi1iYTdjLWMyZTk5MjY5MGNjMyJ9.wLHB2RwaDO_oA2cvmvafcO21hyvWZjbCJam_YT8-JHJq6u_E5A1LatykDAA-hleLBWtrT-TePKc_Vq3FXAViDw'
});

async function main() {
  const drops = [
    'DROP TABLE IF EXISTS monthly_summaries',
    'DROP TABLE IF EXISTS stock_audits',
    'DROP TABLE IF EXISTS sale_items',
    'DROP TABLE IF EXISTS sales',
    'DROP TABLE IF EXISTS expenses',
    'DROP TABLE IF EXISTS products'
  ];

  for (const sql of drops) {
    console.log('Running:', sql);
    await client.execute(sql);
  }

  const creates = [
    `CREATE TABLE products (
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
    )`,

    `CREATE TABLE sales (
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
    )`,

    `CREATE TABLE sale_items (
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
    )`,

    `CREATE TABLE expenses (
      id TEXT PRIMARY KEY,
      expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      receipt_photo_url TEXT
    )`,

    `CREATE TABLE stock_audits (
      id TEXT PRIMARY KEY,
      audit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      product_id TEXT NOT NULL,
      product_name TEXT,
      barcode TEXT,
      system_stock INTEGER NOT NULL,
      physical_stock INTEGER NOT NULL,
      difference INTEGER NOT NULL,
      notes TEXT
    )`,

    `CREATE TABLE monthly_summaries (
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
    )`
  ];

  for (const sql of creates) {
    console.log('Creating table...');
    await client.execute(sql);
  }

  console.log('All Turso tables recreated successfully with correct nullable barcode and image columns!');
}

main().catch(console.error);
