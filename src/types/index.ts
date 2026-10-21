export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;             // Satuan unit: 'pcs', 'kg', 'liter', 'bungkus', 'botol', dll.
  cost_price: number;       // HPP / Modal Beli
  selling_price: number;    // Harga Jual
  stock_quantity: number;   // Stok Tersedia
  min_stock_alert: number;  // Batas Peringatan Stok Menipis
  is_active: number;        // 1 = Aktif, 0 = Non-aktif
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'TUNAI' | 'QRIS' | 'TRANSFER';

export interface Sale {
  id: string;
  receipt_number: string;   // Format: 'NOTA-AS-YYYYMMDD-XXXX'
  transaction_date: string;
  total_amount: number;     // Total Penjualan
  total_cost: number;       // Total Modal (HPP)
  gross_profit: number;     // Laba Kotor (total_amount - total_cost)
  payment_method: PaymentMethod;
  cash_received: number;    // Uang Tunai Diterima
  change_given: number;     // Kembalian
  cashier_name: string;
  notes?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit?: string;            // Satuan unit produk
  unit_cost: number;        // Modal Satuan
  unit_price: number;       // Harga Jual Satuan
  subtotal: number;
  subtotal_cost: number;
  subtotal_profit: number;
}

export type ExpenseCategory = 'KULAKAN_STOK' | 'LISTRIK' | 'OPERASIONAL' | 'GAJI' | 'LAINNYA';

export interface Expense {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  receipt_photo_url?: string;
}

export interface StockAudit {
  id: string;
  audit_date: string;
  product_id: string;
  product_name: string;
  barcode: string;
  system_stock: number;
  physical_stock: number;
  difference: number;       // physical_stock - system_stock
  notes?: string;
}

export interface MonthlySummary {
  month_year: string;       // Format: 'YYYY-MM'
  total_sales_revenue: number;
  total_cogs: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  total_transactions: number;
  cash_revenue: number;
  qris_revenue: number;
  transfer_revenue: number;
  updated_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  receiptFooter: string;
  cashierName: string;
  lastBackupDate?: string;
}
