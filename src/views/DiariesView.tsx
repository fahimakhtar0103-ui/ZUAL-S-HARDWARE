import React, { useState, useEffect } from 'react';
import { Search, Book, MoreVertical, Users, Plus, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function DiariesView({ navigateTo }: { navigateTo: any }) {
  const [diaries, setDiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New diary modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDiaryName, setNewDiaryName] = useState('');
  const [newDiaryDesc, setNewDiaryDesc] = useState('');

  // Edit diary state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDiary, setEditingDiary] = useState<any>(null);

  const fetchDiaries = async () => {
    setLoading(true);
    try {
      const { data: diariesData, error: diariesError } = await supabase
        .from('diaries')
        .select('*')
        .order('created_at', { ascending: false });

      if (diariesError) throw diariesError;

      // Also fetch aggregate data per diary
      const { data: customerCounts, error: countError } = await supabase
        .from('customers')
        .select('diary_id');
      
      const { data: balances, error: balanceError } = await supabase
        .from('view_customer_balances')
        .select('customer_id, outstanding_balance');
        
      const { data: customersData, error: cError } = await supabase
        .from('customers')
        .select('id, diary_id');

      const enrichedDiaries = diariesData.map(d => {
        const dCustomers = customersData?.filter((c: any) => c.diary_id === d.id) || [];
        const custIds = dCustomers.map((c: any) => c.id);
        const outstanding = balances
          ?.filter((b: any) => custIds.includes(b.customer_id))
          .reduce((sum: number, b: any) => sum + (Number(b.outstanding_balance) || 0), 0) || 0;
          
        return {
          ...d,
          custCount: dCustomers.length,
          outstandingBalance: outstanding
        };
      });

      setDiaries(enrichedDiaries);
    } catch (error: any) {
      console.error('Error fetching diaries:', error);
      setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to fetch diaries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiaries();
  }, []);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiaryName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
       // Optional: pass user_id explicitly just in case RLS or triggers expect created_by/user_id
       const userRes = await supabase.auth.getUser();
       const userId = userRes.data.user?.id;

       if (isEditing && editingDiary.id) {
         const { error } = await supabase.from('diaries').update({
             name: editingDiary.name,
             description: editingDiary.description
         }).eq('id', editingDiary.id);
         
         if (error) throw error;
      } else {
         const userRes = await supabase.auth.getUser();
         const userId = userRes.data.user?.id;
         if (!userId) throw new Error('User not authenticated');
         const { error } = await supabase.from('diaries').insert([{
             name: newDiaryName,
             description: newDiaryDesc,
             created_by: userId
         }]);
         if (error) throw error;
      }
      
      setIsModalOpen(false);
      setNewDiaryName('');
      setNewDiaryDesc('');
      await fetchDiaries();
    } catch (error: any) {
       console.error('Error saving diary:', error);
       setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to save diary');
    } finally {
       setIsSubmitting(false);
    }
  };

  const handleUpdateDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDiary?.name) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
       const { error } = await supabase.from('diaries').update({
           name: editingDiary.name,
           description: editingDiary.description
       }).eq('id', editingDiary.id);
       
       if (error) throw error;
       
       setIsEditModalOpen(false);
       setEditingDiary(null);
       await fetchDiaries();
    } catch (error: any) {
       console.error('Error updating diary:', error);
       setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to update diary');
    } finally {
       setIsSubmitting(false);
    }
  };

  const handleDeleteDiary = async (id: string) => {
      if (!window.confirm('Are you sure you want to delete this diary? This will permanently delete all associated customers and transactions.')) return;
      setErrorMsg(null);
      try {
        const { error } = await supabase.from('diaries').delete().eq('id', id);
        if (error) throw error;
        await fetchDiaries();
      } catch (error: any) {
        console.error('Error deleting diary:', error);
        setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to delete diary');
        alert(`Delete Error: ${error.message || 'Failed to delete diary'}`);
      }
  };

  const filteredDiaries = diaries.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (d.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="px-4 md:px-12 max-w-7xl mx-auto flex flex-col gap-6 pt-4">
      {errorMsg && !isModalOpen && !isEditModalOpen && (
        <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl shadow-sm border border-error/20">
          <p className="font-bold mb-1">Error:</p>
          <p>{errorMsg}</p>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h2 className="text-4xl md:text-[48px] font-bold text-primary tracking-tight leading-tight">Diaries</h2>
          <p className="text-base text-on-surface-variant mt-2">Manage customer ledgers and outstanding balances.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input 
            type="text" 
            placeholder="Search diaries..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest border border-outline-variant/50 rounded-full text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow placeholder:text-outline shadow-sm font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-on-surface-variant gap-2 font-medium">
          <Loader2 className="animate-spin" size={20} /> Loading diaries...
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4 pb-12">
         {filteredDiaries.map((diary, i) => (
            <div key={diary.id} className="group relative bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-variant hover:shadow-lg hover:border-outline-variant hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between min-h-[160px]">
               <div className="absolute left-0 top-0 bottom-0 w-2 bg-secondary" />
               <div className="flex justify-between items-start pl-2">
                 <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => navigateTo('customers', { diaryId: diary.id })}>
                   <Book className="text-secondary" size={24} />
                   <h3 className="text-[20px] font-semibold text-primary tracking-tight line-clamp-1">{diary.name}</h3>
                 </div>
                 <div className="flex items-center">
                     <button 
                         onClick={(e) => { e.stopPropagation(); setEditingDiary(diary); setIsEditModalOpen(true); }}
                         className="text-on-surface-variant md:opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-surface-container rounded-full"
                         title="Edit diary"
                     >
                       <MoreVertical size={18} />
                     </button>
                     <button 
                         onClick={(e) => { e.stopPropagation(); handleDeleteDiary(diary.id); }}
                         className="text-error md:opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-error-container/30 rounded-full ml-1"
                         title="Delete diary"
                     >
                       <Trash2 size={16} />
                     </button>
                 </div>
               </div>
               
               {diary.description && (
                   <p className="text-sm text-on-surface-variant pl-2 mt-2 line-clamp-2">{diary.description}</p>
               )}

               <div className="mt-6 pl-2 flex flex-col gap-2 border-t border-surface-variant/50 pt-4 cursor-pointer" onClick={() => navigateTo('customers', { diaryId: diary.id })}>
                 <p className="text-sm text-on-surface-variant flex items-center gap-2 font-medium">
                   <Users size={16} /> {diary.custCount} Active Customers
                 </p>
                 <div className="flex items-baseline gap-2 mt-1">
                   <span className="text-sm text-on-surface-variant font-medium">Outstanding</span>
                   <span className={`font-label-numeric font-bold text-xl tracking-tight ${diary.outstandingBalance > 0 ? 'text-error' : 'text-on-surface'}`}>
                     ₹ {diary.outstandingBalance.toLocaleString()}
                   </span>
                 </div>
               </div>
            </div>
         ))}

         <div onClick={() => setIsModalOpen(true)} className="group relative bg-surface-container-low rounded-xl p-6 border-2 border-dashed border-outline-variant hover:border-secondary hover:bg-secondary-fixed transition-colors cursor-pointer flex flex-col items-center justify-center min-h-[160px]">
           <div className="w-12 h-12 rounded-full bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex items-center justify-center group-hover:bg-secondary group-hover:border-secondary group-hover:text-on-secondary transition-colors text-on-surface-variant mb-3">
             <Plus size={24} />
           </div>
           <span className="text-lg font-semibold text-on-surface-variant group-hover:text-secondary tracking-tight">New Diary</span>
         </div>
      </div>
      )}

      {/* Add Diary Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-outline-variant/30 bg-surface">
              <h3 className="text-xl font-bold text-on-surface tracking-tight">Create New Diary</h3>
            </div>
            
            {errorMsg && (
              <div className="px-6 pt-4">
                 <div className="p-3 bg-error/10 text-error text-sm font-medium rounded-lg border border-error/20">
                   {errorMsg}
                 </div>
              </div>
            )}
            
            <form onSubmit={handleCreateDiary} className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Diary Name <span className="text-error">*</span></label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={newDiaryName} 
                  onChange={e => setNewDiaryName(e.target.value)} 
                  className="w-full h-12 px-4 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-semibold text-on-surface focus:outline-none focus:border-secondary transition-colors" 
                  placeholder="e.g. 2026 Quarter 1" 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Description</label>
                <textarea 
                  value={newDiaryDesc} 
                  onChange={e => setNewDiaryDesc(e.target.value)} 
                  className="w-full h-24 px-4 py-3 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-medium text-on-surface focus:outline-none focus:border-secondary transition-colors resize-none" 
                  placeholder="Optional details..." 
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/30 mt-2">
                <button type="button" disabled={isSubmitting} onClick={() => setIsModalOpen(false)} className="px-5 h-10 rounded-lg text-sm font-bold text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || !newDiaryName.trim()} className="px-6 h-10 rounded-lg text-sm font-bold bg-primary text-on-primary hover:bg-inverse-surface shadow-sm transition-all disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Create Diary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Diary Modal */}
      {isEditModalOpen && editingDiary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-outline-variant/30 bg-surface">
              <h3 className="text-xl font-bold text-on-surface tracking-tight">Edit Diary</h3>
            </div>
            
            {errorMsg && (
              <div className="px-6 pt-4">
                 <div className="p-3 bg-error/10 text-error text-sm font-medium rounded-lg border border-error/20">
                   {errorMsg}
                 </div>
              </div>
            )}
            
            <form onSubmit={handleUpdateDiary} className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Diary Name <span className="text-error">*</span></label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={editingDiary.name || ''} 
                  onChange={e => setEditingDiary({...editingDiary, name: e.target.value})} 
                  className="w-full h-12 px-4 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-semibold text-on-surface focus:outline-none focus:border-secondary transition-colors" 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Description</label>
                <textarea 
                  value={editingDiary.description || ''} 
                  onChange={e => setEditingDiary({...editingDiary, description: e.target.value})} 
                  className="w-full h-24 px-4 py-3 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-medium text-on-surface focus:outline-none focus:border-secondary transition-colors resize-none" 
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/30 mt-2">
                <button type="button" disabled={isSubmitting} onClick={() => { setIsEditModalOpen(false); setEditingDiary(null); }} className="px-5 h-10 rounded-lg text-sm font-bold text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || !editingDiary.name?.trim()} className="px-6 h-10 rounded-lg text-sm font-bold bg-primary text-on-primary hover:bg-inverse-surface shadow-sm transition-all disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
