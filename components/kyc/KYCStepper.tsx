import React, { useState } from 'react';
import { KYCData, initialKYCData } from '../../types';
import WelcomeStep from './steps/WelcomeStep';
import PDPAStep from './steps/PDPAStep';
import BasicInfoStep from './steps/BasicInfoStep';

// Placeholder steps
const PlaceholderStep = ({ title, onNext, onPrev }: { title: string, onNext: () => void, onPrev: () => void }) => (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
        <h2 className="text-2xl font-serif text-xin-blue mb-4">{title}</h2>
        <div className="flex-1 text-gray-500 py-12 text-center">Form fields for {title} will be implemented here.</div>
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between">
            <button onClick={onPrev} className="px-6 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors">Back</button>
            <button onClick={onNext} className="px-6 py-2 bg-xin-blue text-white rounded-md hover:bg-blue-800 transition-colors">Continue</button>
        </div>
    </div>
);

export const STEPS = [
    { id: 'welcome', label: 'Welcome', showNav: false },
    { id: 'basic', label: 'Basic Information', showNav: true },
    { id: 'income', label: 'Income', showNav: true },
    { id: 'assets', label: 'Assets', showNav: true },
    { id: 'liabilities', label: 'Liabilities', showNav: true },
    { id: 'expenses', label: 'Expenses', showNav: true },
    { id: 'investments', label: 'Investments', showNav: true },
    { id: 'review', label: 'Review Summary', showNav: true },
];

const KYCStepper: React.FC = () => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [formData, setFormData] = useState<KYCData>(initialKYCData);
    const [showPDPAModal, setShowPDPAModal] = useState(false);

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
            console.log("Submitting:", formData);
            alert("Form completely submitted! (Integration with Lark pending)");
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
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
                return <PlaceholderStep title="Income" onNext={handleNext} onPrev={handlePrev} />;
            case 'assets':
                return <PlaceholderStep title="Assets" onNext={handleNext} onPrev={handlePrev} />;
            case 'liabilities':
                return <PlaceholderStep title="Liabilities" onNext={handleNext} onPrev={handlePrev} />;
            case 'expenses':
                return <PlaceholderStep title="Expenses" onNext={handleNext} onPrev={handlePrev} />;
            case 'investments':
                return <PlaceholderStep title="Investments" onNext={handleNext} onPrev={handlePrev} />;
            case 'review':
                return <PlaceholderStep title="Review Summary" onNext={handleNext} onPrev={handlePrev} />;
            default:
                return <div>Unknown Step</div>;
        }
    };

    return (
        <div className={`flex flex-col lg:flex-row gap-8 items-start`}>
            
            {/* Main Form Content */}
            <div className={`w-full ${currentStep.showNav ? 'lg:w-[70%]' : (currentStep.id === 'welcome' ? 'max-w-5xl mx-auto' : 'lg:w-full')} transition-all duration-300`}>
                {renderStepContent()}
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
                                        {step.label}
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
