import React, { useState, useEffect } from 'react';
import { MapPin, Phone, CreditCard, Plus, MessageCircle, FileText, Loader2, WifiOff, Edit, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppContext } from '../types';
import { offlineSync, useOnlineStatus } from '../lib/offlineSync';

export default function CustomerLedgerView({ navigateTo, context }: { navigateTo: any, context?: AppContext }) {
  const { isOnline, pendingCount } = useOnlineStatus();
  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Edit & Delete state
  const [entryToDelete, setEntryToDelete] = useState<any>(null);
  const [entryToEdit, setEntryToEdit] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  
  const customerId = context?.customerId;

  const fetchData = async () => {
     if (!customerId) return;
     setLoading(true);
     try {
         const isNetworkError = (error: any) => {
             if (!navigator.onLine) return true;
             const msg = (error?.message || '').toLowerCase();
             return msg.includes('fetch') || msg.includes('network') || msg.includes('cors') || error?.status === 0;
         };

         let custResult: any = {}, txResult: any = {}, payResult: any = {}, balResult: any = {};
         try {
             const [cust, tx, pay, bal] = await Promise.all([
                 supabase.from('customers').select('*').eq('id', customerId).single(),
                 supabase.from('transactions').select('*').eq('customer_id', customerId).order('date', { ascending: false }),
                 supabase.from('payments').select('*').eq('customer_id', customerId).order('date', { ascending: false }),
                 supabase.from('view_customer_balances').select('outstanding_balance').eq('customer_id', customerId).single()
             ]);
             custResult = cust;
             txResult = tx;
             payResult = pay;
             balResult = bal;
         } catch (netErr) {
             console.warn("Using offline fallback in ledger view:", netErr);
             const pendingCust = offlineSync.getPendingOps().find(op => op.type === 'customer' && (op.payload.id === customerId || op.id === customerId));
             if (pendingCust) {
                 custResult.data = { id: customerId, name: pendingCust.customerName || pendingCust.payload.name, address: pendingCust.payload.address, phone: pendingCust.payload.phone, isPending: true };
             } else {
                 custResult.data = { id: customerId, name: 'Offline Profile' };
             }
         }

         if (custResult.data) setCustomer(custResult.data);
         if (txResult.data) setTransactions(txResult.data);
         if (payResult.data) setPayments(payResult.data);
         
         if (custResult.data && balResult.data) {
             setCustomer((prev: any) => ({...prev, outstandingBalance: Number(balResult.data.outstanding_balance) || 0}));
         }
     } catch (error: any) {
         console.error("Error fetching ledger data:", error);
         setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to fetch ledger data');
     } finally {
         setLoading(false);
     }
  };

  const confirmDelete = async () => {
     if (!entryToDelete) return;
     setIsSubmitting(true);
     setErrorMsg(null);
     
     try {
         let error;
         if (entryToDelete.type === 'debit') {
             const res = await supabase.from('transactions').delete().eq('id', entryToDelete.id);
             error = res.error;
         } else {
             const res = await supabase.from('payments').delete().eq('id', entryToDelete.id);
             error = res.error;
         }
         
         if (error) throw error;
         
         await fetchData();
         setEntryToDelete(null);
     } catch (e: any) {
         console.error("Error deleting entry:", e);
         setErrorMsg(e.message || e.details || 'Failed to delete entry');
     } finally {
         setIsSubmitting(false);
     }
  };

  const saveEdit = async () => {
    if (!entryToEdit) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
        let error;
        if (entryToEdit.type === 'debit') {
            const res = await supabase.from('transactions').update({
                date: entryToEdit.date,
                total_amount: Number(entryToEdit.total || 0),
                items: entryToEdit.items || []
            }).eq('id', entryToEdit.id);
            error = res.error;
        } else {
            const res = await supabase.from('payments').update({
                date: entryToEdit.date,
                amount: Number(entryToEdit.amount || 0),
                payment_mode: entryToEdit.mode || 'Cash',
                reference_notes: entryToEdit.notes || ''
            }).eq('id', entryToEdit.id);
            error = res.error;
        }

        if (error) throw error;
        
        await fetchData();
        setEntryToEdit(null);
    } catch(e: any) {
        console.error("Error updating entry:", e);
        setErrorMsg(e.message || e.details || 'Failed to update entry');
    } finally {
        setIsSubmitting(false);
    }
  };

  useEffect(() => {
     fetchData();
  }, [customerId, pendingCount]);

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

  // Combine tx, py and pending operations into timeline
  const timeline: any[] = [];
  transactions.forEach(t => {
      timeline.push({ type: 'debit', date: t.date, total: Number(t.total_amount), items: t.items, id: t.id, created_at: t.created_at || t.updated_at });
  });
  payments.forEach(p => {
      timeline.push({ type: 'credit', date: p.date, amount: Number(p.amount), mode: p.payment_mode, notes: p.reference_notes, id: p.id, created_at: p.created_at || p.updated_at });
  });

  // Pull pending operations for this specific customer
  const pendingOps = offlineSync.getPendingOps().filter(op => op.payload?.customer_id === customerId);
  pendingOps.forEach(op => {
      if (op.type === 'transaction') {
          timeline.push({
              type: 'debit',
              date: op.payload.date || new Date().toISOString().split('T')[0],
              total: Number(op.payload.total_amount),
              items: op.payload.items,
              id: op.id,
              created_at: new Date(op.timestamp).toISOString(),
              isPending: true
          });
      } else if (op.type === 'payment') {
          timeline.push({
              type: 'credit',
              date: op.payload.date || new Date().toISOString().split('T')[0],
              amount: Number(op.payload.amount),
              mode: op.payload.payment_mode || 'Cash',
              notes: op.payload.reference_notes,
              id: op.id,
              created_at: new Date(op.timestamp).toISOString(),
              isPending: true
          });
      }
  });

  timeline.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const totalPurchases = timeline
      .filter(item => item.type === 'debit')
      .reduce((acc, t) => acc + Number(t.total), 0);

  const totalCollections = timeline
      .filter(item => item.type === 'credit')
      .reduce((acc, p) => acc + Number(p.amount), 0);

  const outstandingBalance = totalPurchases - totalCollections;

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
                 <div key={row.id} className={`group hover:bg-surface-container-lowest transition-colors relative cursor-pointer ${row.isPending ? 'bg-amber-500/5' : ''}`}>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                   <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 items-start">
                       <div className="md:col-span-2 text-sm text-on-surface-variant pt-1 font-bold flex justify-between items-center">
                          <span>{new Date(row.date).toLocaleDateString('en-GB')}</span>
                          {!row.isPending && (
                            <div className="flex md:hidden items-center gap-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEntryToEdit({...row}); }}
                                    className="p-1.5 text-on-surface-variant hover:text-secondary hover:bg-secondary-container transition-colors rounded-full bg-surface-variant/20"
                                    title="Edit Entry"
                                >
                                    <Edit size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEntryToDelete(row); }}
                                    className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container transition-colors rounded-full bg-surface-variant/20"
                                    title="Delete Entry"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                          )}
                       </div>
                       <div className="md:col-span-5">
                          {row.type === 'debit' ? (
                              <div>
                                 <div className="flex items-center gap-2 text-[14px] font-bold text-on-surface mb-3 border-b border-outline-variant/20 pb-2">
                                     <FileText size={16} className="text-secondary" /> Purchase Invoice
                                     {row.isPending && (
                                       <span className="inline-flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse ml-2">
                                          <WifiOff size={10} /> Sync Pending
                                       </span>
                                     )}
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
                                     <CreditCard size={16} /> Payment Received ({row.mode || 'Cash'})
                                     {row.isPending && (
                                       <span className="inline-flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse ml-2">
                                          <WifiOff size={10} /> Sync Pending
                                       </span>
                                     )}
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
                       <div className="hidden md:flex flex-col md:col-span-2 text-right items-end pt-1 px-4 border-l border-outline-variant/30 relative">
                           <span className="font-label-numeric font-bold text-[16px] text-on-surface">
                                {row.runningBalance.toLocaleString()} {row.runningBalance < 0 ? 'CR' : 'DR'}
                           </span>
                           {!row.isPending && (
                            <div className="absolute top-1/2 -translate-y-1/2 right-1 flex items-center md:opacity-0 group-hover:opacity-100 transition-opacity bg-surface-container-lowest/80 backdrop-blur pl-2 rounded-l-xl">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEntryToEdit({...row}); }}
                                    className="p-1.5 text-on-surface-variant hover:text-secondary hover:bg-secondary-container transition-colors rounded-full"
                                    title="Edit Entry"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEntryToDelete(row); }}
                                    className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container transition-colors rounded-full ml-1"
                                    title="Delete Entry"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                           )}
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
      
      {/* Delete Entry Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden flex flex-col border border-outline-variant/30 p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-error tracking-tight mb-2">Delete Entry</h3>
                <p className="text-sm text-on-surface-variant mb-6 text-balance">
                    Are you sure you want to delete this {entryToDelete.type === 'debit' ? 'purchase' : 'payment'} entry from {new Date(entryToDelete.date).toLocaleDateString('en-GB')}? 
                    This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end mt-2">
                    <button onClick={() => setEntryToDelete(null)} className="px-5 py-2.5 rounded-xl font-bold text-on-surface bg-surface-container hover:bg-surface-variant transition-colors" disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button onClick={confirmDelete} className="px-5 py-2.5 rounded-xl font-bold text-on-error bg-error hover:bg-error/90 transition-colors shadow-sm flex items-center gap-2" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {entryToEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden flex flex-col border border-outline-variant/30" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-5 border-b border-outline-variant/30 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-on-surface tracking-tight">Edit {entryToEdit.type === 'debit' ? 'Purchase' : 'Payment'}</h3>
                    <button onClick={() => setEntryToEdit(null)} className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Date</label>
                        <input type="date" value={entryToEdit.date} onChange={e => setEntryToEdit({...entryToEdit, date: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium flex-1 text-on-surface" />
                    </div>

                    {entryToEdit.type === 'debit' ? (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Total Amount (₹)</label>
                                <input type="number" value={entryToEdit.total || ''} onChange={e => setEntryToEdit({...entryToEdit, total: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-label-numeric font-semibold text-lg text-primary" placeholder="0" />
                                {entryToEdit.items && entryToEdit.items.length > 0 && (
                                    <p className="text-xs text-on-surface-variant mt-2 font-medium">Note: Editing total amount here does not edit individual items. Consider deleting and recreating the entry if items changed.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Amount (₹)</label>
                                <input type="number" value={entryToEdit.amount || ''} onChange={e => setEntryToEdit({...entryToEdit, amount: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-label-numeric font-semibold text-lg text-green-600" placeholder="0" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Payment Mode</label>
                                <select value={entryToEdit.mode || 'Cash'} onChange={e => setEntryToEdit({...entryToEdit, mode: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary outline-none transition-all font-medium appearance-none text-on-surface">
                                    <option value="Cash">Cash</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">Notes / Reference (Optional)</label>
                                <input type="text" value={entryToEdit.notes || ''} onChange={e => setEntryToEdit({...entryToEdit, notes: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-surface-container border border-outline-variant/30 focus:border-primary outline-none transition-all font-medium placeholder:text-on-surface-variant/50 text-on-surface" placeholder="Cheque No, UPI Ref..." />
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface">
                    <button onClick={() => setEntryToEdit(null)} className="px-5 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container transition-colors" disabled={isSubmitting}>Cancel</button>
                    <button onClick={saveEdit} className="px-6 py-2.5 rounded-xl font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}

