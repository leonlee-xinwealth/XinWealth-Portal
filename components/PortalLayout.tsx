import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Investment from './Investment';
import Insurance from './Insurance';
import FinancialHealthCheck from './FinancialHealthCheck';
import Tax from './Tax';
import FinancialGoal from './FinancialGoal';
import NetWorth from './NetWorth';
import Login from './Login';
import { ViewState } from '../types';
import { clearSession } from '../services/larkService';
import { Menu } from 'lucide-react';

const PortalLayout: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.INVESTMENT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearSession();
    setIsAuthenticated(false);
    setCurrentView(ViewState.INVESTMENT);
  };

  const renderContent = () => {
    switch (currentView) {
      case ViewState.INVESTMENT:
        return <Investment />;
      case ViewState.INSURANCE:
        return <Insurance />;
      case ViewState.HEALTH_CHECK:
        return <FinancialHealthCheck />;
      case ViewState.TAX:
        return <Tax />;
      case ViewState.FINANCIAL_GOAL:
        return <FinancialGoal />;
      case ViewState.NET_WORTH:
        return <NetWorth />;
      default:
        return <Investment />;
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex min-h-screen bg-xin-bg font-sans selection:bg-xin-gold selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-10 lg:ml-0 overflow-x-hidden relative">
        
        {/* Mobile Header Toggle */}
        <div className="lg:hidden flex items-center justify-between mb-8 pt-2">
            <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-xin-blue rounded-lg flex items-center justify-center">
                    <span className="text-xin-gold font-bold font-serif text-sm">X</span>
                 </div>
                 <span className="font-serif font-bold text-xin-blue text-lg">XinWealth</span>
            </div>
            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-xin-blue hover:bg-slate-100 rounded-lg transition-colors"
            >
                <Menu size={24} />
            </button>
        </div>

        {/* Dynamic View Content */}
        <div className="max-w-7xl mx-auto">
            {renderContent()}
        </div>

      </main>
    </div>
  );
};

export default PortalLayout;
