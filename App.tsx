import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import AdvisorApp from './components/advisor/AdvisorApp';

const PortalLayout = lazy(() => import('./components/PortalLayout'));
const KYCLayout = lazy(() => import('./components/kyc/KYCLayout'));

const Spinner = () => (
  <div className="flex h-screen items-center justify-center bg-xin-bg">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xin-blue"></div>
  </div>
);

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <Router>
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Advisor Portal */}
            <Route path="/advisor/*" element={<AdvisorApp />} />

            {/* Client KYC (Fact Finder) */}
            <Route path="/kyc/*" element={<KYCLayout />} />

            {/* Client Portal */}
            <Route path="/*" element={<PortalLayout />} />
          </Routes>
        </Suspense>
      </Router>
    </LanguageProvider>
  );
};

export default App;
