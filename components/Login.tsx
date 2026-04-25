import React, { useState } from 'react';
import { authenticateUser } from '../services/apiService';
import { ArrowRight, Lock, Mail, Loader2 } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await authenticateUser(email, password);
      onLoginSuccess();
    } catch (err: any) {
      // 显示具体的错误信息，方便排查
      console.error("Login failed:", err);
      setError(err.message || 'Login failed. Please check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-xin-blue rounded-b-[4rem] z-0"></div>
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-xin-gold opacity-10 rounded-full blur-3xl animate-float-slow"></div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl animate-fade-in-up">
        
        <div className="text-center mb-10">
            <h1 className="font-serif text-4xl font-bold text-xin-blue tracking-tighter mb-2">Xin<span className="text-xin-gold">Wealth</span></h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold">Client Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-xin-blue uppercase tracking-widest ml-2">Email Address</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-300 group-focus-within:text-xin-gold transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue placeholder-slate-400 font-medium"
                placeholder="client@xinwealth.com"
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold transition-all text-xin-blue placeholder-slate-400 font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-500 text-sm font-medium flex items-center gap-2 break-words">
              <span className="shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-xin-blue text-white py-5 rounded-2xl text-sm font-bold tracking-[0.2em] uppercase hover:bg-xin-blueLight transition-all shadow-xl shadow-xin-blue/20 hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center space-y-3">
            <p className="text-sm text-slate-400 font-light">
              Existing clients only. Contact your financial advisor to obtain an account.
            </p>
        </div>
      </div>
      
    </div>
  );
};

export default Login;