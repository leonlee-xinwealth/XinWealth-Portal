import React, { useState } from 'react';
import { KYCData } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { DebouncedTextInput } from '../FormInputs';
import { checkEmailAvailable } from '../../../services/apiService';

interface BasicInfoStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const { t, language } = useLanguage();
    const isZh = language === 'zh';
    const [emailError, setEmailError] = useState<string | null>(null);
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);

    const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

    const handleContinue = async () => {
        const email = (formData.email || '').trim();
        setEmailError(null);

        if (!email) {
            setEmailError(isZh ? '请输入邮箱地址。' : 'Please enter your email address.');
            return;
        }
        if (!isValidEmail(email)) {
            setEmailError(isZh ? '邮箱格式不正确。' : 'That email format looks incorrect.');
            return;
        }

        setIsCheckingEmail(true);
        try {
            const result = await checkEmailAvailable(email);
            if (!result.available) {
                setEmailError(
                    isZh
                        ? '此邮箱已经登记过。如需更新资料，请联系您的理财顾问。'
                        : 'This email has already been registered. Please contact your financial advisor to update your information.'
                );
                return;
            }
            onNext();
        } catch (err: any) {
            setEmailError(err.message || (isZh ? '邮箱检查失败，请稍后再试。' : 'Email check failed. Please try again.'));
        } finally {
            setIsCheckingEmail(false);
        }
    };

    // Helper to render reusable toggle button groups
    const renderToggleGroup = (
        name: keyof KYCData, 
        options: { value: string, label: string }[], 
        currentValue: string
    ) => (
        <div className="flex flex-wrap shadow-sm rounded-md overflow-hidden bg-white mt-1 border border-gray-300 w-fit">
            {options.map((opt, idx) => {
                const isSelected = currentValue === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateData({ [name]: opt.value })}
                        className={`px-4 py-2 text-sm font-medium border-r border-gray-300 last:border-r-0 transition-colors ${
                            isSelected 
                                ? 'bg-slate-50 text-xin-blue font-semibold border-b-2 border-xin-cyan flex-grow-0' 
                                : 'text-gray-600 hover:bg-gray-50 flex-grow-0'
                        }`}
                        style={isSelected ? { boxShadow: 'inset 0 0 0 1px #00B4D8', zIndex: 1 } : {}}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );

    const inputClasses = "w-full mt-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan transition-colors bg-white shadow-sm";
    const labelClasses = "block text-sm font-medium text-gray-700 font-sans";
    const requiredSpan = <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span>;
    const optionalSpan = <span className="text-gray-400 italic font-normal text-xs ml-2">{isZh ? '选填' : 'Optional'}</span>;

    const salutationOptions = [
        { value: 'Mr', label: isZh ? '先生 (Mr)' : 'Mr' },
        { value: 'Ms', label: isZh ? '女士 (Ms)' : 'Ms' },
        { value: 'Mdm', label: isZh ? '夫人 (Mdm)' : 'Mdm' },
        { value: 'Mrs', label: isZh ? '太太 (Mrs)' : 'Mrs' },
        { value: 'Dr', label: isZh ? '博士/医生 (Dr)' : 'Dr' }
    ];

    const employmentOptions = [
        { value: 'Employed', label: isZh ? '受雇 (Employed)' : 'Employed' },
        { value: 'Self-Employed', label: isZh ? '自雇 (Self-Employed)' : 'Self-Employed' },
        { value: 'Unemployed', label: isZh ? '待业 (Unemployed)' : 'Unemployed' },
        { value: 'Retired', label: isZh ? '退休 (Retired)' : 'Retired' }
    ];

    const taxOptions = [
        { value: 'Tax-Resident', label: isZh ? '税务居民 (Tax-Resident)' : 'Tax-Resident' },
        { value: 'Non Resident', label: isZh ? '非居民 (Non Resident)' : 'Non Resident' },
        { value: 'Not Taxable', label: isZh ? '免税 (Not Taxable)' : 'Not Taxable' }
    ];

    return (
        <div className="flex flex-col h-full space-y-8">
            {/* Form Box */}
            <div className="bg-white p-6 lg:p-10 rounded-xl shadow-sm border border-gray-100 pb-12">
                
                {/* Profile Section */}
                <h2 className="text-2xl font-serif text-gray-800 mb-6 border-b border-gray-100 pb-4">
                    {t('basic.title')}
                </h2>
                
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>{t('basic.familyName')} {requiredSpan}</label>
                            <DebouncedTextInput 
                                type="text" 
                                className={inputClasses}
                                value={formData.familyName}
                                onChange={(val) => updateData({ familyName: val })}
                                placeholder="---"
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>{t('basic.givenName')} {requiredSpan}</label>
                            <DebouncedTextInput 
                                type="text" 
                                className={inputClasses}
                                value={formData.givenName}
                                onChange={(val) => updateData({ givenName: val })}
                                placeholder="---"
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>{t('basic.salutation')} {requiredSpan}</label>
                        {renderToggleGroup('salutation', salutationOptions, formData.salutation)}
                    </div>

                    <div>
                        <label className={labelClasses}>{t('basic.email')} {requiredSpan}</label>
                        <DebouncedTextInput
                            type="email"
                            className={inputClasses}
                            value={formData.email}
                            onChange={(val) => { updateData({ email: val }); setEmailError(null); }}
                            placeholder="e.g. client@example.com"
                        />
                        {emailError && (
                            <p className="mt-2 text-sm text-red-600 font-medium flex items-start gap-1">
                                <span className="shrink-0">⚠️</span>
                                <span>{emailError}</span>
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>{t('basic.dob')} {requiredSpan}</label>
                            <input 
                                type="date" 
                                className={inputClasses}
                                value={formData.dateOfBirth}
                                onChange={(e) => updateData({ dateOfBirth: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">{isZh ? '例如：23-02-1992' : 'Example: 23-02-1992'}</p>
                        </div>
                        <div>
                            <label className={labelClasses}>{t('basic.nationality')} {requiredSpan}</label>
                            <select 
                                className={inputClasses}
                                value={formData.nationality}
                                onChange={(e) => updateData({ nationality: e.target.value })}
                            >
                                <option value="" disabled>{isZh ? '请选择...' : 'Select...'}</option>
                                <option value="Malaysian">{isZh ? '马来西亚 (Malaysian)' : 'Malaysian'}</option>
                                <option value="American">{isZh ? '美国 (American)' : 'American'}</option>
                                <option value="Australian">{isZh ? '澳大利亚 (Australian)' : 'Australian'}</option>
                                <option value="British">{isZh ? '英国 (British)' : 'British'}</option>
                                <option value="Canadian">{isZh ? '加拿大 (Canadian)' : 'Canadian'}</option>
                                <option value="Chinese">{isZh ? '中国 (Chinese)' : 'Chinese'}</option>
                                <option value="Filipino">{isZh ? '菲律宾 (Filipino)' : 'Filipino'}</option>
                                <option value="Other">{isZh ? '其他 (Other)' : 'Other'}</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>{t('basic.residency')} {requiredSpan}</label>
                            <select 
                                className={inputClasses}
                                value={formData.residency}
                                onChange={(e) => updateData({ residency: e.target.value })}
                            >
                                <option value="" disabled>{isZh ? '请选择...' : 'Select...'}</option>
                                <option value="Malaysia Citizen">{isZh ? '马来西亚公民 (Malaysia Citizen)' : 'Malaysia Citizen'}</option>
                                <option value="Malaysian PR">{isZh ? '马来西亚永久居民 (Malaysian PR)' : 'Malaysian PR'}</option>
                                <option value="Work Pass">{isZh ? '工作准证 (Work Pass)' : 'Work Pass'}</option>
                                <option value="Student Pass">{isZh ? '学生准证 (Student Pass)' : 'Student Pass'}</option>
                                <option value="Long Term Visit Pass">{isZh ? '长期探访准证 (Long Term Visit Pass)' : 'Long Term Visit Pass'}</option>
                                <option value="Employment Pass">{isZh ? '就业准证 (Employment Pass)' : 'Employment Pass'}</option>
                                <option value="Dependant Pass">{isZh ? '家属准证 (Dependant Pass)' : 'Dependant Pass'}</option>
                                <option value="Other">{isZh ? '其他 (Other)' : 'Other'}</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>{t('basic.marital')} {optionalSpan}</label>
                            <select 
                                className={inputClasses}
                                value={formData.maritalStatus}
                                onChange={(e) => updateData({ maritalStatus: e.target.value })}
                            >
                                <option value="" disabled>{isZh ? '请选择...' : 'Select...'}</option>
                                <option value="Single">{isZh ? '单身 (Single)' : 'Single'}</option>
                                <option value="Married">{isZh ? '已婚 (Married)' : 'Married'}</option>
                                <option value="Divorced">{isZh ? '离婚 (Divorced)' : 'Divorced'}</option>
                                <option value="Separated">{isZh ? '分居 (Separated)' : 'Separated'}</option>
                                <option value="Widowed">{isZh ? '丧偶 (Widowed)' : 'Widowed'}</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>{t('basic.retirement')} {requiredSpan}</label>
                        <DebouncedTextInput 
                            type="number" 
                            className={inputClasses}
                            value={formData.retirementAge}
                            onChange={(val) => updateData({ retirementAge: val })}
                            placeholder="55"
                        />
                    </div>
                </div>

                {/* Employment Section */}
                <h2 className="text-2xl font-serif text-gray-800 mt-12 mb-6 border-b border-gray-100 pb-4">
                    {isZh ? '就业信息 (Employment Info)' : 'Employment Info'}
                </h2>

                <div className="space-y-6">
                    <div>
                        <label className={labelClasses}>{t('basic.employment')} {requiredSpan}</label>
                        {renderToggleGroup('employmentStatus', employmentOptions, formData.employmentStatus)}
                    </div>

                    <div>
                        <label className={labelClasses}>{t('basic.tax')} {requiredSpan}</label>
                        {renderToggleGroup('taxStatus', taxOptions, formData.taxStatus)}
                    </div>

                    <div>
                        <label className={labelClasses}>{t('basic.occupation')} {optionalSpan}</label>
                        <DebouncedTextInput 
                            type="text" 
                            className={inputClasses}
                            value={formData.occupation}
                            onChange={(val) => updateData({ occupation: val })}
                        />
                    </div>
                </div>

                {/* Navigation Buttons bottom */}
                <div className="mt-12 pt-6 border-t border-gray-100 flex justify-between items-center bg-white">
                    <button 
                        onClick={onPrev} 
                        className="px-6 py-2.5 border border-gray-300 rounded-md text-gray-600 font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                        <span>&lt;</span> {t('basic.back')}
                    </button>
                    <button
                        onClick={handleContinue}
                        disabled={isCheckingEmail}
                        className="px-8 py-2.5 bg-gradient-to-r from-xin-blue to-xin-blueLight text-white font-medium rounded-md hover:from-xin-dark hover:to-xin-blue flex items-center gap-2 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isCheckingEmail
                            ? (isZh ? '检查中…' : 'Checking…')
                            : <>{t('basic.continue')} <span>&gt;</span></>}
                    </button>
                </div>
            </div>
            
        </div>
    );
};

export default BasicInfoStep;
