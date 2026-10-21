import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Boxes,
  Truck,
  ClipboardCheck,
  BarChart3,
  Settings,
  Wifi,
  WifiOff,
  Clock,
  Store,
} from 'lucide-react';
import { playKeyClick } from '../utils/sound';
import { formatDateIndo } from '../utils/format';
import { getStoreSettings } from '../db';

export type NavTab = 'kasir' | 'produk' | 'kulakan' | 'opname' | 'laporan' | 'pengaturan';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  cartCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  cartCount = 0,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  const settings = getStoreSettings();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
  }, []);

  const navItems = [
    { id: 'kasir' as NavTab, label: 'Kasir', icon: ShoppingCart, badge: cartCount },
    { id: 'produk' as NavTab, label: 'Katalog Produk', icon: Boxes },
    { id: 'kulakan' as NavTab, label: 'Kulakan & Biaya', icon: Truck },
    { id: 'opname' as NavTab, label: 'Stok Opname', icon: ClipboardCheck },
    { id: 'laporan' as NavTab, label: 'Laporan Keuangan', icon: BarChart3 },
    { id: 'pengaturan' as NavTab, label: 'Pengaturan & Turso', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-cream-300 shadow-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-forest flex items-center justify-center shadow-md">
              <Store className="w-7 h-7 text-amber" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-forest tracking-tight">
                  {settings.storeName}
                </span>
                <span className="text-[10px] uppercase font-extrabold tracking-wider bg-forest-surface text-forest px-2.5 py-0.5 rounded-full border border-forest/20">
                  Ritel POS
                </span>
              </div>
              <p className="text-xs text-ink-muted font-medium">Sistem Kasir & Pengendali Stok Toko</p>
            </div>
          </div>

          {/* Quick Info & System Status */}
          <div className="hidden xl:flex items-center gap-4 text-xs font-semibold text-ink-muted">
            <div className="flex items-center gap-1.5 bg-cream-100 px-3.5 py-2 rounded-xl border border-cream-200">
              <Clock className="w-4 h-4 text-forest" />
              <span>{formatDateIndo(currentDateTime)}</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                isOnline
                  ? 'bg-status-successBg text-status-successText'
                  : 'bg-status-warningBg text-status-warningText'
              }`}
              title={isOnline ? 'Terhubung ke Internet' : 'Mode Offline Aktif (Transaksi Tetap Tersimpan)'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Internet Aktif' : 'Offline (Lokal Dexie)'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-3 pt-1 no-scrollbar border-t border-cream-200">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  playKeyClick();
                  onSelectTab(item.id);
                }}
                className={`flex items-center gap-2.5 px-4 sm:px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all duration-150 min-h-[48px] ${
                  isActive
                    ? 'bg-amber text-forest shadow-sm ring-2 ring-forest/10 font-extrabold scale-[1.02]'
                    : 'text-ink-muted hover:text-ink hover:bg-cream-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-forest stroke-[2.5]' : 'text-ink-muted'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 text-xs px-2 py-0.5 rounded-full font-black ${
                      isActive ? 'bg-forest text-amber' : 'bg-amber text-forest'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
