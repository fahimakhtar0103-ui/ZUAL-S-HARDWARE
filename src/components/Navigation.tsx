import React from 'react';
import { LayoutDashboard, BookOpen, Users, LineChart, Settings, ShoppingCart, CreditCard, Package, ReceiptText } from 'lucide-react';
import { NavigationProps } from '../types';

export function Sidebar({ currentView, navigateTo }: NavigationProps) {
  const mainNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'diaries', label: 'Diaries', icon: BookOpen },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'reports', label: 'Reports', icon: LineChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const quickLinks = [
    { label: 'Quick Sale', icon: ShoppingCart, onClick: () => navigateTo('new-entry') },
    { label: 'Payment History', icon: CreditCard, onClick: () => navigateTo('payment-history') },
    { label: 'Inventory Log', icon: Package, onClick: () => navigateTo('dashboard') },
    { label: 'Account Statement', icon: ReceiptText, onClick: () => navigateTo('dashboard') },
  ];

  return (
    <aside className="hidden md:flex flex-col w-80 bg-surface-container-lowest border-r border-outline-variant/30 h-screen sticky top-0 flex-shrink-0 z-50">
      <div className="p-12 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xl font-bold border border-outline-variant/20">
          H
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary tracking-tight">Hardware ERP</h1>
          <p className="text-xs font-medium text-on-surface-variant">Hardwire & Tools Hub</p>
        </div>
      </div>
      
      <div className="px-4 mt-2 hidden xl:block">
         <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold ml-4">Quick Links</span>
         <div className="flex flex-col gap-1 mt-2">
           {quickLinks.map((link) => (
             <button key={link.label} onClick={link.onClick} className="flex items-center gap-4 px-4 py-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors text-left text-sm font-medium">
                <link.icon size={18} />
                <span>{link.label}</span>
             </button>
           ))}
         </div>
      </div>

      <nav className="flex-1 px-4 flex flex-col gap-2 mt-8">
        {mainNav.map((item) => {
          const isActive = currentView === item.id || (item.id === 'reports' && currentView === 'recovery-dashboard');
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`flex items-center gap-4 px-4 py-3 rounded-full transition-all text-left ${
                isActive 
                  ? 'bg-secondary-fixed text-on-secondary-fixed font-bold' 
                  : 'text-on-surface-variant hover:bg-surface-container-high font-medium'
              } ${item.id === 'settings' ? 'mt-auto mb-12' : ''}`}
            >
              <item.icon size={22} className={isActive ? 'text-secondary' : ''} />
              <span className="text-[15px]">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  );
}

export function BottomNav({ currentView, navigateTo }: NavigationProps) {
  const mainNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'diaries', label: 'Diaries', icon: BookOpen },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'reports', label: 'Reports', icon: LineChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 rounded-t-xl bg-surface-container shadow-[0_-4px_6px_-1px_rgba(15,23,42,0.08)]">
      <div className="flex justify-around items-center h-16 px-2 pb-safe">
        {mainNav.map((item) => {
          const isActive = currentView === item.id || (item.id === 'reports' && currentView === 'recovery-dashboard');
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`flex flex-col items-center justify-center flex-1 max-w-[4.5rem] transition-all ${
                isActive 
                  ? 'bg-secondary-container text-on-secondary-container rounded-2xl md:rounded-full py-1.5 scale-95' 
                  : 'text-on-surface-variant opacity-70 hover:opacity-100 py-1.5'
              }`}
            >
              <item.icon size={isActive ? 20 : 24} className="mb-1" />
              <span className={`text-[10px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  );
}
