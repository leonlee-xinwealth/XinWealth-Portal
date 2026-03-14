import React, { useState } from 'react';
import { KYCData, FinancialItem, KYCAssetsData } from '../../types';
import { Home, Car, FolderPlus, Trash2, ChevronDown, ChevronUp, PlusCircle, Building2 } from 'lucide-react';

interface AssetsStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const AssetsStep: React.FC<AssetsStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const inputClasses = "w-full mt-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-blue focus:border-xin-blue transition-colors bg-white shadow-sm";
    const labelClasses = "block text-sm font-medium text-gray-700 font-sans";
    
    // Safety check just in case formData.assets is somehow missing
    const assetsData = formData.assets || {
        savings: '',
        epfSejahtera: '',
        epfPersaraan: '',
        properties: [],
        vehicles: [],
        otherAssets: []
    };

    const updateAssets = (data: Partial<KYCAssetsData>) => {
        updateData({ assets: { ...assetsData, ...data } });
    };

    const addAssetItem = (collectionPath: keyof Pick<KYCAssetsData, 'properties' | 'vehicles' | 'otherAssets'>) => {
        const newItems = [...assetsData[collectionPath], { id: Date.now().toString() + Math.random().toString(), amount: '', description: '' }];
        updateAssets({ [collectionPath]: newItems });
    };

    const removeAssetItem = (collectionPath: keyof Pick<KYCAssetsData, 'properties' | 'vehicles' | 'otherAssets'>, idToRemove: string) => {
        const newItems = assetsData[collectionPath].filter(item => item.id !== idToRemove);
        updateAssets({ [collectionPath]: newItems });
    };

    const updateAssetItemField = (collectionPath: keyof Pick<KYCAssetsData, 'properties' | 'vehicles' | 'otherAssets'>, idToUpdate: string, field: 'amount' | 'description', value: string) => {
        const newItems = assetsData[collectionPath].map(item => 
            item.id === idToUpdate ? { ...item, [field]: value } : item
        );
        updateAssets({ [collectionPath]: newItems });
    };

    // Reusable Expandable Card for Assets
    const ExpandableAssetCard = ({ 
        title, 
        icon: Icon, 
        collectionPath, 
    }: { 
        title: string, 
        icon: React.ElementType, 
        collectionPath: keyof Pick<KYCAssetsData, 'properties' | 'vehicles' | 'otherAssets'>,
    }) => {
        const items = assetsData[collectionPath];
        const hasItems = items.length > 0;
        const [isCollapsed, setIsCollapsed] = useState(false);

        if (!hasItems) {
            return (
                <div className="border border-gray-200 rounded-lg p-5 mb-6 flex items-center justify-between bg-white shadow-sm hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-full text-slate-600">
                            <Icon size={24} />
                        </div>
                        <span className="font-semibold text-gray-800">{title}</span>
                    </div>
                    <button 
                        onClick={() => addAssetItem(collectionPath)} 
                        className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-blue-800 transition-colors"
                    >
                        <PlusCircle size={18} /> Add Asset
                    </button>
                </div>
            );
        }

        return (
            <div className="border border-gray-200 rounded-lg mb-6 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div 
                    className="p-5 flex items-center justify-between border-b border-gray-100 cursor-pointer bg-white"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-full text-slate-600">
                            <Icon size={24} />
                        </div>
                        <span className="font-semibold text-gray-800">{title} ({items.length})</span>
                    </div>
                    <button className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-blue-800 transition-colors">
                        {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        {isCollapsed ? "Expand" : "Collapse"}
                    </button>
                </div>
                
                {/* Body */}
                {!isCollapsed && (
                    <div className="bg-slate-50 p-6 space-y-6">
                        {items.map((item, index) => (
                            <div key={item.id} className="relative bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                                <div className="flex justify-end mb-4 border-b border-gray-100 pb-3">
                                    <button 
                                        onClick={() => removeAssetItem(collectionPath, item.id)} 
                                        className="text-red-500 flex items-center gap-1.5 hover:text-red-700 text-sm font-medium transition-colors"
                                    >
                                        <Trash2 size={16} /> Delete
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <label className={labelClasses}>
                                            Value <span className="text-gray-400 italic font-normal text-xs ml-2">Required</span>
                                        </label>
                                        <div className="relative mt-1">
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                                <span className="text-gray-500 font-medium">RM</span>
                                            </div>
                                            <input 
                                                type="text" 
                                                className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-blue focus:border-xin-blue bg-white shadow-sm"
                                                value={item.amount}
                                                onChange={(e) => {
                                                    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                                                    const formattedValue = rawValue ? parseInt(rawValue).toLocaleString('en-US') : '';
                                                    updateAssetItemField(collectionPath, item.id, 'amount', formattedValue);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>
                                            Description <span className="text-gray-400 italic font-normal text-xs ml-2">Required</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            maxLength={100}
                                            className={inputClasses}
                                            value={item.description}
                                            onChange={(e) => updateAssetItemField(collectionPath, item.id, 'description', e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5 font-medium">Maximum 100 characters</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        <div className="flex justify-center pt-2">
                            <button 
                                onClick={() => addAssetItem(collectionPath)} 
                                className="text-xin-blue flex items-center gap-2 text-sm font-semibold hover:text-blue-800 transition-colors bg-blue-50 px-4 py-2 rounded-full border border-blue-100"
                            >
                                <PlusCircle size={18} /> Add Another Asset
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-300">
            {/* Form Box */}
            <div className="bg-white p-6 lg:p-10 rounded-xl shadow-sm border border-gray-100 pb-12">
                
                <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                    <div className="bg-xin-blue/10 p-2 rounded-md text-xin-blue">
                        <Building2 size={24} />
                    </div>
                    <h2 className="text-2xl font-serif text-gray-800">Our Assets</h2>
                </div>
                
                {/* Savings Section */}
                <h3 className="text-lg font-semibold text-gray-800 mb-6 border-b border-gray-100 pb-2">My Savings</h3>
                
                <div className="space-y-6">
                    <div>
                        <label className={`${labelClasses} text-xin-blue`}>My Savings is valued at</label>
                        <div className="relative mt-2">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                <span className="text-gray-500 font-medium">RM</span>
                            </div>
                            <input 
                                type="text" 
                                className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-blue focus:border-xin-blue bg-white shadow-sm transition-shadow"
                                value={assetsData.savings}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                                    const formattedValue = rawValue ? parseInt(rawValue).toLocaleString('en-US') : '';
                                    updateAssets({ savings: formattedValue });
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* EPF Section */}
                <h3 className="text-lg font-semibold text-gray-800 mt-12 mb-6 border-b border-gray-100 pb-2">EPF</h3>
                
                <div className="space-y-6">
                    <div>
                        <label className={labelClasses}>My EPF - Akaun Sejahtera is valued at</label>
                        <div className="relative mt-2">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                <span className="text-gray-500 font-medium">RM</span>
                            </div>
                            <input 
                                type="text" 
                                className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-blue focus:border-xin-blue bg-white shadow-sm transition-shadow"
                                value={assetsData.epfSejahtera}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                                    const formattedValue = rawValue ? parseInt(rawValue).toLocaleString('en-US') : '';
                                    updateAssets({ epfSejahtera: formattedValue });
                                }}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClasses}>My EPF - Akaun Persaraan is valued at</label>
                        <div className="relative mt-2">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                <span className="text-gray-500 font-medium">RM</span>
                            </div>
                            <input 
                                type="text" 
                                className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-blue focus:border-xin-blue bg-white shadow-sm transition-shadow"
                                value={assetsData.epfPersaraan}
                                onChange={(e) => {
                                    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                                    const formattedValue = rawValue ? parseInt(rawValue).toLocaleString('en-US') : '';
                                    updateAssets({ epfPersaraan: formattedValue });
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Dynamic Assets Section */}
                <h3 className="text-lg font-semibold text-gray-800 mt-12 mb-2">Select all that applies</h3>
                
                <div className="space-y-4">
                    <ExpandableAssetCard 
                        title="I own a property"
                        icon={Home}
                        collectionPath="properties"
                    />
                    <ExpandableAssetCard 
                        title="I own a vehicle"
                        icon={Car}
                        collectionPath="vehicles"
                    />
                    <ExpandableAssetCard 
                        title="Other Assets"
                        icon={FolderPlus}
                        collectionPath="otherAssets"
                    />
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

export default AssetsStep;
