import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Building2, User, Phone, CheckCircle2, AlertCircle, Loader2, Github } from 'lucide-react';

export default function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              phone: phone
            }
          }
        });
        if (error) throw error;
        setMessage('Registration successful! You can now log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || `An error occurred during ${provider} authentication.`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container overflow-hidden">
        <div className="bg-primary p-8 text-on-primary text-center">
           <Building2 size={48} className="mx-auto mb-4 opacity-90" />
           <h1 className="text-2xl font-bold font-sans">Hardware ERP</h1>
           <p className="text-primary-container font-medium mt-2">Manage your ledger securely</p>
        </div>
        
        <div className="p-8">
           <h2 className="text-xl font-bold text-on-surface mb-6">{isLogin ? 'Sign In' : 'Create Account'}</h2>
           
           {error && (
             <div className="bg-error/10 text-error p-4 rounded-lg flex items-start gap-3 mb-6 text-sm font-medium">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p>{error}</p>
             </div>
           )}

           {message && (
             <div className="bg-secondary-fixed text-on-secondary-fixed p-4 rounded-lg flex items-start gap-3 mb-6 text-sm font-bold">
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <p>{message}</p>
             </div>
           )}

           <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                 <>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                      <input 
                        type="text" 
                        placeholder="Full Name" 
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full pl-12 pr-4 h-12 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary transition-colors text-on-surface font-medium" 
                      />
                    </div>
                    <div className="relative">
                      <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                      <input 
                        type="tel" 
                        placeholder="Phone Number" 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full pl-12 pr-4 h-12 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary transition-colors text-on-surface font-medium font-label-numeric" 
                      />
                    </div>
                 </>
              )}
              
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 h-12 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary transition-colors text-on-surface font-medium" 
                />
              </div>
              
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input 
                  type="password" 
                  placeholder="Password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 h-12 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary transition-colors text-on-surface font-medium" 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary text-on-primary font-bold h-12 rounded-lg flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 mt-6"
              >
                 {loading ? <Loader2 size={20} className="animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
              </button>
           </form>

           <div className="mt-6 flex items-center gap-4">
               <hr className="flex-1 border-surface-variant" />
               <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">OR</span>
               <hr className="flex-1 border-surface-variant" />
           </div>

           <div className="mt-6 grid grid-cols-2 gap-3">
               <button 
                 type="button"
                 onClick={() => handleOAuth('google')}
                 className="flex items-center justify-center gap-2 h-12 border border-outline-variant rounded-lg font-medium hover:bg-surface-container transition-colors text-sm"
               >
                 <svg className="w-5 h-5" viewBox="0 0 24 24">
                   <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                   <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                   <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                   <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                   <path fill="none" d="M1 1h22v22H1z" />
                 </svg>
                 Google
               </button>
               <button 
                 type="button"
                 onClick={() => handleOAuth('github')}
                 className="flex items-center justify-center gap-2 h-12 border border-outline-variant rounded-lg font-medium hover:bg-surface-container transition-colors text-sm"
               >
                 <Github size={18} />
                 GitHub
               </button>
           </div>

           <div className="mt-8 text-center">
             <button 
               type="button" 
               onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
               className="text-secondary text-sm font-bold tracking-wide hover:underline"
             >
               {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
