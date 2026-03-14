import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.welcome': 'Welcome',
    'nav.basic': 'Basic Information',
    'nav.income': 'Income',
    'nav.assets': 'Assets',
    'nav.liabilities': 'Liabilities',
    'nav.expenses': 'Expenses',
    'nav.investments': 'Investments',
    'nav.review': 'Review Summary',
    'header.services': 'Financial Advisory Services',
    'welcome.title': 'Welcome to XinWealth',
    'welcome.subtitle': 'To provide you with the best financial advice, we need to understand your current situation.',
    'welcome.button': 'Get Started',
  },
  zh: {
    'nav.welcome': '欢迎',
    'nav.basic': '基本信息',
    'nav.income': '收入',
    'nav.assets': '资产 (Assets)',
    'nav.liabilities': '负债 (Liabilities)',
    'nav.expenses': '开销 (Expenses)',
    'nav.investments': '投资 (Investments)',
    'nav.review': '检查确认',
    'header.services': '财务咨询服务',
    'welcome.title': '欢迎来到 XinWealth',
    'welcome.subtitle': '为了给您提供最好的财务建议，我们需要了解您的当前状况。',
    'welcome.button': '开始填写',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
