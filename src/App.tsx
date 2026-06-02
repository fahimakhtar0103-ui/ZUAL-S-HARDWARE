import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
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
import AuthView from './views/AuthView';
import { Plus, Loader2 } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [context, setContext] = useState<AppContext>({});
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingPassword(true);
    setPasswordError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert('Password updated successfully');
      setRecoveryMode(false);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash.includes('type=recovery')) {
        setRecoveryMode(true);
      }
    };
    checkHash();

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[App] Initial getSession:', session?.user?.id, error);
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[App] Auth state changed:', event, session?.user?.id);
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') {
         setRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const navigateTo = (view: ViewState, newContext?: AppContext) => {
    setCurrentView(view);
    if (newContext) setContext(newContext);
  };

  if (loading) {
     return <div className="min-h-screen bg-background flex items-center justify-center text-primary"><Loader2 size={40} className="animate-spin" /></div>;
  }

  if (!session) {
     return <AuthView />;
  }

  if (recoveryMode) {
     return (
       <div className="min-h-screen bg-background flex items-center justify-center p-4">
         <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container overflow-hidden p-8">
            <h2 className="text-xl font-bold text-on-surface mb-6">Set New Password</h2>
            {passwordError && (
              <div className="bg-error/10 text-error p-4 rounded-lg mb-6 text-sm font-medium">
                 {passwordError}
              </div>
            )}
            <form onSubmit={handleUpdatePassword} className="space-y-4">
               <input 
                 type="password" 
                 placeholder="New Password" 
                 required
                 value={newPassword}
                 onChange={e => setNewPassword(e.target.value)}
                 className="w-full px-4 h-12 bg-surface-container border border-outline-variant rounded-lg focus:border-primary transition-colors"
               />
               <button 
                 type="submit" 
                 disabled={updatingPassword}
                 className="w-full bg-primary text-on-primary font-bold h-12 rounded-lg flex items-center justify-center disabled:opacity-70"
               >
                  {updatingPassword ? <Loader2 className="animate-spin" /> : 'Update Password'}
               </button>
            </form>
         </div>
       </div>
     );
  }

  // Define which views should omit the generic TopBar (they have custom headers or it's built-in)
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
         
         {/* Global FAB */}
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
