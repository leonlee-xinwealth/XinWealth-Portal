import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import KYCStepper from './KYCStepper';
import { LanguageProvider, useLanguage } from '../../context/LanguageContext';

const KYCLayoutContent: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

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
        
        <div className="flex items-center gap-6">
            <div className="text-sm font-medium text-gray-400 hidden sm:block">
                {t('header.services')}
            </div>
            {/* Language Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button 
                    onClick={() => setLanguage('en')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${language === 'en' ? 'bg-white text-xin-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    EN
                </button>
                <button 
                    onClick={() => setLanguage('zh')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${language === 'zh' ? 'bg-white text-xin-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    中文
                </button>
            </div>
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

const KYCLayout: React.FC = () => {
    return (
        <LanguageProvider>
            <KYCLayoutContent />
        </LanguageProvider>
    );
};

export default KYCLayout;
