import React, { useState } from 'react';
import { Sidebar, BottomNav } from './components/Navigation';
import { TopBar } from './components/TopBar';
import { ViewState, AppContext } from './types';
import DashboardView from './views/DashboardView';
import DiariesView from './views/DiariesView';
import ReportsView from './views/ReportsView';
import RecoveryDashboardView from './views/RecoveryDashboardView';
import SettingsView from './views/SettingsView';
import CustomersView from './views/CustomersView';
import CustomerLedgerView from './views/CustomerLedgerView';
import NewEntryView from './views/NewEntryView';
import WhatsAppReminderView from './views/WhatsAppReminderView';
import RecordPaymentView from './views/RecordPaymentView';
import SearchView from './views/SearchView';
import PaymentHistoryView from './views/PaymentHistoryView';
import { Plus } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [context, setContext] = useState<AppContext>({});

  const navigateTo = (view: ViewState, newContext?: AppContext) => {
    setCurrentView(view);
    if (newContext) setContext(newContext);
  };

  const showTopBar = !['settings', 'reports', 'customers', 'recovery-dashboard', 'diaries', 'search'].includes(currentView);

  return (
    <div className="bg-background text-on-background font-body-md antialiased min-h-screen flex flex-col md:flex-row">
      <Sidebar currentView={currentView} navigateTo={navigateTo} />
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        {showTopBar && (
          <TopBar 
            currentView={currentView} 
            navigateTo={navigateTo} 
            context={context}
            showBack={['new-entry', 'whatsapp-reminder', 'customer-ledger', 'record-payment', 'payment-history'].includes(currentView)} 
          />
        )}
        <div className="flex-1 overflow-y-auto hide-scrollbar relative">
          {currentView === 'dashboard' && <DashboardView navigateTo={navigateTo} />}
          {currentView === 'diaries' && <DiariesView navigateTo={navigateTo} />}
          {currentView === 'customers' && <CustomersView navigateTo={navigateTo} />}
          {currentView === 'reports' && <ReportsView navigateTo={navigateTo} />}
          {currentView === 'settings' && <SettingsView />}
          {currentView === 'recovery-dashboard' && <RecoveryDashboardView navigateTo={navigateTo} />}
          {currentView === 'customer-ledger' && <CustomerLedgerView navigateTo={navigateTo} context={context} />}
          {currentView === 'new-entry' && <NewEntryView navigateTo={navigateTo} context={context} />}
          {currentView === 'whatsapp-reminder' && <WhatsAppReminderView navigateTo={navigateTo} context={context} />}
          {currentView === 'record-payment' && <RecordPaymentView navigateTo={navigateTo} context={context} />}
          {currentView === 'search' && <SearchView navigateTo={navigateTo} />}
          {currentView === 'payment-history' && <PaymentHistoryView navigateTo={navigateTo} />}
          <div className="h-24 md:h-12"></div>
        </div>
        <BottomNav currentView={currentView} navigateTo={navigateTo} />
        {['dashboard', 'diaries', 'customers'].includes(currentView) && (
          <button 
            onClick={() => navigateTo('new-entry')}
            className="fixed bottom-24 md:bottom-8 right-6 md:right-8 w-14 h-14 bg-primary text-on-primary rounded-2xl shadow-lg flex items-center justify-center hover:-translate-y-1 hover:shadow-xl active:scale-95 transition-all z-50 group border border-outline-variant/30"
          >
            <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300 stroke-[2.5]" />
          </button>
        )}  
      </main>
    </div>
  );
}
