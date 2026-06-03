import React, { useState, useEffect, useRef } from 'react';
import { Store, UploadCloud, ShieldCheck, Plus, SlidersHorizontal, Database, Download, LogOut, Loader2, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SettingsView() {
  const [dark, setDark] = useState(false);
  const [daily, setDaily] = useState(true);

  const [shopName, setShopName] = useState('Hardwire & Tools Hub');
  const [ownerName, setOwnerName] = useState('Zual Rana');
  const [address, setAddress] = useState('124 Main Market, Hardware Lane\nIndustrial Area, Balupur');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // First try to load from local storage to have immediate display
      const savedShop = localStorage.getItem('shopSettings');
      if (savedShop) {
         try {
             const parsed = JSON.parse(savedShop);
             if (parsed.shopName) setShopName(parsed.shopName);
             if (parsed.ownerName) setOwnerName(parsed.ownerName);
             if (parsed.address) setAddress(parsed.address);
             if (parsed.logoUrl) setLogoUrl(parsed.logoUrl);
             if (parsed.dark !== undefined) setDark(parsed.dark);
             if (parsed.daily !== undefined) setDaily(parsed.daily);
         } catch(e) {}
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      
      const { data, error } = await supabase.from('app_settings')
        .select('*')
        .eq('user_id', user.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') throw error;
      
      if (data) {
         setShopName(data.shop_name || '');
         setOwnerName(data.owner_name || '');
         setAddress(data.address || '');
         setLogoUrl(data.logo_url || null);
         setDark(data.dark || false);
         setDaily(data.daily !== false);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('[SettingsView] Attempting logout...');
      const { error } = await supabase.auth.signOut();
      if (error) {
         console.error('[SettingsView] Logout error:', error);
      } else {
         console.log('[SettingsView] Logout successful.');
      }
    } catch (err) {
      console.error('[SettingsView] Logout exception:', err);
    }
  };

  const saveSettings = async () => {
      setIsSaving(true);
      try {
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) throw new Error("Not authenticated");

          const payload = {
              shop_name: shopName,
              owner_name: ownerName,
              address: address,
              logo_url: logoUrl,
              dark,
              daily,
              user_id: user.user.id,
              updated_at: new Date().toISOString()
          };

          const { data: existing, error: existingError } = await supabase.from('app_settings').select('id').eq('user_id', user.user.id).maybeSingle();
          
          if (existingError && existingError.code === 'PGRST205') {
              // Table doesn't exist, fallback to local storage
              console.warn('Table app_settings not found. Falling back to local storage.');
              localStorage.setItem('shopSettings', JSON.stringify({
                  shopName, ownerName, address, logoUrl, dark, daily
              }));
              alert('Settings saved locally. Please run the SQL migration to create app_settings table in Supabase.');
              setIsSaving(false);
              return;
          }
          if (existingError && existingError.code !== 'PGRST116') throw existingError;
          
          if (existing) {
              const { error } = await supabase.from('app_settings').update(payload).eq('id', existing.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('app_settings').insert([payload]);
              if (error) throw error;
          }
          
          alert('Settings saved successfully!');
      } catch (error: any) {
          console.error("Error saving settings:", error);
          alert('Failed to save settings: ' + error.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      try {
          const { data: user } = await supabase.auth.getUser();
          if (!user.user) throw new Error("Not authenticated");

          const fileExt = file.name.split('.').pop();
          const fileName = `logo-${user.user.id}-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('logos')
            .upload(filePath, file, { upsert: true });

          if (uploadError) {
              if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('404')) {
                  console.warn('Bucket "logos" not found. Falling back to local data URL.');
                  const reader = new FileReader();
                  reader.onloadend = () => {
                      setLogoUrl(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                  alert('Warning: Supabase bucket "logos" not found. Logo is saved locally. Please create the "logos" bucket in Supabase storage and make it public.');
                  return;
              }
              throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(filePath);

          setLogoUrl(publicUrl);
          
      } catch (error: any) {
          console.error('Error uploading logo:', error);
          alert('Failed to upload logo: ' + error.message);
      }
  };

  const fetchAllData = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const [customers, diaries, transactions, payments] = await Promise.all([
          supabase.from('customers').select('*'),
          supabase.from('diaries').select('*'),
          supabase.from('transactions').select('*'),
          supabase.from('payments').select('*')
      ]);

      if (customers.error) throw customers.error;
      if (diaries.error) throw diaries.error;
      if (transactions.error) throw transactions.error;
      if (payments.error) throw payments.error;

      return {
          customers: customers.data || [],
          diaries: diaries.data || [],
          transactions: transactions.data || [],
          payments: payments.data || []
      };
  };

  const downloadFile = (content: any, fileName: string, contentType: string) => {
      const a = document.createElement("a");
      const file = new Blob([content], { type: contentType });
      a.href = URL.createObjectURL(file);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
  };

  const convertToCSV = (arr: any[]) => {
      if (arr.length === 0) return '';
      const keys = Object.keys(arr[0]);
      const csv = [
          keys.join(','),
          ...arr.map(row => keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      return csv;
  };

  const handleExportCSV = async () => {
      setIsExportingCSV(true);
      setExportError(null);
      try {
          const data = await fetchAllData();
          
          if (data.customers.length) downloadFile(convertToCSV(data.customers), `customers_backup_${Date.now()}.csv`, 'text/csv');
          if (data.diaries.length) downloadFile(convertToCSV(data.diaries), `diaries_backup_${Date.now()}.csv`, 'text/csv');
          if (data.transactions.length) downloadFile(convertToCSV(data.transactions), `transactions_backup_${Date.now()}.csv`, 'text/csv');
          if (data.payments.length) downloadFile(convertToCSV(data.payments), `payments_backup_${Date.now()}.csv`, 'text/csv');
          
          alert('CSV Export completed successfully! Check your downloads.');
      } catch (error: any) {
          console.error("CSV Export failed:", error);
          setExportError(`CSV Export failed: ${error.message || error.details || 'Unknown error'}`);
          alert(`CSV Export failed: ${error.message || error.details || 'Unknown error'}`);
      } finally {
          setIsExportingCSV(false);
      }
  };

  const handleExportExcel = async () => {
      setIsExportingExcel(true);
      setExportError(null);
      try {
          const data = await fetchAllData();
          const XLSX = await import('xlsx');
          
          const wb = XLSX.utils.book_new();
          
          const wsCustomers = XLSX.utils.json_to_sheet(data.customers);
          XLSX.utils.book_append_sheet(wb, wsCustomers, "Customers");
          
          const wsDiaries = XLSX.utils.json_to_sheet(data.diaries);
          XLSX.utils.book_append_sheet(wb, wsDiaries, "Diaries");
          
          const wsTransactions = XLSX.utils.json_to_sheet(data.transactions);
          XLSX.utils.book_append_sheet(wb, wsTransactions, "Transactions");
          
          const wsPayments = XLSX.utils.json_to_sheet(data.payments);
          XLSX.utils.book_append_sheet(wb, wsPayments, "Payments");
          
          XLSX.writeFile(wb, `hardware_hub_backup_${Date.now()}.xlsx`);
          
          alert('Excel Export completed successfully!');
      } catch (error: any) {
          console.error("Excel Export failed:", error);
          setExportError(`Excel Export failed: ${error.message || error.details || 'Unknown error'}`);
          alert(`Excel Export failed: ${error.message || error.details || 'Unknown error'}`);
      } finally {
          setIsExportingExcel(false);
      }
  };

  const handleExportPDF = async () => {
      setIsExportingPDF(true);
      setExportError(null);
      try {
          const data = await fetchAllData();
          const doc = new jsPDF();
          
          doc.setFontSize(20);
          doc.setTextColor(26, 54, 93);
          doc.text("Database Backup Summary", 14, 20);
          
          doc.setFontSize(10);
          doc.setTextColor(115, 115, 115);
          doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
          doc.text(`Owner: ${ownerName}`, 14, 34);
          doc.text(`Shop: ${shopName}`, 14, 40);
          
          doc.setDrawColor(226, 232, 240);
          doc.line(14, 44, 196, 44);

          // Add simple stats table
          doc.setFontSize(14);
          doc.setTextColor(26, 54, 93);
          doc.text("Entity Record Summary", 14, 52);

          const summaryColumns = ["Entity Name", "Record Count", "Status"];
          const summaryRows = [
              ["Customers", String(data.customers.length), data.customers.length > 0 ? "OK" : "Empty"],
              ["Diaries/Logs", String(data.diaries.length), data.diaries.length > 0 ? "OK" : "Empty"],
              ["Transactions", String(data.transactions.length), data.transactions.length > 0 ? "OK" : "Empty"],
              ["Payments", String(data.payments.length), data.payments.length > 0 ? "OK" : "Empty"],
          ];

          autoTable(doc, {
              startY: 56,
              head: [summaryColumns],
              body: summaryRows,
              theme: 'striped',
              headStyles: { fillColor: [26, 54, 93] },
              styles: { font: 'helvetica', fontSize: 10 }
          });

          doc.save(`hardware_hub_pdf_backup_${Date.now()}.pdf`);
          alert('PDF Summary Export completed successfully!');
      } catch (error: any) {
          console.error("PDF Export failed:", error);
          setExportError(`PDF Export failed: ${error.message || error.details || 'Unknown error'}`);
          alert(`PDF Export failed: ${error.message || error.details || 'Unknown error'}`);
      } finally {
          setIsExportingPDF(false);
      }
  };

  return (
    <div className="flex-grow px-4 md:px-12 py-6 md:py-8 pb-32 max-w-7xl mx-auto w-full">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-3xl md:text-[48px] font-bold text-primary mb-2 tracking-tight">Settings & Administration</h2>
          <p className="text-[15px] font-medium text-on-surface-variant">Manage your shop profile, team access, and system configurations.</p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error hover:bg-error/20 transition-colors rounded-lg font-bold text-sm"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-sm border border-outline-variant/30 flex flex-col gap-6 lg:col-span-2 relative overflow-hidden backdrop-blur-md">
           <div className="flex items-center gap-3 pb-5 border-b border-surface-variant/70">
              <Store className="text-secondary" size={28} />
              <h3 className="text-[20px] font-bold text-primary tracking-tight">Shop Profile & Branding</h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex flex-col gap-6">
                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Shop Name</label>
                    <input value={shopName} onChange={e => setShopName(e.target.value)} className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-[15px] font-bold text-on-surface focus:border-secondary transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-secondary" type="text" />
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Owner Name</label>
                    <input value={ownerName} onChange={e => setOwnerName(e.target.value)} className="w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-[15px] font-bold text-on-surface focus:border-secondary transition-all shadow-sm focus:outline-none focus:ring-1 focus:ring-secondary" type="text" />
                 </div>
                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Business Address (For Invoices)</label>
                    <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full p-4 bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-[14px] font-medium text-on-surface focus:border-secondary transition-all resize-none shadow-sm focus:outline-none focus:ring-1 focus:ring-secondary" rows={3} />
                 </div>
              </div>
              
              <div className="flex flex-col gap-1.5 h-full">
                 <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Shop Logo</label>
                 <div onClick={() => fileInputRef.current?.click()} className="flex-grow border-2 border-dashed border-outline-variant/50 rounded-xl bg-surface-container-low/50 flex flex-col items-center justify-center gap-3 p-6 min-h-[200px] hover:bg-surface-container-low transition-colors cursor-pointer group relative overflow-hidden">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-32 h-32 object-contain rounded-lg shadow-sm" />
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-2">
                               <UploadCloud size={30} />
                            </div>
                            <span className="text-[14px] font-bold text-primary">Upload New Logo</span>
                            <span className="text-[12px] font-medium text-on-surface-variant">PNG, JPG up to 5MB</span>
                        </>
                    )}
                 </div>
                 <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload} />
              </div>
           </div>
           
           <div className="flex justify-end mt-2 pt-6 border-t border-surface-variant/70">
              <button disabled={isSaving} onClick={saveSettings} className="h-12 px-8 bg-primary text-on-primary rounded-lg text-[14px] font-bold hover:bg-inverse-surface transition-colors shadow-md transform hover:-translate-y-[1px] disabled:opacity-50 flex items-center gap-2">
                 {isSaving ? <Loader2 size={16} className="animate-spin" /> : null} Save Profile Changes
              </button>
           </div>
        </section>

        <section className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-sm border border-outline-variant/30 flex flex-col gap-6">
           <div className="flex items-center justify-between pb-5 border-b border-surface-variant/70">
              <div className="flex items-center gap-3">
                 <ShieldCheck className="text-on-surface-variant" size={24} />
                 <h3 className="text-[20px] font-bold text-primary tracking-tight">User Roles</h3>
              </div>
              <button className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-primary transition-colors">
                 <Plus size={20} className="stroke-[3]" />
              </button>
           </div>
           
           <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 hover:border-secondary shadow-sm transition-colors cursor-pointer">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold text-lg">{ownerName.charAt(0) || 'U'}</div>
                    <div className="flex flex-col">
                       <span className="text-[15px] font-bold text-on-surface">{ownerName || 'User'}</span>
                       <span className="text-[11px] font-medium text-on-surface-variant mt-0.5">Admin</span>
                    </div>
                 </div>
                 <span className="px-3 py-1 bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold tracking-wider rounded-full uppercase">Owner</span>
              </div>
           </div>
        </section>

        <section className="bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-sm border border-outline-variant/30 flex flex-col gap-6 lg:col-span-2">
           <div className="flex items-center gap-3 pb-5 border-b border-surface-variant/70">
              <SlidersHorizontal className="text-on-surface-variant" size={24} />
              <h3 className="text-[20px] font-bold text-primary tracking-tight">Preferences</h3>
           </div>
           
           <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between h-14">
                 <div className="flex flex-col">
                    <span className="text-[16px] font-bold text-on-surface tracking-tight">Dark Mode</span>
                    <span className="text-[13px] font-medium text-on-surface-variant mt-0.5">Switch interface theme</span>
                 </div>
                 <button onClick={() => setDark(!dark)} className={`w-12 h-6 rounded-full relative transition-colors shadow-inner ${dark ? 'bg-secondary' : 'bg-surface-variant'}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md ${dark ? 'left-[26px]' : 'left-1'}`}></span>
                 </button>
              </div>
              
              <div className="flex items-center justify-between h-14">
                 <div className="flex flex-col">
                    <span className="text-[16px] font-bold text-on-surface tracking-tight">Daily Summary Notifications</span>
                    <span className="text-[13px] font-medium text-on-surface-variant mt-0.5">Push alerts at closing</span>
                 </div>
                 <button onClick={() => setDaily(!daily)} className={`w-12 h-6 rounded-full relative transition-colors shadow-inner ${daily ? 'bg-secondary' : 'bg-surface-variant'}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-md ${daily ? 'left-[26px]' : 'left-1'}`}></span>
                 </button>
              </div>
           </div>
        </section>

        <section className="bg-primary-container text-on-primary-container rounded-xl p-6 md:p-8 shadow-lg flex flex-col gap-6 relative overflow-hidden">
           <Database className="absolute -right-6 -bottom-6 opacity-10" size={160} />
           <div className="flex items-center gap-3 pb-5 border-b border-on-primary-container/20 relative z-10">
              <Database className="text-primary-fixed" size={26} />
              <h3 className="text-[20px] font-bold text-white tracking-tight">Data Backup</h3>
           </div>
           
           <div className="flex flex-col gap-5 relative z-10 pt-2">
              <div className="flex items-center justify-between mb-2">
                 <span className="text-[13px] font-bold tracking-wide text-primary-fixed-dim">Backup your complete shop database</span>
              </div>
              
              {exportError && (
                 <div className="p-3 bg-error-container text-on-error-container text-xs font-bold rounded-lg border border-error/20">
                     {exportError}
                 </div>
              )}


              <button 
                  onClick={handleExportPDF}
                  disabled={isExportingPDF || isExportingCSV || isExportingExcel}
                  className="h-12 w-full bg-transparent border border-outline-variant/30 text-white rounded-lg text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors shadow-sm disabled:opacity-50 cursor-pointer">
                 {isExportingPDF ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />} 
                 {isExportingPDF ? 'Exporting PDF...' : 'Export Summary (PDF)'}
              </button>

              <button 
                  onClick={handleExportExcel}
                  disabled={isExportingPDF || isExportingCSV || isExportingExcel}
                  className="h-12 w-full bg-transparent border border-outline-variant/30 text-white rounded-lg text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors shadow-sm disabled:opacity-50 cursor-pointer">
                 {isExportingExcel ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />} 
                 {isExportingExcel ? 'Exporting Excel...' : 'Export Database (Excel)'}
              </button>

              <button 
                  onClick={handleExportCSV}
                  disabled={isExportingPDF || isExportingCSV || isExportingExcel}
                  className="h-12 w-full bg-transparent border border-outline-variant/30 text-white rounded-lg text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors shadow-sm disabled:opacity-50 cursor-pointer">
                 {isExportingCSV ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />} 
                 {isExportingCSV ? 'Exporting CSV...' : 'Export Database (CSV)'}
              </button>
           </div>
        </section>
      </div>
    </div>
  )
}
