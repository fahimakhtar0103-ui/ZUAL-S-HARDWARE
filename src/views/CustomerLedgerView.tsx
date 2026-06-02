import React, { useState, useEffect } from 'react';
import { MapPin, Phone, CreditCard, Plus, MessageCircle, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppContext } from '../types';

export default function CustomerLedgerView({ navigateTo, context }: { navigateTo: any, context?: AppContext }) {
  const [activeTab, setActiveTab] = useState('Ledger');
  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const customerId = context?.customerId;

  const fetchData = async () => {
     if (!customerId) return;
     setLoading(true);
     try {
         const [custResult, txResult, payResult, balResult] = await Promise.all([
             supabase.from('customers').select('*').eq('id', customerId).single(),
             supabase.from('transactions').select('*').eq('customer_id', customerId).order('date', { ascending: false }),
             supabase.from('payments').select('*').eq('customer_id', customerId).order('date', { ascending: false }),
             supabase.from('view_customer_balances').select('outstanding_balance').eq('customer_id', customerId).single()
         ]);

         if (custResult.data) setCustomer(custResult.data);
         if (txResult.data) setTransactions(txResult.data);
         if (payResult.data) setPayments(payResult.data);
         
         // Outstanding balance comes from the view (balResult), but we can also just compute it from txResult and payResult
         if (custResult.data && balResult.data) {
             setCustomer(prev => ({...prev, outstandingBalance: Number(balResult.data.outstanding_balance) || 0}));
         }
     } catch (error: any) {
         console.error("Error fetching ledger data:", error);
         setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to fetch ledger data');
     } finally {
         setLoading(false);
     }
  };

  useEffect(() => {
     fetchData();
  }, [customerId]);

  if (!customerId) {
      return <div className="flex-1 flex items-center justify-center pt-20 text-on-surface-variant font-medium">Customer not selected.</div>;
  }

  if (loading) {
      return <div className="flex-1 flex items-center justify-center pt-20 text-on-surface-variant font-medium gap-2"><Loader2 className="animate-spin" size={20}/> Loading ledger...</div>;
  }

  if (errorMsg) {
      return (
          <div className="flex-1 flex items-center justify-center pt-20 px-4">
            <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20 max-w-lg w-full">
              <p className="font-bold mb-1">Error:</p>
              <p>{errorMsg}</p>
            </div>
          </div>
      );
  }

  const totalPurchases = transactions.reduce((acc, t) => acc + Number(t.total_amount), 0);
  const totalCollections = payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const outstandingBalance = totalPurchases - totalCollections;

  // Combine tx and py into timeline
  const timeline: any[] = [];
  transactions.forEach(t => {
      timeline.push({ type: 'debit', date: t.date, total: Number(t.total_amount), items: t.items, id: t.id, created_at: t.created_at || t.updated_at });
  });
  payments.forEach(p => {
      timeline.push({ type: 'credit', date: p.date, amount: Number(p.amount), mode: p.payment_mode, notes: p.reference_notes, id: p.id, created_at: p.created_at || p.updated_at });
  });

  timeline.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  let runningBalance = 0;
  const ledgerRows = timeline.map(entry => {
      if (entry.type === 'debit') {
          runningBalance += entry.total;
      } else {
          runningBalance -= entry.amount;
      }
      return { ...entry, runningBalance };
  });

  // Reverse so newest is top
  ledgerRows.reverse();

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 custom-scrollbar bg-surface-container-lowest h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        {customer && (
        <div className="bg-surface-container rounded-xl p-6 shadow-sm border border-surface-variant">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-2xl font-bold">
                 {customer.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                 <h2 className="text-[20px] font-bold text-on-surface tracking-tight">{customer.name}</h2>
                 <p className="text-on-surface-variant text-sm mt-1 flex items-center gap-1.5 font-medium">
                   <MapPin size={16} /> {customer.address || 'N/A'}
                 </p>
                 <p className="text-on-surface-variant text-sm flex items-center gap-1.5 mt-1 font-medium">
                   <Phone size={16} /> {customer.phone || 'N/A'}
                 </p>
              </div>
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <div className="flex-1 md:flex-none bg-surface p-4 rounded-lg border border-outline-variant/40">
                 <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Total Purchases</p>
                 <p className="font-label-numeric text-base text-on-surface mt-1 font-bold">₹ {totalPurchases.toLocaleString()}</p>
              </div>
              <div className={`flex-1 md:flex-none p-4 rounded-lg border ${outstandingBalance > (customer.credit_limit || 0) && (customer.credit_limit || 0) > 0 ? 'bg-error-container/30 border-error/20' : 'bg-surface border-outline-variant/40'}`}>
                 <p className={`text-[10px] uppercase tracking-wider font-bold ${outstandingBalance > (customer.credit_limit || 0) && (customer.credit_limit || 0) > 0 ? 'text-on-error-container' : 'text-on-surface-variant'}`}>Outstanding Balance</p>
                 <p className={`font-label-numeric text-xl font-bold mt-1 ${outstandingBalance > (customer.credit_limit || 0) && (customer.credit_limit || 0) > 0 ? 'text-error' : outstandingBalance > 0 ? 'text-primary' : 'text-green-600'}`}>
                    ₹ {outstandingBalance.toLocaleString()} {outstandingBalance < 0 ? '(Cr)' : ''}
                 </p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex flex-wrap gap-4">
             <button onClick={() => navigateTo('record-payment', { customerId: customer.id })} className="flex-1 md:flex-none h-12 px-6 bg-primary text-on-primary rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors shadow-sm">
               <CreditCard size={18} /> Record Payment
             </button>
             <button onClick={() => navigateTo('new-entry', { customerId: customer.id })} className="flex-1 md:flex-none h-12 px-6 bg-secondary-container text-on-secondary-container rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary hover:text-on-secondary transition-colors shadow-sm">
               <Plus size={18} /> Add Purchase
             </button>
             <button onClick={() => navigateTo('whatsapp-reminder', { customerId: customer.id })} className="flex-1 md:flex-none h-12 px-6 bg-[#25D366]/10 text-[#075E54] border border-[#25D366]/40 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#25D366]/20 transition-colors">
               <MessageCircle size={18} /> WhatsApp Reminder
             </button>
          </div>
        </div>
        )}

        <div className="border-b border-outline-variant flex gap-8 px-2 mt-4">
           {['Ledger', 'History'].map(tab => (
             <button 
               key={tab} 
               onClick={() => setActiveTab(tab)}
               className={`pb-3 border-b-2 text-[15px] px-2 transition-colors ${activeTab === tab ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant font-medium hover:text-on-surface'}`}
             >
               {tab}
             </button>
           ))}
        </div>

        <div className="bg-surface rounded-xl shadow-sm border border-surface-variant/70 overflow-hidden mb-12">
           <div className="grid grid-cols-12 gap-4 p-4 border-b border-surface-variant/70 bg-surface-container-low text-[10px] text-on-surface-variant uppercase tracking-wider font-bold hidden md:grid">
              <div className="col-span-2">Date</div>
              <div className="col-span-5">Details</div>
              <div className="col-span-3 text-right">Debit(₹) / Credit(₹)</div>
              <div className="col-span-2 text-right">Running(₹)</div>
           </div>

           <div className="divide-y divide-surface-variant/40">
             {ledgerRows.length === 0 ? (
                 <div className="p-8 text-center text-on-surface-variant font-medium">No ledger entries found.</div>
             ) : (
                ledgerRows.map(row => (
                 <div key={row.id} className="group hover:bg-surface-container-lowest transition-colors relative cursor-pointer">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                   <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 items-start">
                       <div className="md:col-span-2 text-sm text-on-surface-variant pt-1 font-bold">{new Date(row.date).toLocaleDateString()}</div>
                       <div className="md:col-span-5">
                          {row.type === 'debit' ? (
                              <div>
                                 <div className="flex items-center gap-2 text-[14px] font-bold text-on-surface mb-3 border-b border-outline-variant/20 pb-2">
                                     <FileText size={16} className="text-secondary" /> Purchase Invoice
                                 </div>
                                 <div className="space-y-3">
                                     {(row.items || []).map((item: any, idx: number) => (
                                       <div key={idx} className="flex justify-between items-center text-sm">
                                         <div className="font-semibold text-on-surface line-clamp-1 flex-1 pr-2">{item.material}</div>
                                         <div className="text-right font-label-numeric text-on-surface-variant font-medium text-xs whitespace-nowrap">{item.qty} {item.unit} × {item.rate}</div>
                                         <div className="text-right font-label-numeric text-on-surface font-semibold w-20 shrink-0">{(item.qty * item.rate).toLocaleString()}</div>
                                       </div>
                                     ))}
                                     <div className="flex justify-between md:hidden pt-3 border-t border-outline-variant/20 mt-3">
                                        <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Debit Amount</div>
                                        <div className="font-label-numeric font-bold text-on-surface text-lg text-right">{row.total.toLocaleString()}</div>
                                     </div>
                                 </div>
                              </div>
                          ) : (
                              <div>
                                 <div className="flex items-center gap-2 text-[14px] font-bold text-green-700">
                                     <CreditCard size={16} /> Payment Received ({row.mode})
                                 </div>
                                 {row.notes && <p className="text-xs text-on-surface-variant mt-1">{row.notes}</p>}
                                 <div className="flex justify-between md:hidden pt-3 border-t border-outline-variant/20 mt-3">
                                        <div className="text-[10px] text-green-700 uppercase font-bold tracking-widest mt-1">Credit Amount</div>
                                        <div className="font-label-numeric font-bold text-green-700 text-lg text-right">- {row.amount.toLocaleString()}</div>
                                 </div>
                              </div>
                          )}
                       </div>
                       
                       <div className="hidden md:block md:col-span-3 text-right font-label-numeric font-bold text-[15px] pt-1">
                           {row.type === 'debit' ? (
                               <span className="text-on-surface">{row.total.toLocaleString()} <span className="text-on-surface-variant text-[10px] ml-1">DR</span></span>
                           ) : (
                               <span className="text-green-600">- {row.amount.toLocaleString()} <span className="text-green-600 text-[10px] ml-1">CR</span></span>
                           )}
                       </div>
                       <div className="hidden md:block md:col-span-2 text-right font-label-numeric font-bold text-[16px] text-on-surface pt-1 px-4 border-l border-outline-variant/30">
                           {row.runningBalance.toLocaleString()} {row.runningBalance < 0 ? 'CR' : 'DR'}
                       </div>
                    </div>
                 </div>
                ))
             )}
           </div>

           <div className="bg-surface-container border-t border-outline-variant/30 p-6 md:p-8 sticky bottom-0 backdrop-blur-sm z-10">
             <div className="flex justify-between items-center">
               <div className="text-xl md:text-2xl text-on-surface font-bold tracking-tight">Closing Balance</div>
               <div className={`font-label-numeric text-3xl md:text-[32px] font-bold tracking-tight ${outstandingBalance > (customer?.credit_limit || 0) && (customer?.credit_limit || 0) > 0 ? 'text-error' : outstandingBalance > 0 ? 'text-primary' : 'text-green-600'}`}>
                  ₹ {outstandingBalance.toLocaleString()}
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}

