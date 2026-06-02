import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Building2, User, Phone, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
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
      if (isResetting) {
        console.log('[AuthView] Attempting password reset for:', email);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        console.log('[AuthView] Password reset link sent successfully');
        setMessage('Password reset link sent! Check your email.');
      } else if (isLogin) {
        console.log('[AuthView] Attempting login for:', email);
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
           console.error('[AuthView] Login Error:', error);
           throw error;
        }
        console.log('[AuthView] Login successful:', data);
      } else {
        console.log('[AuthView] Attempting signup for:', email);
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              phone: phone
            }
          }
        });
        if (error) {
           console.error('[AuthView] Signup Error:', error);
           throw error;
        }
        console.log('[AuthView] Signup successful:', data);
        setMessage('Registration successful! Please check your email to confirm your account.');
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error('[AuthView] Auth Error Exception:', err);
      setError(err.message || JSON.stringify(err) || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
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
           <h2 className="text-xl font-bold text-on-surface mb-6">{isResetting ? 'Reset Password' : isLogin ? 'Sign In' : 'Create Account'}</h2>
           
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
              
               {!isResetting && (
                 <div className="relative">
                   <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                   <input 
                     type="password" 
                     placeholder="Password" 
                     required={!isResetting}
                     value={password}
                     onChange={e => setPassword(e.target.value)}
                     className="w-full pl-12 pr-4 h-12 bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary transition-colors text-on-surface font-medium" 
                   />
                 </div>
               )}

               <button 
                 type="submit" 
                 disabled={loading}
                 className="w-full bg-primary text-on-primary font-bold h-12 rounded-lg flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 mt-6"
               >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : isResetting ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Sign Up'}
               </button>
            </form>

            {isLogin && !isResetting && (
               <div className="mt-4 text-center">
                 <button 
                   type="button" 
                   onClick={() => { setIsResetting(true); setError(null); setMessage(null); }}
                   className="text-primary text-sm font-medium hover:underline"
                 >
                   Forgot Password?
                 </button>
               </div>
            )}

           <div className="mt-8 text-center flex flex-col gap-2">
             {!isResetting && (
               <button 
                 type="button" 
                 onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); setIsResetting(false); }}
                 className="text-secondary text-sm font-bold tracking-wide hover:underline"
               >
                 {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
               </button>
             )}
             {isResetting && (
               <button 
                 type="button" 
                 onClick={() => { setIsLogin(true); setError(null); setMessage(null); setIsResetting(false); }}
                 className="text-secondary text-sm font-bold tracking-wide hover:underline"
               >
                 Back to Sign in
               </button>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
