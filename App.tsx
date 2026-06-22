import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import AdvisorApp from './components/advisor/AdvisorApp';

const PortalLayout = lazy(() => import('./components/PortalLayout'));
const KYCLayout = lazy(() => import('./components/kyc/KYCLayout'));
const PrsPublicPage = lazy(() => import('./components/prs/PrsPublicPage'));
// 一次性营销活动落地页（活动结束后连同 components/landing/ 与 api/wealth-awakening-lead.js 一并删除）
const WealthAwakeningPage = lazy(() => import('./components/landing/WealthAwakeningPage'));

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

            {/* PRS public client form (token link) */}
            <Route path="/prs/:token" element={<PrsPublicPage />} />

            {/* 一次性营销活动：财富觉醒·上帝视角（主路径 /projectXWOS，保留旧别名） */}
            <Route path="/projectXWOS" element={<WealthAwakeningPage />} />
            <Route path="/wealth-awakening" element={<WealthAwakeningPage />} />

            {/* Client Portal */}
            <Route path="/*" element={<PortalLayout />} />
          </Routes>
        </Suspense>
      </Router>
    </LanguageProvider>
  );
};

export default App;
