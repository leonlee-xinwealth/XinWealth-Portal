import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface PDPAStepProps {
    pdpaAccepted: boolean;
    updateData: (data: any) => void;
    onNext: () => void;
    onClose: () => void;
}

const PDPAStep: React.FC<PDPAStepProps> = ({ pdpaAccepted, updateData, onNext, onClose }) => {
    
    const handleAccept = () => {
        updateData({ pdpaAccepted: true });
        onNext();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-slate-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="text-xin-blue bg-blue-50 p-1.5 rounded-full">
                            <ShieldCheck size={24} />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-800">PDPA Consent</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors p-1"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-6 md:p-8 text-gray-700 leading-relaxed max-h-[70vh] overflow-y-auto">
                    
                    <p className="mb-4 text-[15px]">
                        <span className="font-semibold text-gray-800">XinWealth Portal</span> is a comprehensive financial planning software engaged by <strong className="text-xin-blue">XinWealth Advisory</strong>, a licensed and regulated financial advisory firm. It is designed to create a collaborative financial planning experience.
                    </p>

                    <p className="mb-4 text-[15px]">
                        By clicking on "<strong>We Accept</strong>", you are deemed to consent to the collection, use and disclosure of your personal data by Financial Advisor from <strong>XinWealth Advisory</strong> to conduct the following purposes:
                    </p>

                    <ul className="list-disc pl-6 space-y-2 mb-8 text-[15px] text-gray-600">
                        <li>Perform a holistic review of your financial portfolio</li>
                        <li>Send you marketing information about products and service</li>
                        <li>Comply with any applicable laws, regulations, codes of practice, guidelines, or rules, or to assist in law enforcement and investigations conducted by any government and/or regulatory authority</li>
                        <li>Notify you of any marketing events, initiatives and promotions, lucky draws, membership and rewards schemes and other promotions</li>
                    </ul>

                    <div className="flex justify-center mt-8">
                        <button 
                            onClick={handleAccept}
                            className="px-10 py-3 bg-xin-blue text-white font-medium rounded-md hover:bg-blue-800 transition-colors shadow-sm w-full md:w-auto"
                        >
                            I Accept
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PDPAStep;
