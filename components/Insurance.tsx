import React from 'react';
import { Shield, Clock } from 'lucide-react';

const Insurance: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-fade-in-up px-4">
       
       <div className="relative mb-12 animate-float-slow">
         <div className="w-32 h-32 bg-xin-blue rounded-3xl rotate-12 absolute inset-0 opacity-10"></div>
         <div className="w-32 h-32 bg-white rounded-3xl shadow-2xl flex items-center justify-center relative z-10 border border-slate-50">
            <Shield className="text-xin-gold w-14 h-14" strokeWidth={1.5} />
         </div>
       </div>

       <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-xin-gold mb-4">
         Feature Unavailable
       </p>

       <h2 className="text-5xl lg:text-7xl font-black text-xin-blue tracking-tighter font-serif mb-6">
         Coming Soon
       </h2>

       <p className="max-w-md text-slate-500 leading-relaxed text-lg font-light mb-12">
         We are currently integrating with our insurance partners to bring your policy details directly to your dashboard. Stay tuned for updates.
       </p>

       <button className="bg-xin-blue text-white px-10 py-4 rounded-full text-sm font-bold tracking-[0.2em] uppercase hover:bg-xin-blueLight transition-all shadow-2xl shadow-xin-blue/30 hover:-translate-y-1 active:scale-95 flex items-center gap-3">
         <Clock size={16} />
         <span>Notify Me</span>
       </button>

    </div>
  );
};

export default Insurance;