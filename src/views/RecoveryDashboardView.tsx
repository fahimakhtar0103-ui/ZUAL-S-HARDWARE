import React from 'react';
import { FileText, MoreVertical, AlertTriangle, ChevronRight, Phone } from 'lucide-react';

export default function RecoveryDashboardView({ navigateTo }: { navigateTo: any }) {
  const debtors = [
    { name: 'Zual Rana', desc: 'Balupur · S/O Md Ebrahim', due: '210 DAYS', dueVal: '$2,400', phone: '7029623381' },
    { name: 'DYTRON-2024', desc: 'Corporate Account', due: '185 DAYS', dueVal: '$1,400' },
  ];

  return (
    <div className="px-4 md:px-12 max-w-7xl mx-auto flex flex-col gap-8 pt-4 min-h-full pb-12">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-5">
        <div>
          <h1 className="text-4xl md:text-[48px] font-bold text-primary tracking-tight leading-tight">Recovery Dashboard</h1>
          <p className="text-[15px] font-medium text-on-surface-variant mt-2">Aging analysis and critical debtor management.</p>
        </div>
        <button className="bg-primary text-on-primary px-8 h-12 md:h-14 rounded-full text-[15px] font-bold flex items-center justify-center gap-2.5 hover:bg-inverse-surface transition-colors w-full md:w-auto shadow-md">
          <FileText size={18} /> Generate Follow-up List
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col gap-10">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> 0 - 30 Days</span>
              <span className="font-label-numeric font-bold text-primary text-[28px] tracking-tight mt-auto">$42,500</span>
           </div>
           <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col gap-10">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span> 31 - 90 Days</span>
              <span className="font-label-numeric font-bold text-primary text-[28px] tracking-tight mt-auto">$18,200</span>
           </div>
           <div className="bg-error-container/20 p-6 rounded-xl shadow-sm border border-error-container flex flex-col gap-10">
              <span className="text-[11px] font-bold text-error uppercase tracking-widest flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-error"></span> 91 - 180 Days</span>
              <span className="font-label-numeric font-bold text-error text-[28px] tracking-tight mt-auto">$9,450</span>
           </div>
           <div className="bg-error text-on-error p-6 rounded-xl shadow-lg flex flex-col gap-10 relative overflow-hidden">
              <AlertTriangle size={100} className="absolute -right-6 -top-6 opacity-10" />
              <span className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 z-10"><AlertTriangle size={14} strokeWidth={3} /> 180+ Days (Critical)</span>
              <span className="font-label-numeric font-bold text-[36px] tracking-tight mt-auto z-10">$3,800</span>
           </div>
        </div>

        <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-6 md:p-8 shadow-sm border border-outline-variant/30 flex flex-col h-[480px]">
           <div className="flex justify-between items-center mb-8">
              <h3 className="text-[22px] font-bold text-primary tracking-tight">Receivables Aging</h3>
              <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container">
                 <MoreVertical size={20} className="text-on-surface-variant" />
              </button>
           </div>
           
           <div className="relative flex-1 w-full flex items-end gap-3 mt-4 ml-8 pl-4 border-l-2 border-b-2 border-outline-variant/30 pb-2">
              <div className="absolute -left-[45px] top-0 h-full flex flex-col justify-between text-on-surface-variant font-label-numeric text-[12px] font-bold pb-6">
                 <span>$50k</span><span>$40k</span><span>$30k</span><span>$20k</span><span>$10k</span><span>$0</span>
              </div>
              <div className="flex-1 flex items-end justify-around h-full relative z-10 pl-4 w-full">
                 {[
                   { label: '0-30 Days', h: '85%', val: '$42,500', bg: 'bg-secondary' },
                   { label: '31-90 Days', h: '36%', val: '$18,200', bg: 'bg-[#f59e0b]' },
                   { label: '91-180 Days', h: '19%', val: '$9,450', bg: 'bg-error/80' },
                   { label: '180+ Days', h: '8%', val: '$3,800', bg: 'bg-error', text: 'text-error font-bold tracking-tight' },
                 ].map((bar, i) => (
                    <div key={i} className="w-[15%] group relative flex flex-col items-center h-full justify-end">
                       <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-inverse-surface text-inverse-on-surface font-label-numeric text-[13px] py-1.5 px-3 rounded-lg font-bold shadow-lg whitespace-nowrap z-20">
                          {bar.val}
                       </div>
                       <div className={`w-full max-w-[80px] rounded-t-sm transition-all duration-300 group-hover:opacity-85 shadow-sm ${bar.bg}`} style={{ height: bar.h }}></div>
                       <span className={`absolute -bottom-[28px] text-[11px] md:text-sm whitespace-nowrap ${bar.text || 'text-on-surface-variant font-bold'}`}>{bar.label}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="md:col-span-4 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 flex flex-col overflow-hidden max-h-[480px]">
           <div className="p-6 md:p-8 border-b border-outline-variant/30 bg-surface-container-low/50">
              <h3 className="text-[20px] font-bold text-primary flex items-center gap-2.5 tracking-tight">
                 <AlertTriangle size={22} className="text-error" /> Critical Debtors
              </h3>
              <p className="text-[13px] font-medium text-on-surface-variant mt-2">Oldest dues requiring immediate action.</p>
           </div>
           
           <div className="flex-1 overflow-y-auto">
              {debtors.map((d, i) => (
                <div key={i} className="p-6 md:p-8 border-b border-outline-variant/20 hover:bg-surface-container-lowest transition-colors flex justify-between items-start gap-4 cursor-pointer" onClick={() => navigateTo('customer-ledger')}>
                   <div>
                      <p className="text-[17px] font-bold text-primary tracking-tight">{d.name}</p>
                      <p className="text-[14px] text-on-surface-variant font-medium mt-1">{d.desc}</p>
                      <div className="flex items-center gap-3 mt-3">
                         <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest bg-error-container text-on-error-container leading-none">{d.due}</span>
                         {d.phone && (
                           <span className="text-secondary text-[12px] font-bold flex items-center gap-1.5 font-label-numeric p-1">
                              <Phone size={14} /> {d.phone}
                           </span>
                         )}
                      </div>
                   </div>
                   <div className="text-right flex flex-col items-end">
                      <p className="font-label-numeric text-error font-bold text-xl tracking-tight">{d.dueVal}</p>
                      <ChevronRight size={20} className="text-on-surface-variant mt-4" />
                   </div>
                </div>
              ))}
           </div>
           
           <div className="p-5 bg-surface-container-lowest border-t border-outline-variant/30 mt-auto">
              <button className="w-full h-12 border border-outline-variant/60 rounded-xl text-primary text-[14px] font-bold hover:bg-surface-container-high transition-colors shadow-sm">
                 View All Debtors
              </button>
           </div>
        </div>
      </div>
    </div>
  )
}
