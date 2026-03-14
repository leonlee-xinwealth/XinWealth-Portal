import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface PDPAStepProps {
    pdpaAccepted: boolean;
    updateData: (data: any) => void;
    onNext: () => void;
}

const PDPAStep: React.FC<PDPAStepProps> = ({ pdpaAccepted, updateData, onNext }) => {
    
    const handleAccept = () => {
        updateData({ pdpaAccepted: true });
        onNext();
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 border-b border-gray-100 px-8 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="text-xin-blue bg-blue-50 p-1.5 rounded-full">
                        <ShieldCheck size={24} />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">PDPA Consent</h2>
                </div>
                <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
                    <X size={20} />
                    <span className="text-sm font-medium">Close</span>
                </button>
            </div>

            {/* Content Body */}
            <div className="p-8 lg:p-12 text-gray-700 leading-relax">
                
                <p className="mb-6 text-[15px]">
                    <span className="font-semibold text-gray-800">XinWealth Portal</span> is a comprehensive financial planning software engaged by <strong className="text-xin-blue">XinWealth Advisory</strong>, a licensed and regulated financial advisory firm. It is designed to create a collaborative financial planning experience.
                </p>

                <p className="mb-6 text-[15px]">
                    By clicking on "<strong>We Accept</strong>", you are deemed to consent to the collection, use and disclosure of your personal data by Financial Advisor from <strong>XinWealth Advisory</strong> to conduct the following purposes:
                </p>

                <ul className="list-disc pl-6 space-y-3 mb-10 text-[15px] text-gray-600">
                    <li>Perform a holistic review of your financial portfolio</li>
                    <li>Send you marketing information about products and service</li>
                    <li>Comply with any applicable laws, regulations, codes of practice, guidelines, or rules, or to assist in law enforcement and investigations conducted by any government and/or regulatory authority</li>
                    <li>Notify you of any marketing events, initiatives and promotions, lucky draws, membership and rewards schemes and other promotions</li>
                </ul>

                <div className="flex justify-center mt-12 mb-4">
                    <button 
                        onClick={handleAccept}
                        className="px-10 py-3 bg-xin-blue text-white font-medium rounded-md hover:bg-blue-800 transition-colors shadow-sm"
                    >
                        I Accept
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PDPAStep;
