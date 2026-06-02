export type ViewState = 
  | 'dashboard' 
  | 'diaries' 
  | 'customers' 
  | 'reports' 
  | 'settings' 
  | 'new-entry' 
  | 'customer-ledger' 
  | 'whatsapp-reminder' 
  | 'recovery-dashboard'
  | 'record-payment'
  | 'search'
  | 'payment-history';

export interface AppContext {
  customerId?: string;
  diaryId?: string;
}

export interface NavigationProps {
  currentView: ViewState;
  navigateTo: (view: ViewState, context?: AppContext) => void;
}
