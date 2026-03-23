import React, { useState } from 'react';
import { KYCData, initialKYCData } from '../../types';
import WelcomeStep from './steps/WelcomeStep';
import PDPAStep from './steps/PDPAStep';
import BasicInfoStep from './steps/BasicInfoStep';
import IncomeStep from './steps/IncomeStep';
import AssetsStep from './steps/AssetsStep';
import LiabilitiesStep from './steps/LiabilitiesStep';
import ExpensesStep from './steps/ExpensesStep';
import InvestmentsStep from './steps/InvestmentsStep';
import ReviewSummaryStep from './steps/ReviewSummaryStep';
import { useLanguage } from '../../context/LanguageContext';
import { submitKYC } from '../../services/larkService';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

// Placeholder steps
const PlaceholderStep = ({ title, onNext, onPrev }: { title: string, onNext: () => void, onPrev: () => void }) => (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
        <h2 className="text-2xl font-serif text-xin-blue mb-4">{title}</h2>
        <div className="flex-1 text-gray-500 py-12 text-center">Form fields for {title} will be implemented here.</div>
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between">
            <button onClick={onPrev} className="px-6 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors">Back</button>
            <button onClick={onNext} className="px-6 py-2 bg-xin-blue text-white rounded-md hover:bg-xin-dark transition-colors">Continue</button>
        </div>
    </div>
);

export const STEPS = [
    { id: 'welcome', labelKey: 'nav.welcome', showNav: false },
    { id: 'basic', labelKey: 'nav.basic', showNav: true },
    { id: 'income', labelKey: 'nav.income', showNav: true },
    { id: 'assets', labelKey: 'nav.assets', showNav: true },
    { id: 'liabilities', labelKey: 'nav.liabilities', showNav: true },
    { id: 'expenses', labelKey: 'nav.expenses', showNav: true },
    { id: 'investments', labelKey: 'nav.investments', showNav: true },
    { id: 'review', labelKey: 'nav.review', showNav: true },
];

