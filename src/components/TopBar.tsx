import React from 'react';
import { ArrowLeft, Bell, Search } from 'lucide-react';
import { NavigationProps } from '../types';

interface TopBarProps extends NavigationProps {
  showBack?: boolean;
  context?: import('../types').AppContext;
}

export function TopBar({ currentView, navigateTo, showBack, context }: TopBarProps) {
  let title = 'Hardware ERP';
  if (currentView === 'new-entry') title = 'New Entry';
  if (currentView === 'whatsapp-reminder') title = 'Hardware ERP';
  if (currentView === 'customer-ledger') title = 'Hardware ERP';

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
    <header className="bg-surface md:bg-transparent sticky top-0 md:relative z-40 flex justify-between items-center w-full px-4 py-4 md:px-12 md:pt-12 md:pb-4 border-b border-surface-variant md:border-none">
      <div className="flex items-center gap-4">
        {showBack ? (
          <button 
            onClick={handleBack}
            className="w-10 h-10 flex flex-col items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden shrink-0 hidden md:flex items-center justify-center border border-outline-variant/20">
             <span className="text-lg font-bold text-primary">H</span>
          </div>
        )}
        <div className="flex items-center gap-3">
           <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => navigateTo('search')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface transition-colors">
          <Search size={20} />
        </button>
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-primary transition-colors">
          <Bell size={20} />
        </button>
      </div>
    </header>
  );
}
