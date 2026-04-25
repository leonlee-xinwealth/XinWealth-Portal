import React, { useState, Suspense, lazy } from 'react';
import Sidebar from './Sidebar';
import Login from './Login';
import Register from './Register';
import { ViewState } from '../types';
import { getSession, clearSession } from '../services/apiService';
import { Menu, Loader2 } from 'lucide-react';

const Investment = lazy(() => import('./Investment'));
const Player = lazy(() => import('./Player'));
const Insurance = lazy(() => import('./Insurance'));
const FinancialHealthCheck = lazy(() => import('./FinancialHealthCheck'));
const Tax = lazy(() => import('./Tax'));
const FinancialGoal = lazy(() => import('./FinancialGoal'));
const NetWorth = lazy(() => import('./NetWorth'));
const Cashflow = lazy(() => import('./Cashflow'));
const Retirement = lazy(() => import('./Retirement'));

const PortalLayout: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.PLAYER);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearSession();
    setIsAuthenticated(false);
    setCurrentView(ViewState.PLAYER);
  };

  const renderContent = () => {
    switch (currentView) {
      case ViewState.PLAYER:
        return <Player />;
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
      case ViewState.CASHFLOW:
        return <Cashflow />;
      case ViewState.RETIREMENT:
        return <Retirement />;
      default:
        return <Investment />;
    }
  };

  if (!isAuthenticated) {
    if (showRegister) {
      return <Register onNavigateToLogin={() => setShowRegister(false)} />;
    }
    return <Login onLoginSuccess={handleLoginSuccess} onNavigateToRegister={() => setShowRegister(true)} />;
  }

  const session = getSession();
  const userName = session?.familyName || session?.givenName 
    ? `${session?.familyName || ''} ${session?.givenName || ''}`.trim() 
    : session?.name || 'Client';

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
          {/* Global Welcome Message */}
          <div className="mb-8 flex items-center justify-between">
              <h2 className="text-2xl lg:text-3xl font-serif font-bold text-xin-blue">Welcome, {userName}</h2>
          </div>

          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[50vh]">
              <Loader2 className="w-8 h-8 animate-spin text-xin-blue" />
            </div>
          }>
            {renderContent()}
          </Suspense>
        </div>

      </main>
    </div>
  );
};

export default PortalLayout;
