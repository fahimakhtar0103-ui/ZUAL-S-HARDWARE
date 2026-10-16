import React from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { NavigationProps } from '../types';

interface TopBarProps extends NavigationProps {
  showBack?: boolean;
  context?: import('../types').AppContext;
}

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  diaries: 'Diaries',
  customers: 'Customers',
  reports: 'Reports',
  settings: 'Settings',
  'new-entry': 'New Sale',
  'record-payment': 'Record Payment',
  'payment-history': 'Payment History',
  'customer-ledger': 'Customer Ledger',
  'recovery-dashboard': 'Recovery & Dues',
  'whatsapp-reminder': 'WhatsApp Reminder',
  search: 'Search',
};

export function TopBar({ currentView, navigateTo, showBack, context }: TopBarProps) {
  const handleBack = () => {
    if (context?.customerId && ['new-entry', 'record-payment', 'whatsapp-reminder'].includes(currentView)) {
      navigateTo('customer-ledger', { customerId: context.customerId });
    } else if (context?.diaryId && currentView === 'customers') {
      navigateTo('diaries');
    } else {
      navigateTo('dashboard');
    }
  };

  return (
    <header className="bg-surface-container-lowest/95 md:bg-transparent backdrop-blur-md md:backdrop-blur-none sticky top-0 md:relative z-40 flex items-center justify-between gap-3 w-full min-w-0 px-4 py-3 md:px-12 md:pt-10 md:pb-4 border-b border-outline-variant/40 md:border-none">
      <div className="flex min-w-0 items-center gap-3">
        {showBack ? (
          <button type="button" onClick={handleBack} aria-label="Go back"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors">
            <ArrowLeft size={21} />
          </button>
        ) : (
          <div className="md:hidden w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-extrabold">Z</div>
        )}
        <h1 className="min-w-0 truncate text-lg sm:text-xl md:text-2xl font-extrabold text-on-surface tracking-tight">
          {viewTitles[currentView] ?? 'Zual Hardware'}
        </h1>
      </div>
      <button type="button" onClick={() => navigateTo('search')} aria-label="Search customers"
        className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl hover:bg-surface-container text-on-surface-variant transition-colors">
        <Search size={21} />
      </button>
    </header>
  );
}
