import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const PortalLayout = lazy(() => import('./components/PortalLayout'));
const KYCLayout = lazy(() => import('./components/kyc/KYCLayout'));

const App: React.FC = () => {
  return (
    <Router>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-xin-bg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xin-blue"></div>
        </div>
      }>
        <Routes>
          {/* Public Route for Fact Finder Form */}
          <Route path="/kyc/*" element={<KYCLayout />} />
          
          {/* Protected Dashboard Route */}
          <Route path="/*" element={<PortalLayout />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;