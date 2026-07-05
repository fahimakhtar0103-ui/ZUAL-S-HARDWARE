import React, { useState, useEffect } from 'react';
import { Search, MapPin, User, FileText, ArrowRight, CornerDownLeft, Book, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SearchView({ navigateTo }: { navigateTo: any }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!searchQuery.trim()) {
        setResults([]);
        setErrorMsg(null);
        return;
      }

      setLoading(true);
      setErrorMsg(null);
      try {
        const safeQuery = searchQuery.replace(/[(),]/g, '');
        const { data: cData } = await supabase
          .from('customers')
          .select('id, name, phone, address')
          .or(`name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%,address.ilike.%${safeQuery}%`)
          .limit(5);

        const { data: dData } = await supabase
          .from('diaries')
          .select('id, name')
          .ilike('name', `%${searchQuery}%`)
          .limit(5);

        const formattedResults = [];

        if (cData) {
          cData.forEach(c => {
            formattedResults.push({
              title: c.name,
              type: 'Customer',
              doc: c.phone ? `Phone: ${c.phone}` : 'No phone',
              loc: c.address || 'Unknown',
              route: 'customer-ledger',
              context: { customerId: c.id }
            });
          });
        }

        if (dData) {
          dData.forEach(d => {
            formattedResults.push({
              title: d.name,
              type: 'Diary',
              doc: 'Ledger Book',
              loc: 'System',
              route: 'customers',
              context: { diaryId: d.id }
            });
          });
        }

        setResults(formattedResults);
      } catch (err: any) {
        console.error('Search error', err);
        setErrorMsg(err.message || err.details || err.hint || JSON.stringify(err) || 'Failed to perform search');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchSearchResults();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 md:p-12 space-y-6">
      {errorMsg && (
        <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20 mb-2">
          <p className="font-bold mb-1">Error Loading Data:</p>
          <p>{errorMsg}</p>
        </div>
      )}
      <div className="relative group">
         <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" size={24} />
         <input 
            autoFocus
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers, diaries..." 
            className="w-full h-16 pl-16 pr-20 bg-surface-container-lowest border-2 border-outline-variant/50 rounded-2xl text-[18px] font-bold text-on-surface focus:outline-none focus:border-primary focus:shadow-[0_0_0_4px_rgba(var(--color-primary-container),0.3)] transition-all placeholder:font-medium placeholder:text-on-surface-variant/70"
         />
         {loading && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2 text-primary">
              <Loader2 className="animate-spin" size={20} />
            </div>
         )}
      </div>

      {searchQuery.trim() && (
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
         <div className="p-4 border-b border-surface-variant bg-surface-container/20 flex justify-between items-center">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest pl-2">Search Results</span>
         </div>
         
         <div className="divide-y divide-surface-variant/50">
            {results.length === 0 && !loading ? (
              <div className="p-8 text-center text-on-surface-variant font-medium">No results found for "{searchQuery}"</div>
            ) : (
              results.map((r, i) => (
              <div 
                 key={i} 
                 onClick={() => navigateTo(r.route, r.context)}
                 className="p-4 md:p-5 flex items-center justify-between hover:bg-surface-container cursor-pointer transition-colors group relative"
              >
                 <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                 <div className="flex items-center gap-4 pl-2">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high text-on-surface-variant flex items-center justify-center shadow-sm shrink-0">
                       {r.type === 'Customer' ? <User size={20} /> : <Book size={20} />}
                    </div>
                    <div>
                       <h3 className="text-[16px] font-bold text-on-surface group-hover:text-primary transition-colors tracking-tight line-clamp-1">{r.title}</h3>
                       <p className="text-[13px] text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{r.type}</span>
                          <span className="font-medium">•</span>
                          <span className="font-medium">{r.doc}</span>
                       </p>
                    </div>
                 </div>
                 
                 <div className="hidden md:flex items-center gap-6 pr-4">
                    <span className="text-[13px] font-medium text-on-surface-variant flex items-center gap-1.5"><MapPin size={14} /> {r.loc}</span>
                    <ArrowRight className="text-outline-variant group-hover:text-primary transition-colors" size={20} />
                 </div>
                 
                 <CornerDownLeft className="text-outline-variant md:hidden" size={18} />
              </div>
            )))}
         </div>
      </div>
      )}
    </div>
  )
}
