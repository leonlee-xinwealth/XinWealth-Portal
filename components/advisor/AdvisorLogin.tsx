import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Mail, Lock, Loader2 } from 'lucide-react';

interface Props { onLoginSuccess: () => void; }

const AdvisorLogin: React.FC<Props> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-xin-blue rounded-b-[4rem] z-0"></div>
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-xin-gold opacity-10 rounded-full blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl font-bold text-xin-blue tracking-tighter mb-2">
            Xin<span className="text-xin-gold">Wealth</span>
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold">Advisor Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Email</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-300 group-focus-within:text-xin-gold transition-colors" />
              </div>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold text-xin-blue placeholder-slate-400 font-medium"
                placeholder="advisor@xinwealth.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-300 group-focus-within:text-xin-gold transition-colors" />
              </div>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold text-xin-blue placeholder-slate-400 font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-4 bg-xin-blue text-white font-bold rounded-2xl hover:bg-xin-blueLight transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdvisorLogin;