const KYCStepper: React.FC = () => {
    const { t, language } = useLanguage();
    const isZh = language === 'zh';
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [formData, setFormData] = useState<KYCData>(initialKYCData);
    const [showPDPAModal, setShowPDPAModal] = useState(false);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleNext = () => {
        const currentStep = STEPS[currentStepIndex];
        
        // If we are on welcome step, intercept and show PDPA modal
        if (currentStep.id === 'welcome' && !formData.pdpaAccepted) {
            setShowPDPAModal(true);
            return;
        }

        if (currentStepIndex < STEPS.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            // Submit form
            submitForm();
        }
    };

    const submitForm = async () => {
        setStatus('submitting');
        setError(null);
        try {
            await submitKYC(formData);
            setStatus('success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            setStatus('error');
            setError(err.message || 'Failed to submit form. Please check your connection and try again.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleNavigateToStep = (stepId: string) => {
        const index = STEPS.findIndex(s => s.id === stepId);
        if (index !== -1) {
            setCurrentStepIndex(index);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const updateFormData = (data: Partial<KYCData>) => {
        setFormData(prev => ({ ...prev, ...data }));
    };

    const handleAcceptPDPA = () => {
        updateFormData({ pdpaAccepted: true });
        setShowPDPAModal(false);
        // Automatically go to next step after accepting
        setCurrentStepIndex(1); // 1 is Basic Info
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const currentStep = STEPS[currentStepIndex];

    const renderStepContent = () => {
        switch (currentStep.id) {
            case 'welcome':
                return <WelcomeStep onNext={handleNext} />;
            case 'basic':
                return <BasicInfoStep formData={formData} updateData={updateFormData} onNext={handleNext} onPrev={handlePrev} />;
            case 'income':
                return <IncomeStep formData={formData} updateData={updateFormData} onNext={handleNext} onPrev={handlePrev} />;
            case 'assets':
                return <AssetsStep formData={formData} updateData={updateFormData} onNext={handleNext} onPrev={handlePrev} />;
            case 'liabilities':
                return <LiabilitiesStep formData={formData} updateData={updateFormData} onNext={handleNext} onPrev={handlePrev} />;
            case 'expenses':
                return <ExpensesStep formData={formData} updateData={updateFormData} onNext={handleNext} onPrev={handlePrev} />;
            case 'investments':
                return <InvestmentsStep formData={formData} updateData={updateFormData} onNext={handleNext} onPrev={handlePrev} />;
            case 'review':
                return <ReviewSummaryStep formData={formData} onEditStep={handleNavigateToStep} onNext={handleNext} onPrev={handlePrev} />;
            default:
                return <div>Unknown Step</div>;
        }
    };

    return (
        <div className={`flex flex-col lg:flex-row gap-8 items-start`}>
            
            {/* Main Form Content */}
            <div className={`w-full ${currentStep.showNav ? 'lg:w-[70%]' : (currentStep.id === 'welcome' ? 'max-w-5xl mx-auto' : 'lg:w-full')} transition-all duration-300`}>
                {status === 'success' ? (
                    <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center animate-in zoom-in duration-500">
                        <div className="flex justify-center mb-6">
                            <div className="bg-green-50 p-4 rounded-full text-green-500">
                                <CheckCircle2 size={64} />
                            </div>
                        </div>
                        <h2 className="text-3xl font-serif text-gray-800 mb-4">{isZh ? '提交成功' : 'Submission Successful'}</h2>
                        <p className="text-gray-600 mb-8 max-w-md mx-auto">
                            {isZh ? '感謝您填寫 KYC 表格。我們的顧問將很快與您聯繫。' : 'Thank you for completing the KYC form. Our advisors will be in touch with you shortly.'}
                        </p>
                        <button 
                            onClick={() => window.location.href = '/'}
                            className="px-8 py-3 bg-xin-blue text-white rounded-md font-medium hover:bg-xin-dark transition-all shadow-md"
                        >
                            {isZh ? '返回主頁' : 'Return to Home'}
                        </button>
                    </div>
                ) : status === 'submitting' ? (
                    <div className="bg-white p-20 rounded-xl shadow-sm border border-gray-100 text-center">
                        <div className="flex justify-center mb-6">
                            <Loader2 size={48} className="text-xin-blue animate-spin" />
                        </div>
                        <h2 className="text-2xl font-serif text-gray-800 mb-2">{isZh ? '正在提交...' : 'Submitting...'}</h2>
                        <p className="text-gray-500">{isZh ? '請稍候，我們正在將您的資料保存至數據庫。' : 'Please wait while we save your information to our database.'}</p>
                    </div>
                ) : (
                    <>
                        {status === 'error' && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 animate-in slide-in-from-top duration-300">
                                <AlertCircle className="mt-0.5 shrink-0" size={20} />
                                <div>
                                    <p className="font-semibold">{isZh ? '提交失敗' : 'Submission Failed'}</p>
                                    <p className="text-sm opacity-90">{error}</p>
                                </div>
                                <button onClick={() => setStatus('idle')} className="ml-auto text-xs font-bold uppercase tracking-wider">{isZh ? '關閉' : 'Close'}</button>
                            </div>
                        )}
                        {renderStepContent()}
                    </>
                )}
            </div>

            {/* Right Sidebar Navigation (Only visible on certain steps) */}
            {currentStep.showNav && (
                <div className="w-full lg:w-[30%] bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-24 hidden lg:block">
                    <h3 className="text-gray-500 font-semibold text-xs tracking-wider uppercase mb-6">Navigation</h3>
                    <div className="space-y-4 relative">
                        {/* Connecting Line */}
                        <div className="absolute left-[11px] top-4 bottom-4 w-[2px] bg-gray-100 z-0"></div>
                        
                        {STEPS.filter(s => s.showNav).map((step, idx) => {
                            const isPast = currentStepIndex > STEPS.findIndex(s => s.id === step.id);
                            const isCurrent = step.id === currentStep.id;
                            
                            return (
                                <div key={step.id} className="flex items-center gap-4 relative z-10">
                                    <div className={`w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center bg-white ${isPast ? 'border-green-500' : isCurrent ? 'border-xin-blue' : 'border-gray-300'}`}>
                                        {isPast && <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>}
                                        {isCurrent && <div className="w-2.5 h-2.5 rounded-full bg-xin-blue"></div>}
                                    </div>
                                    <span className={`text-sm ${isCurrent ? 'text-xin-blue font-semibold' : 'text-gray-500'}`}>
                                        {t(step.labelKey)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* PDPA Modal */}
            {showPDPAModal && (
                <PDPAStep 
                    pdpaAccepted={formData.pdpaAccepted} 
                    updateData={updateFormData} 
                    onNext={handleAcceptPDPA} 
                    onClose={() => setShowPDPAModal(false)}
                />
            )}
        </div>
    );
};

export default KYCStepper;
