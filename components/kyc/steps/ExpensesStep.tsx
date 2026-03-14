import React, { useState } from 'react';
import { KYCData, ExpenseItem, KYCExpensesData } from '../../types';
import { Home, Car, Baby, Trash2, ChevronDown, ChevronUp, PlusCircle, Receipt, Info, User, Package, FolderPlus } from 'lucide-react';

interface ExpensesStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const HOUSEHOLD_OPTIONS = [
    'All - Household',
    'Tel/ Mobile/ Internet',
    'Property Tax',
    'Home Maintenance',
    'Utilities Bills',
    'Groceries/Marketing',
    "Maid's Levy/ Salary",
    'Rental Expense'
];

const TRANSPORT_OPTIONS = [
    'All - Transport',
    'Road Tax',
    'Parking Fee',
    'Petrol',
    'Servicing',
    'Bus/ MRT/ Taxi/ Car Share',
    'Car Insurance'
];

const DEPENDANTS_OPTIONS = [
    'All - Dependants',
    'Child Care',
    "Children's School Fee",
    'Upgrading Class',
    'Dependant Allowances',
    'Child Expenses',
    'Parent Allowance'
];

const PERSONAL_OPTIONS = [
    'All - Personal',
    'Entertainment',
    'Dining Out',
    'Personal Care/ Clothing',
    'Vacation/ Travel',
    'Donations/ Charity/ Gifts',
    'Income Tax Expense',
    'School Fees'
];

const MISC_OPTIONS = [
    'All - Miscellaneous',
    'Medical Cost'
];

const OTHER_EXPENSES_OPTIONS = [
    'Loan Repayment'
];

// Helper to determine suffix
const getSuffixForType = (type: string) => {
    if (type === 'Vacation/ Travel' || type === 'Income Tax Expense') {
        return '/year';
    }
    return '/month';
};

