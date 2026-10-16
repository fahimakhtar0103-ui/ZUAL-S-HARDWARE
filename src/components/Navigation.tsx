import React from 'react';
import { LayoutDashboard, BookOpen, Users, LineChart, Settings, ShoppingCart, CreditCard, BadgeDollarSign } from 'lucide-react';
import { NavigationProps } from '../types';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { id: 'diaries', label: 'Diaries', short: 'Diaries', icon: BookOpen },
  { id: 'customers', label: 'Customers', short: 'Customers', icon: Users },
  { id: 'reports', label: 'Reports', short: 'Reports', icon: LineChart },
  { id: 'recovery-dashboard', label: 'Recovery', short: 'Dues', icon: BadgeDollarSign },
  { id: 'settings', label: 'Settings', short: 'Settings', icon: Settings },
] as const;

export function Sidebar({ currentView, navigateTo }: NavigationProps) {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-surface-container-lowest border-r border-outline-variant/30 h-[100dvh] sticky top-0 flex-shrink-0 z-50">
      <div className="px-6 pt-8 pb-6 flex items-center gap-3">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-primary text-on-primary flex items-center justify-center text-xl font-black">Z</div>
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold leading-tight text-on-surface tracking-tight">Zual Hardware</h1>
          <p className="text-xs text-on-surface-variant mt-1">Business workspace</p>
        </div>
      </div>
      <div className="px-4 pb-6 flex flex-col gap-2">
        <button type="button" onClick={() => navigateTo('new-entry')}
          className="w-full min-h-11 bg-primary text-on-primary rounded-xl flex items-center gap-3 px-4 text-sm font-bold hover:bg-primary-container transition-colors">
          <ShoppingCart size={18} /> New Sale
        </button>
        <button type="button" onClick={() => navigateTo('record-payment')}
          className="w-full min-h-11 bg-surface-container rounded-xl flex items-center gap-3 px-4 text-sm font-semibold text-on-surface hover:bg-surface-container-high transition-colors">
          <CreditCard size={18} /> Record Payment
        </button>
      </div>
      <p className="px-7 pb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Workspace</p>
      <nav className="flex-1 overflow-y-auto px-3 pb-5 flex flex-col gap-1" aria-label="Primary navigation">
        {navigation.map(item => {
          const active = currentView === item.id;
          return (
            <button key={item.id} type="button" onClick={() => navigateTo(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-11 w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-left text-sm ${active ? 'bg-secondary-fixed text-on-secondary-fixed font-bold' : 'text-on-surface-variant hover:bg-surface-container font-medium'}`}>
              <item.icon size={19} className={active ? 'text-secondary' : ''} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function BottomNav({ currentView, navigateTo }: NavigationProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 border-t border-outline-variant/60 shadow-[0_-4px_25px_rgba(20,28,38,0.08)] backdrop-blur-md" aria-label="Mobile navigation">
      <div className="grid grid-cols-6 gap-0.5 px-1.5 pt-2 pb-safe">
        {navigation.map(item => {
          const active = currentView === item.id;
          return (
            <button key={item.id} type="button" onClick={() => navigateTo(item.id)}
              aria-label={item.label} aria-current={active ? 'page' : undefined}
              className={`min-w-0 min-h-[52px] flex flex-col items-center justify-center rounded-xl gap-1 transition-colors ${active ? 'bg-secondary-fixed text-on-secondary-fixed' : 'text-on-surface-variant hover:bg-surface-container'}`}>
              <item.icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
              <span className={`text-[9px] sm:text-[10px] whitespace-nowrap leading-tight ${active ? 'font-extrabold' : 'font-medium'}`}>{item.short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
