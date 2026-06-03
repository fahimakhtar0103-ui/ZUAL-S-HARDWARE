import React, { useState, useEffect } from 'react';
import { TrendingUp, Wallet, AlertTriangle, MonitorSmartphone, CreditCard, Package, PieChart, FileText, Loader2, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportsView({ navigateTo }: { navigateTo: any }) {
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [paymentsRows, setPaymentsRows] = useState<any[]>([]);
  const [balancesRows, setBalancesRows] = useState<any[]>([]);
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'WEEK' | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [salesRes, paymentsRes, balancesRes] = await Promise.all([
          supabase.from('transactions').select('total_amount, date'),
          supabase.from('payments').select('amount, date'),
          supabase.from('view_customer_balances').select('outstanding_balance')
        ]);
        
        if (salesRes.error) throw salesRes.error;
        if (paymentsRes.error) throw paymentsRes.error;
        if (balancesRes.error) throw balancesRes.error;

        setSalesRows(salesRes.data || []);
        setPaymentsRows(paymentsRes.data || []);
        setBalancesRows(balancesRes.data || []);
      } catch (err: any) {
        console.error("Error fetching reports", err);
        setErrorMsg(err.message || err.details || err.hint || JSON.stringify(err) || 'Failed to fetch reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const getFilteredMetrics = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const filteredSales = salesRows.filter(s => {
      if (timeFilter === 'ALL') return true;
      if (timeFilter === 'TODAY') return s.date === todayStr;
      if (timeFilter === 'WEEK') return s.date >= sevenDaysAgoStr && s.date <= todayStr;
      return true;
    });

    const filteredPayments = paymentsRows.filter(p => {
      if (timeFilter === 'ALL') return true;
      if (timeFilter === 'TODAY') return p.date === todayStr;
      if (timeFilter === 'WEEK') return p.date >= sevenDaysAgoStr && p.date <= todayStr;
      return true;
    });

    const totalSales = filteredSales.reduce((acc, row) => acc + Number(row.total_amount), 0);
    const totalCollection = filteredPayments.reduce((acc, row) => acc + Number(row.amount), 0);
    
    let outstandingDue = 0;
    let activeDebtors = 0;
    balancesRows.forEach(row => {
      const bal = Number(row.outstanding_balance) || 0;
      if (bal > 0) activeDebtors++;
      outstandingDue += bal;
    });

    return { totalSales, totalCollection, outstandingDue, activeDebtors };
  };

  const metrics = getFilteredMetrics();

  const getCustName = (cust: any): string => {
    if (!cust) return 'Unknown';
    if (Array.isArray(cust)) {
      return cust[0]?.name || 'Unknown';
    }
    return cust.name || 'Unknown';
  };

  const handleExport = async (reportTitle: string, format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(reportTitle + '_' + format);
    try {
      let dataToExport: any[] = [];
      let columns: string[] = [];
      let filename = `${reportTitle.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

      if (reportTitle === 'Daily Sales Summary') {
        const { data, error } = await supabase
          .from('transactions')
          .select(`date, total_amount, items, customers ( name )`)
          .order('date', { ascending: false });

        if (error) throw error;
        dataToExport = (data || []).map(t => ({
          'Date': t.date,
          'Customer': getCustName((t as any).customers),
          'Sales Amount (₹)': Number(t.total_amount),
          'Items Summary': (t.items || []).map((it: any) => `${it.material} (${it.qty} ${it.unit})`).join('; ')
        }));
        columns = ['Date', 'Customer', 'Sales Amount (₹)', 'Items Summary'];
      }

      else if (reportTitle === 'Monthly Collection') {
        const { data, error } = await supabase
          .from('payments')
          .select(`date, amount, payment_mode, reference_notes, customers ( name )`)
          .order('date', { ascending: false });

        if (error) throw error;
        dataToExport = (data || []).map(p => ({
          'Date': p.date,
          'Customer': getCustName((p as any).customers),
          'Amount Received (₹)': Number(p.amount),
          'Payment Mode': p.payment_mode || 'Cash',
          'Notes': p.reference_notes || ''
        }));
        columns = ['Date', 'Customer', 'Amount Received (₹)', 'Payment Mode', 'Notes'];
      }

      else if (reportTitle === 'Top 10 Debtors') {
        const { data, error } = await supabase
          .from('view_customer_balances')
          .select('*')
          .order('outstanding_balance', { ascending: false })
          .limit(10);

        if (error) throw error;
        dataToExport = (data || []).map(b => ({
          'Customer': b.customer_name,
          'Credit Limit (₹)': Number(b.credit_limit || 0),
          'Outstanding Due (₹)': Number(b.outstanding_balance),
          'Status': b.status
        }));
        columns = ['Customer', 'Credit Limit (₹)', 'Outstanding Due (₹)', 'Status'];
      }

      else if (reportTitle === 'Inventory Movement') {
        const { data, error } = await supabase
          .from('transactions')
          .select('items');

        if (error) throw error;
        
        const movementMap: Record<string, { material: string, totalQty: number, totalValue: number }> = {};
        (data || []).forEach(t => {
          (t.items || []).forEach((it: any) => {
            const name = it.material || 'Unknown Item';
            if (!movementMap[name]) {
              movementMap[name] = { material: name, totalQty: 0, totalValue: 0 };
            }
            movementMap[name].totalQty += Number(it.qty) || 0;
            movementMap[name].totalValue += (Number(it.qty) || 0) * (Number(it.rate) || 0);
          });
        });

        dataToExport = Object.values(movementMap).sort((a,b) => b.totalValue - a.totalValue).map((item: any) => ({
          'Material Name': item.material,
          'Total Quantity Sold': item.totalQty,
          'Total Sales Value (₹)': item.totalValue
        }));
        columns = ['Material Name', 'Total Quantity Sold', 'Total Sales Value (₹)'];
      }

      else if (reportTitle === 'Collection Forecast') {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('transactions')
          .select(`due_date, total_amount, customers ( name )`)
          .gte('due_date', todayStr)
          .order('due_date', { ascending: true });

        if (error) throw error;
        dataToExport = (data || []).map(t => ({
          'Due Date': t.due_date,
          'Customer': getCustName((t as any).customers),
          'Forecasted Recovery (₹)': Number(t.total_amount)
        }));
        columns = ['Due Date', 'Customer', 'Forecasted Recovery (₹)'];
      }

      if (dataToExport.length === 0) {
        alert('No data available for this report.');
        return;
      }

      if (format === 'csv') {
        const csvContent = [
          columns.join(','),
          ...dataToExport.map(row => columns.map(col => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else if (format === 'excel') {
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${filename}.xlsx`);
      } else if (format === 'pdf') {
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.setTextColor(26, 54, 93);
        doc.text(reportTitle, 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(115, 115, 115);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
        doc.text(`Time Filter: ${timeFilter}`, 14, 34);
        
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 38, 196, 38);

        const tableBody = dataToExport.map(row => columns.map(col => String(row[col] ?? '')));

        autoTable(doc, {
          startY: 42,
          head: [columns],
          body: tableBody,
          theme: 'striped',
          headStyles: { fillColor: [13, 148, 136] },
          styles: { font: 'helvetica', fontSize: 9 },
          alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        doc.save(`${filename}.pdf`);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      alert("Failed to export report: " + err.message);
    } finally {
      setIsExporting(null);
    }
  };

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
          <button 
            onClick={() => setTimeFilter('TODAY')}
            className={`px-5 py-2.5 h-11 rounded-full border text-[13px] font-bold whitespace-nowrap transition-colors ${timeFilter === 'TODAY' ? 'bg-primary text-on-primary border-transparent shadow-md' : 'bg-surface-container border-outline-variant/30 text-on-surface hover:bg-surface-container-highest pointer-events-auto'}`}
          >
            Today
          </button>
          <button 
            onClick={() => setTimeFilter('WEEK')}
            className={`px-5 py-2.5 h-11 rounded-full border text-[13px] font-bold whitespace-nowrap transition-colors ${timeFilter === 'WEEK' ? 'bg-primary text-on-primary border-transparent shadow-md' : 'bg-surface-container border-outline-variant/30 text-on-surface hover:bg-surface-container-highest pointer-events-auto'}`}
          >
            This Week
          </button>
          <button 
            onClick={() => setTimeFilter('ALL')}
            className={`px-6 py-2.5 h-11 rounded-full border text-[13px] font-bold whitespace-nowrap transition-colors ${timeFilter === 'ALL' ? 'bg-primary text-on-primary border-transparent shadow-md' : 'bg-surface-container border-outline-variant/30 text-on-surface hover:bg-surface-container-highest pointer-events-auto'}`}
          >
            All Time
          </button>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-on-surface-variant gap-2"><Loader2 className="animate-spin" /> Loading reports...</div>
      ) : (
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface-container-lowest p-6 md:p-8 rounded-xl shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col justify-between cursor-pointer group transition-shadow hover:shadow-md" onClick={() => navigateTo('dashboard')}>
           <div className="flex justify-between items-start mb-6">
             <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Total Sales</span>
             <TrendingUp className="text-secondary group-hover:scale-125 transition-transform duration-300" />
           </div>
           <div>
             <div className="font-label-numeric text-4xl md:text-[44px] tracking-tight font-bold text-primary mb-2">₹ {metrics.totalSales.toLocaleString()}</div>
             <div className="text-[13px] text-on-surface-variant flex items-center gap-1.5 font-medium">Selected period performance</div>
           </div>
        </div>
        
        <div className="bg-surface-container-lowest p-6 md:p-8 rounded-xl shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col justify-between cursor-pointer group transition-shadow hover:shadow-md" onClick={() => navigateTo('dashboard')}>
           <div className="flex justify-between items-start mb-6">
             <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Total Collection</span>
             <Wallet className="text-secondary group-hover:scale-125 transition-transform duration-300" />
           </div>
           <div>
             <div className="font-label-numeric text-4xl md:text-[44px] tracking-tight font-bold text-primary mb-2">₹ {metrics.totalCollection.toLocaleString()}</div>
             <div className="text-[13px] text-on-surface-variant flex items-center gap-1.5 font-medium">Selected period payments</div>
           </div>
        </div>

        <div className="bg-tertiary-container p-6 md:p-8 rounded-xl shadow-lg flex flex-col justify-between overflow-hidden relative cursor-pointer group transition-shadow hover:shadow-xl" onClick={() => navigateTo('dashboard')}>
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
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
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{reports.length} items</span>
         </div>
         <div className="divide-y divide-surface-variant/50">
            {reports.map((r, i) => (
              <div key={i} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-surface-container-low transition-colors group">
                 <div className="flex items-start gap-5">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${r.color}`}>
                       <r.icon size={24} />
                    </div>
                    <div>
                       <h4 className="text-[17px] text-primary font-bold mb-1.5 transition-colors tracking-tight">{r.title}</h4>
                       <p className="text-[14px] text-on-surface-variant font-medium md:max-w-xl">{r.desc}</p>
                    </div>
                 </div>
                 <div className="flex flex-wrap items-center gap-3 pl-16 md:pl-0">
                    <button 
                      onClick={() => handleExport(r.title, 'pdf')}
                      disabled={isExporting !== null}
                      className="h-10 px-4 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] font-bold text-red-600 dark:text-red-400 flex items-center gap-2 hover:bg-red-500/20 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                       <FileText size={16} /> {isExporting === r.title + '_pdf' ? 'Exporting PDF...' : 'PDF'}
                    </button>
                    <button 
                      onClick={() => handleExport(r.title, 'excel')}
                      disabled={isExporting !== null}
                      className="h-10 px-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[13px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 hover:bg-emerald-500/20 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                       <Download size={16} /> {isExporting === r.title + '_excel' ? 'Exporting Excel...' : 'Excel'}
                    </button>
                    <button 
                      onClick={() => handleExport(r.title, 'csv')}
                      disabled={isExporting !== null}
                      className="h-10 px-4 rounded-lg bg-surface border border-outline-variant/40 text-[13px] font-bold text-on-surface flex items-center gap-2 hover:bg-surface-container-highest transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                       <Download size={16} className="text-on-surface-variant" /> {isExporting === r.title + '_csv' ? 'Exporting CSV...' : 'CSV'}
                    </button>
                 </div>
              </div>
            ))}
         </div>
      </section>
    </div>
  )
}
