import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { LayoutDashboard, Users, Settings, LogOut, Menu, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const AdvisorLayout: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/advisor/login');
  }

  const navItems = [
    { to: '/advisor/dashboard', icon: <LayoutDashboard size={18} />, label: language === 'zh' ? '主页' : 'Dashboard' },
    { to: '/advisor/clients', icon: <Users size={18} />, label: language === 'zh' ? '客户' : 'Clients' },
    { to: '/advisor/settings', icon: <Settings size={18} />, label: language === 'zh' ? '设置' : 'Settings' },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <h1 className="font-serif text-2xl font-bold text-white tracking-tighter">
          Xin<span className="text-xin-gold">Wealth</span>
        </h1>
        <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mt-1">Advisor Portal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to} to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-xin-gold/20 text-xin-gold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-white/10 space-y-2">
        {/* Language toggle */}
        <div className="flex gap-2 px-1 mb-2">
          {(['en', 'zh'] as const).map(l => (
            <button key={l} onClick={() => setLanguage(l)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                language === l ? 'bg-xin-gold text-xin-blue' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {l === 'en' ? 'EN' : '中'}
            </button>
          ))}
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all"
        >
          <LogOut size={18} />
          {language === 'zh' ? '登出' : 'Log Out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-xin-bg">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-xin-blue shrink-0 fixed h-full z-10">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-56 bg-xin-blue flex flex-col">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-56 min-h-screen">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-xin-blue">
          <h1 className="font-serif text-xl font-bold text-white">Xin<span className="text-xin-gold">Wealth</span></h1>
          <button onClick={() => setSidebarOpen(true)} className="text-white">
            <Menu size={24} />
          </button>
        </div>
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdvisorLayout;
