import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';

interface WelcomeStepProps {
    onNext: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
    return (
        <div className="flex flex-col lg:flex-row gap-8 bg-transparent">
            {/* Left Content Area */}
            <div className="flex-1 bg-white p-8 lg:p-12 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-serif text-xin-blue mb-8">Welcome</h1>
                
                <div className="space-y-4 text-gray-700 leading-relaxed mb-10">
                    <p>Good job for securing your Complimentary 1 on 1 30min session with us.</p>
                    <p>Now your next step is to take a few minutes to fill up the following digital financial questionnaire. This can help us (You and me) to prepare for a productive meeting.</p>
                    <p>The information will be kept private and confidential and would only be used for the discussion when we meet.</p>
                    <p>By providing the information before the meeting, we could spend more time during the meeting with the analysis rather than data entry.</p>
                    
                    <div className="mt-6 mb-6">
                        <p>Remarks:</p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>You may enter " Total Investment value " under <i>*Other Assets*</i> ;</li>
                            <li>You may enter " Monthly payable insurance premium (yourself) " under <i>*Miscellaneous expenses*</i>.</li>
                        </ul>
                    </div>

                    <p>Look forward to meeting you soon.</p>
                    <div className="mt-6">
                        <p>Regards,</p>
                        <p className="font-semibold text-xin-blue mt-1">XinWealth Advisory Team</p>
                        <p className="text-sm text-gray-500">support@xinwealth.com</p>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg gap-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-xin-blue text-white rounded-full p-1 mt-0.5">
                            <CheckCircle size={16} />
                        </div>
                        <p className="text-sm text-gray-600 leading-snug">
                            Your information will be kept private and confidential and would only be used for the provision of financial advisory services.
                        </p>
                    </div>
                    <button 
                        onClick={onNext}
                        className="whitespace-nowrap px-6 py-2.5 bg-xin-blue text-white font-medium rounded-md hover:bg-blue-800 transition-colors shadow-sm"
                    >
                        LET'S BEGIN
                    </button>
                </div>
            </div>

            {/* Right Information Box */}
            <div className="w-full lg:w-80 flex flex-col gap-6">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-center mb-6">
                        {/* Placeholder for Illustration */}
                        <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                             <span className="text-5xl">📋</span>
                        </div>
                    </div>
                    
                    <h3 className="font-semibold text-sm tracking-wide text-gray-800 mb-4 uppercase">Data Needed For Financial Analysis</h3>
                    <ul className="space-y-3 mb-8">
                        {['Basic Information', 'Income', 'Assets', 'Liabilities', 'Expenses', 'Investments'].map((item, i) => (
                            <li key={i} className="flex items-center gap-2 text-gray-600 text-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                {item}
                            </li>
                        ))}
                    </ul>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                        <span className="text-sm text-gray-600">Estimated time to complete</span>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
                            <Clock size={14} className="text-gray-500" />
                            <span className="font-medium text-sm">15 min</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeStep;
