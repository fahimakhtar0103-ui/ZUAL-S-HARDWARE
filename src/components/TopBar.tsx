import React from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { NavigationProps } from '../types';

interface TopBarProps extends NavigationProps {
  showBack?: boolean;
  context?: import('../types').AppContext;
}

const viewTitles: Record<string, string> = {
  dashboard: 'Overview',
  diaries: 'Diaries',
  customers: 'Customers',
  reports: 'Analytics',
  settings: 'Settings',
  'new-entry': 'New sale',
  'record-payment': 'Record payment',
  'payment-history': 'Payment history',
  'customer-ledger': 'Customer ledger',
  'recovery-dashboard': 'Recovery',
  'whatsapp-reminder': 'WhatsApp reminder',
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
    <header className="zl-workspace-header">
      <div className="zl-workspace-header-left">
        {showBack && (
          <button type="button" className="zl-back-button" aria-label="Back" onClick={handleBack}>
            <ArrowLeft size={19} />
          </button>
        )}
        <div className="zl-workspace-crumb">
          <span className="zl-workspace-eyebrow"><span className="hidden md:inline">ZUAL HARDWARE / </span>WORKSPACE</span>
          <span className="zl-workspace-title">{viewTitles[currentView] ?? 'Overview'}</span>
        </div>
      </div>
      <div className="zl-workspace-header-right">
        <button type="button" onClick={() => navigateTo('search')} aria-label="Search records" className="zl-search-button">
          <Search size={19} />
        </button>
        <div className="zl-user-avatar" aria-label="Zual Hardware workspace">ZH</div>
      </div>
    </header>
  );
}
