import React, { useState, useEffect } from 'react';
import { TrendingUp, Wallet, AlertTriangle, MonitorSmartphone, CreditCard, Package, PieChart, FileText, Grid, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ReportsView({ navigateTo }: { navigateTo: any }) {
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalCollection: 0,
    outstandingDue: 0,
    activeDebtors: 0
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [salesRes, paymentsRes, balancesRes] = await Promise.all([
          supabase.from('transactions').select('total_amount'),
          supabase.from('payments').select('amount'),
          supabase.from('view_customer_balances').select('outstanding_balance')
        ]);
        
        let totalSales = 0;
        if (salesRes.data) {
          totalSales = salesRes.data.reduce((acc, row) => acc + Number(row.total_amount), 0);
        }
        
        let totalCollection = 0;
        if (paymentsRes.data) {
          totalCollection = paymentsRes.data.reduce((acc, row) => acc + Number(row.amount), 0);
        }
        
        let outstandingDue = 0;
        let activeDebtors = 0;
        if (balancesRes.data) {
          outstandingDue = balancesRes.data.reduce((acc, row) => {
             const bal = Number(row.outstanding_balance) || 0;
             if (bal > 0) activeDebtors++;
             return acc + bal;
          }, 0);
        }

        setMetrics({ totalSales, totalCollection, outstandingDue, activeDebtors });
      } catch (err: any) {
        console.error("Error fetching reports", err);
        setErrorMsg(err.message || err.details || err.hint || JSON.stringify(err) || 'Failed to fetch reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const reports = [
    { title: 'Daily Sales Summary', desc: 'Breakdown of cash and credit sales, itemized by category.', icon: MonitorSmartphone, color: 'bg-secondary-fixed text-on-secondary-fixed' },
    { title: 'Monthly Collection', desc: 'Aggregated payments received against outstanding invoices.', icon: CreditCard, color: 'bg-primary-fixed text-on-primary-fixed' },
    { title: 'Top 10 Debtors', desc: 'Customers with the highest outstanding balances exceeding 30 days.', icon: AlertTriangle, color: 'bg-error-container text-on-error-container' },
    { title: 'Inventory Movement', desc: 'Stock inward/outward ledger for physical hardware reconciliation.', icon: Package, color: 'bg-tertiary-fixed text-on-tertiary-fixed' },
    { title: 'Collection Forecast', desc: 'Projected cash flow based on upcoming due dates and historical trends.', icon: PieChart, color: 'bg-secondary-fixed-dim text-on-secondary-fixed' },
  ];

  return (
    <div className="px-4 md:px-12 max-w-7xl mx-auto flex flex-col gap-6 pt-4 min-h-full pb-12">
      {errorMsg && (
        <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20 mb-2">
          <p className="font-bold mb-1">Error:</p>
          <p>{errorMsg}</p>
        </div>
      )}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-surface-variant/50 pb-4 md:pb-0 md:border-none">
        <div>
          <h2 className="text-3xl md:text-[48px] font-bold text-primary tracking-tight">Enterprise Reports</h2>
          <p className="text-on-surface-variant font-medium text-[15px] mt-2">Analyze sales, collections, and inventory performance.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar md:pb-0">
          <button className="px-5 py-2.5 h-11 rounded-full bg-surface-container border border-outline-variant/30 text-[13px] font-bold text-on-surface hover:bg-surface-container-highest whitespace-nowrap transition-colors">Today</button>
          <button className="px-5 py-2.5 h-11 rounded-full bg-surface-container border border-outline-variant/30 text-[13px] font-bold text-on-surface hover:bg-surface-container-highest whitespace-nowrap transition-colors">This Week</button>
          <button className="px-6 py-2.5 h-11 rounded-full bg-primary text-on-primary text-[13px] font-bold whitespace-nowrap shadow-md">All Time</button>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-on-surface-variant gap-2"><Loader2 className="animate-spin" /> Loading reports...</div>
      ) : (
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface-container-lowest p-6 md:p-8 rounded-xl shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col justify-between cursor-pointer group transition-shadow hover:shadow-md" onClick={() => navigateTo('recovery-dashboard')}>
           <div className="flex justify-between items-start mb-6">
             <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Total Sales</span>
             <TrendingUp className="text-secondary group-hover:scale-125 transition-transform duration-300" />
           </div>
           <div>
             <div className="font-label-numeric text-4xl md:text-[44px] tracking-tight font-bold text-primary mb-2">₹ {metrics.totalSales.toLocaleString()}</div>
             <div className="text-[13px] text-on-surface-variant flex items-center gap-1.5 font-medium">All time recorded sales</div>
           </div>
        </div>
        
        <div className="bg-surface-container-lowest p-6 md:p-8 rounded-xl shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col justify-between cursor-pointer group transition-shadow hover:shadow-md" onClick={() => navigateTo('recovery-dashboard')}>
           <div className="flex justify-between items-start mb-6">
             <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Total Collection</span>
             <Wallet className="text-secondary group-hover:scale-125 transition-transform duration-300" />
           </div>
           <div>
             <div className="font-label-numeric text-4xl md:text-[44px] tracking-tight font-bold text-primary mb-2">₹ {metrics.totalCollection.toLocaleString()}</div>
             <div className="text-[13px] text-on-surface-variant flex items-center gap-1.5 font-medium">All time secured payments</div>
           </div>
        </div>

        <div className="bg-tertiary-container p-6 md:p-8 rounded-xl shadow-lg flex flex-col justify-between overflow-hidden relative cursor-pointer group transition-shadow hover:shadow-xl" onClick={() => navigateTo('recovery-dashboard')}>
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <AlertTriangle size={80} className="text-white" />
           </div>
           <div className="flex justify-between items-start mb-6 relative z-10">
             <span className="text-[11px] font-bold text-on-tertiary-container uppercase tracking-widest">Outstanding Due</span>
             <AlertTriangle className="text-error-container" />
           </div>
           <div className="relative z-10">
             <div className="font-label-numeric text-4xl md:text-[44px] tracking-tight font-bold text-white mb-2">₹ {metrics.outstandingDue.toLocaleString()}</div>
             <div className="text-[13px] text-on-tertiary-container font-medium">Across {metrics.activeDebtors} active debtors</div>
           </div>
        </div>
      </section>
      )}

      <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden mb-8 mt-2">
         <div className="px-6 py-5 border-b border-surface-variant/70 bg-surface-container-low/50 flex justify-between items-center">
            <h3 className="text-[18px] font-bold text-primary tracking-tight">Available Reports</h3>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">5 items</span>
         </div>
         <div className="divide-y divide-surface-variant/50">
            {reports.map((r, i) => (
              <div key={i} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-surface-container-low transition-colors group cursor-pointer">
                 <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${r.color}`}>
                       <r.icon size={24} />
                    </div>
                    <div>
                       <h4 className="text-[17px] text-primary font-bold mb-1.5 group-hover:text-secondary transition-colors tracking-tight">{r.title}</h4>
                       <p className="text-[14px] text-on-surface-variant font-medium md:max-w-xl">{r.desc}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 pl-16 md:pl-0">
                    <button className="h-11 px-5 rounded-lg bg-surface border border-outline-variant/40 text-[13px] font-bold text-on-surface flex items-center gap-2 hover:bg-surface-container-highest transition-colors shadow-sm">
                       <FileText size={18} /> PDF
                    </button>
                    <button className="h-11 px-5 rounded-lg bg-surface border border-outline-variant/40 text-[13px] font-bold text-on-surface flex items-center gap-2 hover:bg-surface-container-highest transition-colors shadow-sm">
                       <Grid size={18} /> Excel
                    </button>
                 </div>
              </div>
            ))}
         </div>
      </section>
    </div>
  )
}
