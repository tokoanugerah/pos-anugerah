import { useState, useEffect, useCallback } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { ProductsPage } from './pages/ProductsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { StockAuditPage } from './pages/StockAuditPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { initializeDatabase, db } from './db';
import type { Product } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadProducts = useCallback(async () => {
    try {
      const prods = await db.products.toArray();
      setProducts(prods);
    } catch (e) {
      console.error('Gagal memuat produk dari IndexedDB:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await initializeDatabase();
      await loadProducts();
    };
    init();
  }, [loadProducts]);

  return (
    <div className="min-h-screen bg-canvas flex flex-col lg:flex-row font-sans selection:bg-amber selection:text-forest">
      {/* Left Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
      />

      {/* Main Content Area - Maximizing Full Desktop Space */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {isLoading ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-2xl bg-forest flex items-center justify-center animate-spin mb-4">
              <div className="w-4 h-4 rounded-full bg-amber" />
            </div>
            <p className="font-bold text-forest text-lg">Memuat Sistem Kasir Anugerah Store...</p>
            <p className="text-xs text-ink-muted mt-1">Menginisialisasi basis data offline Dexie.js</p>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardPage
                products={products}
                onNavigateToPos={() => setCurrentTab('kasir')}
                onNavigateToProducts={() => setCurrentTab('produk')}
              />
            )}

            {currentTab === 'kasir' && (
              <PosPage
                products={products}
                onProductStockUpdate={loadProducts}
              />
            )}

            {currentTab === 'produk' && (
              <ProductsPage
                products={products}
                onRefresh={loadProducts}
              />
            )}

            {currentTab === 'kulakan' && (
              <ExpensesPage
                products={products}
                onRefresh={loadProducts}
              />
            )}

            {currentTab === 'opname' && (
              <StockAuditPage
                products={products}
                onRefresh={loadProducts}
              />
            )}

            {currentTab === 'laporan' && (
              <ReportsPage />
            )}

            {currentTab === 'pengaturan' && (
              <SettingsPage
                onRefreshAll={loadProducts}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
