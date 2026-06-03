import React, { useState, useEffect } from 'react';
import { History, Search, Download, Filter, FileText, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Payment } from '../db/schema';

export default function PaymentHistoryView({ navigateTo }: { navigateTo: any }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'THIS_MONTH'>('ALL');

  const convertToCSV = (arr: any[]) => {
      if (arr.length === 0) return '';
      const csv = [
          ['Receipt ID', 'Date', 'Customer', 'Mode', 'Amount (₹)', 'Notes'].join(','),
          ...arr.map(row => [
              row.id || '',
              row.date || '',
              row.customerName || 'Unknown',
              row.payment_mode || 'Cash',
              row.amount || 0,
              row.reference_notes || ''
          ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      return csv;
  };

  const handleExportPayments = () => {
      if (filteredPayments.length === 0) {
          alert('No payments to export');
          return;
      }
      const csvContent = convertToCSV(filteredPayments);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `payment_details_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    const fetchPayments = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            // Fetch payments and join customer names
            const { data, error } = await supabase
                .from('payments')
                .select(`
                    *,
                    customers (
                        name
                    )
                `)
                .order('date', { ascending: false });

            if (error) throw error;
            
            const formattedData = data.map(p => ({
                ...p,
                customerName: p.customers?.name || 'Unknown'
            }));
            
            setPayments(formattedData);
        } catch (error: any) {
            console.error("Error fetching payments:", error);
            setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to fetch payments');
        } finally {
            setLoading(false);
        }
    };
    
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter(p => {
      const matchesSearch = p.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.reference_notes?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (dateFilter === 'ALL') return true;
      const paymentDate = new Date(p.date).toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateFilter === 'TODAY') return paymentDate === todayStr;
      if (dateFilter === 'THIS_MONTH') {
          const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
          return paymentDate.startsWith(currentMonth);
      }
      return true;
  });

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 md:p-12 space-y-6 flex flex-col h-full">
      {errorMsg && (
        <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20 mb-2">
          <p className="font-bold mb-1">Error Loading Data:</p>
          <p>{errorMsg}</p>
        </div>
      )}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl md:text-[42px] font-bold text-primary tracking-tight flex items-center gap-3">
             <History size={36} className="text-secondary" /> Payment History
          </h1>
          <p className="text-[15px] font-medium text-on-surface-variant mt-2">Track all incoming payments and collections.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button onClick={handleExportPayments} className="h-12 px-6 rounded-xl bg-surface border border-outline-variant/40 text-[14px] font-bold text-on-surface flex items-center gap-2 hover:bg-surface-container-highest transition-colors shadow-sm">
              <Download size={18} /> Export List
           </button>
        </div>
      </header>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 flex p-2 gap-2 shrink-0">
         <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer or reference..." 
              className="w-full h-12 pl-11 pr-4 bg-transparent focus:outline-none text-[15px] font-bold text-on-surface placeholder:font-medium placeholder:text-on-surface-variant/70"
            />
         </div>
         <div className="w-px bg-outline-variant/30 hidden md:block my-2"></div>
         <button 
           onClick={() => setDateFilter(prev => {
               if (prev === 'ALL') return 'TODAY';
               if (prev === 'TODAY') return 'THIS_MONTH';
               return 'ALL';
           })}
           className="md:flex hidden items-center gap-2 px-6 h-12 text-[14px] font-bold text-on-surface hover:bg-surface-container rounded-lg transition-colors border border-outline-variant/30"
         >
            <Filter size={18} className="text-secondary" /> Date Range: <span className="font-semibold text-primary">
               {dateFilter === 'ALL' ? 'All Time' : dateFilter === 'TODAY' ? 'Today' : 'This Month'}
            </span>
         </button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden flex-1 flex flex-col min-h-0">
         <div className="overflow-x-auto flex-1 h-full">
            <table className="w-full text-left border-collapse">
               <thead className="sticky top-0 bg-surface-container/90 backdrop-blur-sm z-10 border-b border-surface-variant/70">
                  <tr>
                     <th className="p-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Receipt ID</th>
                     <th className="p-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Date</th>
                     <th className="p-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest min-w-[200px]">Customer</th>
                     <th className="p-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap text-center">Mode</th>
                     <th className="p-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap text-right">Amount (₹)</th>
                     <th className="p-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap text-center">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-surface-variant/50">
                  {loading ? (
                    <tr>
                       <td colSpan={6} className="p-8 text-center text-on-surface-variant flex items-center justify-center gap-3">
                         Loading payments...
                       </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                       <td colSpan={6} className="p-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                             <History size={48} className="text-on-surface-variant/30" />
                             <p className="text-on-surface-variant font-bold text-lg">No payments found</p>
                          </div>
                       </td>
                    </tr>
                  ) : (
                      filteredPayments.map((p, i) => (
                        <tr key={p.id || i} className="hover:bg-surface-container-low transition-colors group">
                           <td className="p-5">
                              <div className="text-[13px] font-bold font-mono text-primary flex items-center gap-1.5 whitespace-nowrap group-hover:text-secondary transition-colors cursor-pointer">
                                 <FileText size={14} /> {(p.id || '').substring(0, 8)}...
                              </div>
                              <div className="text-[11px] text-on-surface-variant mt-1 font-medium">{p.reference_notes || 'No notes'}</div>
                           </td>
                           <td className="p-5 whitespace-nowrap">
                              <div className="flex flex-col">
                                 <span className="text-[14px] font-bold text-on-surface tracking-tight">{new Date(p.date).toLocaleDateString()}</span>
                                 <span className="text-[11px] font-medium text-on-surface-variant">{new Date((p as any).created_at || p.date).toLocaleTimeString()}</span>
                              </div>
                           </td>
                           <td className="p-5">
                              <span onClick={() => navigateTo('customer-ledger', { customerId: p.customer_id })} className="text-[15px] font-bold text-on-surface hover:text-primary cursor-pointer line-clamp-1">{p.customerName}</span>
                           </td>
                           <td className="p-5">
                              <div className="flex justify-center">
                                 <span className="bg-surface-variant text-on-surface-variant px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap inline-flex items-center gap-1">
                                    {p.payment_mode || (p as any).paymentMode || 'Cash'}
                                 </span>
                              </div>
                           </td>
                           <td className="p-5 text-right">
                              <span className="font-label-numeric text-[16px] font-bold text-on-surface tracking-tight">{Number(p.amount).toLocaleString()}</span>
                           </td>
                           <td className="p-5">
                              <div className="flex justify-center">
                                 <span className={`px-2 py-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest rounded-lg text-primary`}>
                                    <CheckCircle2 size={14} /> Completed
                                 </span>
                              </div>
                           </td>
                        </tr>
                      ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  )
}

