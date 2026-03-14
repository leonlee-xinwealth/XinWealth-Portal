import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import KYCStepper from './KYCStepper';

const KYCLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f4f7f9] font-sans selection:bg-xin-gold selection:text-white pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-xin-blue rounded-lg flex items-center justify-center">
                <span className="text-xin-gold font-bold font-serif text-sm">X</span>
            </div>
            <span className="font-serif font-bold text-xin-blue text-lg">XinWealth</span>
        </div>
        <div className="text-sm font-medium text-gray-400 hidden sm:block">
            Financial Advisory Services
        </div>
      </header>

      {/* Main Content Form area */}
      <main className="max-w-6xl mx-auto pt-8 px-4 md:px-8">
        <Routes>
          <Route path="/" element={<KYCStepper />} />
          <Route path="*" element={<Navigate to="/kyc" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default KYCLayout;
