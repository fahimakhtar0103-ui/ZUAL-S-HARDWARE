export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Manager' | 'Staff';
  createdAt: string;
}

export interface Diary {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  diaryId: string;
  name: string;
  phone?: string;
  address?: string;
  creditLimit: number;
  createdAt: string;
}

export interface TransactionItem {
  material: string;
  qty: number;
  unit: string;
  rate: number;
}

export interface Transaction {
  id: string;
  customerId: string;
  recordedBy: string;
  totalAmount: number;
  date: string;
  items: TransactionItem[];
  createdAt: string;
}

export interface Payment {
  id: string;
  customerId: string;
  recordedBy: string;
  amount: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
  referenceNotes?: string;
  date: string;
  createdAt: string;
}

export interface CustomerBalance {
  customerId: string;
  customerName: string;
  creditLimit: number;
  lifetimePurchases: number;
  lifetimePayments: number;
  outstandingBalance: number;
  status: 'OVER_LIMIT' | 'DUE' | 'CLEARED';
}
