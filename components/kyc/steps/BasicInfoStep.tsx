import React from 'react';
import { KYCData } from '../../types';

interface BasicInfoStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    
    // Helper to render reusable toggle button groups
    const renderToggleGroup = (
        name: keyof KYCData, 
        options: string[], 
        currentValue: string
    ) => (
        <div className="flex flex-wrap shadow-sm rounded-md overflow-hidden bg-white mt-1 border border-gray-300 w-fit">
            {options.map((opt, idx) => {
                const isSelected = currentValue === opt;
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => updateData({ [name]: opt })}
                        className={`px-4 py-2 text-sm font-medium border-r border-gray-300 last:border-r-0 transition-colors ${
                            isSelected 
                                ? 'bg-blue-50 text-xin-blue flex-grow-0' 
                                : 'text-gray-600 hover:bg-gray-50 flex-grow-0'
                        }`}
                        style={isSelected ? { boxShadow: 'inset 0 0 0 1px #1d4ed8', zIndex: 1 } : {}}
                    >
                        {opt}
                    </button>
                );
            })}
        </div>
    );

    const inputClasses = "w-full mt-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-blue focus:border-xin-blue transition-colors bg-white shadow-sm";
    const labelClasses = "block text-sm font-medium text-gray-700 font-sans";
    const requiredSpan = <span className="text-gray-400 italic font-normal text-xs ml-2">Required</span>;
    const optionalSpan = <span className="text-gray-400 italic font-normal text-xs ml-2">Optional</span>;

    return (
        <div className="flex flex-col h-full space-y-8">
            {/* Form Box */}
            <div className="bg-white p-6 lg:p-10 rounded-xl shadow-sm border border-gray-100 pb-12">
                
                {/* Profile Section */}
                <h2 className="text-2xl font-serif text-gray-800 mb-6 border-b border-gray-100 pb-4">Profile</h2>
                
                <div className="space-y-6">
                    <div>
                        <label className={labelClasses}>Name {requiredSpan}</label>
                        <input 
                            type="text" 
                            className={inputClasses}
                            value={formData.name}
                            onChange={(e) => updateData({ name: e.target.value })}
                            placeholder="---"
                        />
                    </div>

                    <div>
                        <label className={labelClasses}>Salutation {requiredSpan}</label>
                        {renderToggleGroup('salutation', ['Mr', 'Ms', 'Mdm', 'Mrs', 'Dr'], formData.salutation)}
                    </div>

                    <div>
                        <label className={labelClasses}>Email Address {requiredSpan}</label>
                        <input 
                            type="email" 
                            className={inputClasses}
                            value={formData.email}
                            onChange={(e) => updateData({ email: e.target.value })}
                            placeholder="e.g. client@example.com"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>Date of Birth {requiredSpan}</label>
                            <input 
                                type="date" 
                                className={inputClasses}
                                value={formData.dateOfBirth}
                                onChange={(e) => updateData({ dateOfBirth: e.target.value })}
                            />
                            <p className="text-xs text-gray-500 mt-1">Example: 23-02-1992</p>
                        </div>
                        <div>
                            <label className={labelClasses}>Nationality {requiredSpan}</label>
                            <select 
                                className={inputClasses}
                                value={formData.nationality}
                                onChange={(e) => updateData({ nationality: e.target.value })}
                            >
                                <option value="" disabled>Select...</option>
                                <option value="Malaysian">Malaysian</option>
                                <option value="Singaporean">Singaporean</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>Residency {requiredSpan}</label>
                            <select 
                                className={inputClasses}
                                value={formData.residency}
                                onChange={(e) => updateData({ residency: e.target.value })}
                            >
                                <option value="" disabled>Select...</option>
                                <option value="Malaysia Citizen">Malaysia Citizen</option>
                                <option value="PR">Permanent Resident</option>
                                <option value="Non-Resident">Non-Resident</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClasses}>Marital Status {optionalSpan}</label>
                            <select 
                                className={inputClasses}
                                value={formData.maritalStatus}
                                onChange={(e) => updateData({ maritalStatus: e.target.value })}
                            >
                                <option value="" disabled>Select...</option>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                                <option value="Divorced">Divorced</option>
                                <option value="Widowed">Widowed</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>Retirement Age {requiredSpan}</label>
                        <input 
                            type="number" 
                            className={inputClasses}
                            value={formData.retirementAge}
                            onChange={(e) => updateData({ retirementAge: e.target.value })}
                            placeholder="55"
                        />
                    </div>
                </div>

                {/* Employment Section */}
                <h2 className="text-2xl font-serif text-gray-800 mt-12 mb-6 border-b border-gray-100 pb-4">Employment Info</h2>

                <div className="space-y-6">
                    <div>
                        <label className={labelClasses}>Employment Status {requiredSpan}</label>
                        {renderToggleGroup('employmentStatus', ['Employed', 'Self-Employed', 'Unemployed', 'Retired'], formData.employmentStatus)}
                    </div>

                    <div>
                        <label className={labelClasses}>Tax Status {requiredSpan}</label>
                        {renderToggleGroup('taxStatus', ['Tax-Resident', 'Non Resident', 'Not Taxable'], formData.taxStatus)}
                    </div>

                    <div>
                        <label className={labelClasses}>Occupation {optionalSpan}</label>
                        <input 
                            type="text" 
                            className={inputClasses}
                            value={formData.occupation}
                            onChange={(e) => updateData({ occupation: e.target.value })}
                        />
                    </div>
                </div>

                {/* Navigation Buttons bottom */}
                <div className="mt-12 pt-6 border-t border-gray-100 flex justify-between items-center bg-white">
                    <button 
                        onClick={onPrev} 
                        className="px-6 py-2.5 border border-gray-300 rounded-md text-gray-600 font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                        <span>&lt;</span> Back
                    </button>
                    <button 
                        onClick={onNext} 
                        className="px-8 py-2.5 bg-xin-blue text-white font-medium rounded-md hover:bg-blue-800 flex items-center gap-2 transition-colors shadow-sm"
                    >
                        Continue <span>&gt;</span>
                    </button>
                </div>
            </div>
            
        </div>
    );
};

export default BasicInfoStep;
