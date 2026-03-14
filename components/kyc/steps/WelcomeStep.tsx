import React from 'react';
import { CheckCircle, Clock } from 'lucide-react';

interface WelcomeStepProps {
    onNext: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
    const { language } = useLanguage();

    const isZh = language === 'zh';

    return (
        <div className="flex flex-col lg:flex-row gap-8 bg-transparent">
            {/* Left Content Area */}
            <div className="flex-1 bg-white p-8 lg:p-12 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-serif text-xin-blue mb-8">
                    {isZh ? '欢迎' : 'Welcome'}
                </h1>
                
                <div className="space-y-4 text-gray-700 leading-relaxed mb-10">
                    <p>{isZh ? '干得好！您已成功预约我们的免费一对一30分钟咨询环节。' : 'Good job for securing your Complimentary 1 on 1 30min session with us.'}</p>
                    <p>{isZh ? '现在的下一步是花几分钟时间填写以下数字化财务问卷。这将帮助我们（您和我）为一次高效的会议做好准备。' : 'Now your next step is to take a few minutes to fill up the following digital financial questionnaire. This can help us (You and me) to prepare for a productive meeting.'}</p>
                    <p>{isZh ? '这些信息将被绝对保密，仅用于我们见面时的讨论。' : 'The information will be kept private and confidential and would only be used for the discussion when we meet.'}</p>
                    <p>{isZh ? '通过在会议前提供这些信息，我们可以在会议期间将更多时间用于分析，而不是输入数据。' : 'By providing the information before the meeting, we could spend more time during the meeting with the analysis rather than data entry.'}</p>
                    
                    <div className="mt-6 mb-6">
                        <p>{isZh ? '备注：' : 'Remarks:'}</p>
                        <ul className="list-disc pl-5 space-y-2 mt-2">
                            <li>{isZh ? '您可以在 *其他资产 (Other Assets)* 下输入“总投资价值 (Total Investment value)”；' : 'You may enter " Total Investment value " under *Other Assets* ;'}</li>
                            <li>{isZh ? '您可以在 *杂项 (Miscellaneous expenses)* 下输入“每月应付保险费（您自己）(Monthly payable insurance premium)”。' : 'You may enter " Monthly payable insurance premium (yourself) " under *Miscellaneous expenses*.'}</li>
                        </ul>
                    </div>

                    <p>{isZh ? '期待很快与您见面。' : 'Look forward to meeting you soon.'}</p>
                    <div className="mt-6">
                        <p>{isZh ? '祝好，' : 'Regards,'}</p>
                        <p className="font-semibold text-xin-blue mt-1">{isZh ? 'XinWealth 咨询团队' : 'XinWealth Advisory Team'}</p>
                        <p className="text-sm text-gray-500">support@xinwealth.com</p>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg gap-4">
                    <div className="flex items-start gap-3">
                        <div className="bg-xin-blue text-white rounded-full p-1 mt-0.5">
                            <CheckCircle size={16} />
                        </div>
                        <p className="text-sm text-gray-600 leading-snug">
                            {isZh 
                                ? '您的信息将被绝对保密，仅用于提供财务咨询服务。' 
                                : 'Your information will be kept private and confidential and would only be used for the provision of financial advisory services.'}
                        </p>
                    </div>
                    <button 
                        onClick={onNext}
                        className="whitespace-nowrap px-6 py-2.5 bg-gradient-to-r from-xin-blue to-xin-blueLight text-white font-medium rounded-md hover:from-xin-dark hover:to-xin-blue transition-colors shadow-sm"
                    >
                        {isZh ? '开始填写' : "LET'S BEGIN"}
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
                    
                    <h3 className="font-semibold text-sm tracking-wide text-gray-800 mb-4 uppercase">
                        {isZh ? '财务分析所需数据' : 'Data Needed For Financial Analysis'}
                    </h3>
                    <ul className="space-y-3 mb-8">
                        {[
                            isZh ? '基本信息 (Basic Information)' : 'Basic Information', 
                            isZh ? '收入 (Income)' : 'Income', 
                            isZh ? '资产 (Assets)' : 'Assets', 
                            isZh ? '负债 (Liabilities)' : 'Liabilities', 
                            isZh ? '开销 (Expenses)' : 'Expenses', 
                            isZh ? '投资 (Investments)' : 'Investments'
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-2 text-gray-600 text-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                {item}
                            </li>
                        ))}
                    </ul>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                        <span className="text-sm text-gray-600">
                            {isZh ? '预计完成时间' : 'Estimated time to complete'}
                        </span>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
                            <Clock size={14} className="text-gray-500" />
                            <span className="font-medium text-sm">
                                {isZh ? '15 分钟' : '15 min'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeStep;
