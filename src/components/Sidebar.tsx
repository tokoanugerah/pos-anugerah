import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Truck,
  ClipboardCheck,
  BarChart3,
  Settings,
  Wifi,
  WifiOff,
  User,
  Menu,
  X,
} from 'lucide-react';
import { playKeyClick } from '../utils/sound';
import { getStoreSettings } from '../db';

export type NavTab = 'dashboard' | 'kasir' | 'produk' | 'kulakan' | 'opname' | 'laporan' | 'pengaturan';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  cartCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  cartCount = 0,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const settings = getStoreSettings();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'kasir' as NavTab, label: 'Kasir', icon: ShoppingCart, badge: cartCount },
    { id: 'produk' as NavTab, label: 'Katalog Produk', icon: Boxes },
    { id: 'kulakan' as NavTab, label: 'Kulakan & Biaya', icon: Truck },
    { id: 'opname' as NavTab, label: 'Stok Opname', icon: ClipboardCheck },
    { id: 'laporan' as NavTab, label: 'Laporan Keuangan', icon: BarChart3 },
    { id: 'pengaturan' as NavTab, label: 'Pengaturan', icon: Settings },
  ];

  const handleNavClick = (tab: NavTab) => {
    playKeyClick();
    onSelectTab(tab);
    setIsMobileOpen(false);
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-5 bg-card border-r border-cream-300">
      {/* Top Brand Logo */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-12 h-12 rounded-2xl bg-forest overflow-hidden flex items-center justify-center shadow-md flex-shrink-0 border border-amber/40">
            <img
              src="/brand/logo-b1.jpg"
              alt="Logo Anugerah Store"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-xl font-black text-forest tracking-tight truncate">
              {settings.storeName}
            </h1>
            <span className="text-[10px] uppercase font-extrabold tracking-wider bg-forest-surface text-forest px-2 py-0.5 rounded-full border border-forest/15">
              Ritel POS
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-150 min-h-[50px] group ${
                  isActive
                    ? 'bg-amber text-forest shadow-sm ring-1 ring-forest/15 font-extrabold'
                    : 'text-ink-muted hover:text-ink hover:bg-cream-100'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-forest stroke-[2.5]' : 'text-ink-subtle'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
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

      {/* Bottom Profile & Status Card */}
      <div className="pt-4 border-t border-cream-200 space-y-3">
        <div className="p-3 bg-cream-50 rounded-2xl border border-cream-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-surface flex items-center justify-center text-forest flex-shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-ink truncate">{settings.cashierName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-status-successText' : 'bg-status-warningText'
                }`}
              />
              <span className="text-[11px] text-ink-muted">
                {isOnline ? 'Online (Lokal Dexie)' : 'Mode Offline'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-1 text-[11px] text-ink-subtle flex items-center justify-between">
          <span>Sistem POS v2.0</span>
          {isOnline ? (
            <span title="Terhubung"><Wifi className="w-3.5 h-3.5 text-status-successText" /></span>
          ) : (
            <span title="Offline"><WifiOff className="w-3.5 h-3.5 text-status-warningText" /></span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-card border-b border-cream-300 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-forest overflow-hidden flex items-center justify-center border border-amber/30">
            <img
              src="/brand/logo-b1.jpg"
              alt="Logo Anugerah Store"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-extrabold text-forest text-lg">{settings.storeName}</span>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-xl bg-cream-100 text-ink"
        >
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-forest-dark/60 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] h-full shadow-modal z-10 animate-in slide-in-from-left">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Fixed Left Sidebar (Width 260px) */}
      <aside className="hidden lg:block w-64 xl:w-72 flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>
    </>
  );
};