const ExpensesStep: React.FC<ExpensesStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const inputClasses = "w-full mt-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-blue focus:border-xin-blue transition-colors bg-white shadow-sm";
    
    // Safety check just in case formData.expenses is missing due to older state
    const expensesData = formData.expenses || {
        household: [],
        transportation: [],
        dependants: [],
        personal: [],
        miscellaneous: [],
        otherExpenses: []
    };

    const updateExpenses = (data: Partial<KYCExpensesData>) => {
        updateData({ expenses: { ...expensesData, ...data } });
    };

    const addExpenseItem = (collectionPath: keyof KYCExpensesData, defaultType: string) => {
        const newArray = expensesData[collectionPath] || [];
        const newItems = [...newArray, { id: Date.now().toString() + Math.random().toString(), type: defaultType, amount: '' }];
        updateExpenses({ [collectionPath]: newItems });
    };

    const removeExpenseItem = (collectionPath: keyof KYCExpensesData, idToRemove: string) => {
        const newArray = expensesData[collectionPath] || [];
        const newItems = newArray.filter(item => item.id !== idToRemove);
        updateExpenses({ [collectionPath]: newItems });
    };

    const updateExpenseItemField = (collectionPath: keyof KYCExpensesData, idToUpdate: string, field: 'type' | 'amount', value: string) => {
        const newArray = expensesData[collectionPath] || [];
        const newItems = newArray.map(item => 
            item.id === idToUpdate ? { ...item, [field]: value } : item
        );
        updateExpenses({ [collectionPath]: newItems });
    };

    // Reusable Expandable Card for Expenses
    const ExpandableExpenseCard = ({ 
        title, 
        icon: Icon, 
        collectionPath,
        options,
        defaultType
    }: { 
        title: string, 
        icon: React.ElementType, 
        collectionPath: keyof KYCExpensesData,
        options: string[],
        defaultType: string
    }) => {
        const items = expensesData[collectionPath] || [];
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
                        onClick={() => addExpenseItem(collectionPath, defaultType)} 
                        className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-blue-800 transition-colors"
                    >
                        <PlusCircle size={18} /> Add Expense
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
                    <button className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-blue-800 transition-colors overflow-hidden">
                        {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        {isCollapsed ? "Expand" : "Collapse"}
                    </button>
                </div>
                
                {/* Body */}
                {!isCollapsed && (
                    <div className="bg-slate-50 p-6 space-y-4">
                        <div className="hidden md:grid grid-cols-12 gap-4 px-2 mb-2">
                            <div className="col-span-12 md:col-span-6 text-sm font-semibold text-gray-700">Type</div>
                            <div className="col-span-12 md:col-span-6 text-sm font-semibold text-gray-700">Amount</div>
                        </div>

                        {items.map((item, index) => (
                            <div key={item.id} className="relative bg-white p-4 rounded-md border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-start gap-4">
                                
                                {/* Type Dropdown */}
                                <div className="w-full md:w-1/2">
                                    <label className="block md:hidden text-sm font-semibold text-gray-700 mb-1">Type</label>
                                    <select
                                        className={inputClasses + " cursor-pointer !mt-0"}
                                        value={item.type}
                                        onChange={(e) => updateExpenseItemField(collectionPath, item.id, 'type', e.target.value)}
                                    >
                                        {options.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Amount Input & Delete */}
                                <div className="w-full md:w-1/2 flex items-start gap-3">
                                    <div className="w-full">
                                        <label className="block md:hidden text-sm font-semibold text-gray-700 mb-1">Amount</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                                <span className="text-gray-500 font-medium">RM</span>
                                            </div>
                                            <input 
                                                type="text" 
                                                className="w-full pl-16 pr-20 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-blue focus:border-xin-blue bg-white shadow-sm"
                                                value={item.amount}
                                                onChange={(e) => {
                                                    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                                                    const formattedValue = rawValue ? parseInt(rawValue).toLocaleString('en-US') : '';
                                                    updateExpenseItemField(collectionPath, item.id, 'amount', formattedValue);
                                                }}
                                            />
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400 text-sm font-medium border-l border-gray-200 pl-3 my-2">
                                                {getSuffixForType(item.type)}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => removeExpenseItem(collectionPath, item.id)} 
                                        className="text-red-500 hover:text-red-700 p-2 mt-px bg-red-50 hover:bg-red-100 rounded-md transition-colors flex-shrink-0"
                                        title="Delete this expense"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>

                            </div>
                        ))}
                        
                        <div className="flex justify-center pt-4">
                            <button 
                                onClick={() => addExpenseItem(collectionPath, defaultType)} 
                                className="text-xin-blue flex items-center gap-2 text-sm font-semibold hover:text-blue-800 transition-colors bg-blue-50 px-4 py-2 rounded-full border border-blue-100"
                            >
                                <PlusCircle size={18} /> Add Another Expense
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
                
                <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-5">
                    <div className="bg-xin-blue/10 p-2 rounded-md text-xin-blue">
                        <Receipt size={24} />
                    </div>
                    <h2 className="text-2xl font-serif text-gray-800">Our Expenses</h2>
                </div>

                {/* Info Banner */}
                <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-lg flex items-start gap-3 mb-8">
                    <Info size={20} className="flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium leading-relaxed">
                        If loan details have been provided earlier, loan payments will be auto-generated and do not need to be entered again as expenses.
                    </p>
                </div>
                
                <div className="space-y-4">
                    <ExpandableExpenseCard 
                        title="Household"
                        icon={Home}
                        collectionPath="household"
                        options={HOUSEHOLD_OPTIONS}
                        defaultType="All - Household"
                    />
                    <ExpandableExpenseCard 
                        title="Transportation"
                        icon={Car}
                        collectionPath="transportation"
                        options={TRANSPORT_OPTIONS}
                        defaultType="All - Transport"
                    />
                    <ExpandableExpenseCard 
                        title="Dependants"
                        icon={Baby}
                        collectionPath="dependants"
                        options={DEPENDANTS_OPTIONS}
                        defaultType="All - Dependants"
                    />
                    <ExpandableExpenseCard 
                        title="Personal"
                        icon={User}
                        collectionPath="personal"
                        options={PERSONAL_OPTIONS}
                        defaultType="All - Personal"
                    />
                    <ExpandableExpenseCard 
                        title="Miscellaneous"
                        icon={Package}
                        collectionPath="miscellaneous"
                        options={MISC_OPTIONS}
                        defaultType="All - Miscellaneous"
                    />
                    <ExpandableExpenseCard 
                        title="Other Expenses"
                        icon={FolderPlus}
                        collectionPath="otherExpenses"
                        options={OTHER_EXPENSES_OPTIONS}
                        defaultType="Loan Repayment"
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

export default ExpensesStep;
