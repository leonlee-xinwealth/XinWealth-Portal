import React from 'react';
import { ViewState } from '../types';
import { 
  PieChart, 
  ShieldCheck, 
  Activity, 
  LogOut, 
  Menu, 
  X, 
  Calculator,
  Target
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, setIsOpen, onLogout }) => {
  
  const navItems = [
    { id: ViewState.INVESTMENT, label: 'Portfolio', icon: PieChart },
    { id: ViewState.INSURANCE, label: 'Insurance', icon: ShieldCheck },
    { id: ViewState.HEALTH_CHECK, label: 'Financial Health', icon: Activity },
    { id: ViewState.TAX, label: 'Tax', icon: Calculator },
    { id: ViewState.FINANCIAL_GOAL, label: 'Financial Goal', icon: Target },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-xin-blue/50 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar Container */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[280px] bg-white border-r border-slate-100
          flex flex-col justify-between py-10 px-6
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          shadow-2xl lg:shadow-none
        `}
      >
        <div>
          {/* Logo Area */}
          <div className="flex items-center justify-between mb-16 px-2">
            <div>
                <h1 className="font-serif text-3xl font-bold text-xin-blue tracking-tighter">Xin<span className="text-xin-gold">Wealth</span></h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold mt-1">Client Portal</p>
            </div>
            <button className="lg:hidden text-xin-blue" onClick={() => setIsOpen(false)}>
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="space-y-4">
            {navItems.map((item) => {
              const isActive = currentView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group
                    ${isActive 
                      ? 'bg-xin-blue text-white shadow-xl shadow-xin-blue/20' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-xin-blue'}
                  `}
                >
                  <Icon 
                    size={20} 
                    className={`transition-colors ${isActive ? 'text-xin-gold' : 'text-slate-400 group-hover:text-xin-blue'}`} 
                  />
                  <span className={`font-medium tracking-wide ${isActive ? 'font-bold' : ''}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer / User */}
        <div className="px-2">
           <div className="p-6 bg-xin-bg rounded-3xl border border-slate-100 mb-6">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">My Advisor</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-xin-gold flex items-center justify-center text-xin-blue font-bold font-serif">
                  JD
                </div>
                <div>
                  <p className="text-sm font-bold text-xin-blue">John Doe</p>
                  <p className="text-xs text-slate-500">Wealth Manager</p>
                </div>
              </div>
           </div>
           
           <button 
             onClick={onLogout}
             className="w-full flex items-center gap-3 text-slate-400 hover:text-red-500 transition-colors px-4 text-sm font-medium"
           >
             <LogOut size={16} />
             <span>Sign Out</span>
           </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;