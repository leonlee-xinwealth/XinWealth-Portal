import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Download, CheckCircle, AlertCircle } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { fillPhillipPdf, PhillipFormData } from '../../lib/phillipPdfFiller';

// ── Types ──────────────────────────────────────────────────────────
type FormData = PhillipFormData;

const emptyForm = (): FormData => ({
  isWrapAccount: false,
  isNonWrap: true,
  serviceFee: '',
  wrapFee: '',
  fullName: '',
  nric: '',
  salutation: 'Mr',
  salutationOther: '',
  dateOfBirth: '',
  gender: 'Male',
  race: 'Malay',
  nationality: 'Malaysian',
  nationalityCountry: '',
  mobileNo: '',
  homeNo: '',
  maritalStatus: 'Single',
  email: '',
  residentialAddress: '',
  correspondenceAddress: '',
  employmentType: 'Employed',
  designation: '',
  companyName: '',
  natureOfBusiness: '',
  companyAddress: '',
  officeNo: '',
  faxNo: '',
  annualIncome: '<=30k',
  netWorth: '<=100k',
  sourceOfFunds: [],
  sourceOfFundsOther: '',
  purposeOfInvestment: [],
  purposeOther: '',
  investments: Array(5).fill(null).map(() => ({
    fundName: '',
    currencyClass: 'MYR',
    amountLumpSum: '',
    salesCharge: '',
    regularSavingPlan: '',
    deductionDate: '',
    remarks: '',
  })),
  paymentMode: '',
  paymentReference: '',
  paymentDate: '',
  bankAccountHolder: '',
  currency: 'MYR',
  bankName: '',
  accountNo: '',
  branch: '',
  swiftCode: '',
  isUSCitizen: false,
  usPerson: 'NonUSNoIndicia',
  taxResidency: 'Malaysia',
  foreignTaxCountry: '',
  foreignTaxTIN: '',
  sstNumber: '',
  tinNumber: '',
  jointAccountMandate: '',
  signatureDataUrl: '',
  signatureDate: new Date().toISOString().split('T')[0],
});

// ── Step config ────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: 'Personal Info', subtitle: 'Principal Holder Details' },
  { id: 2, title: 'Employment', subtitle: 'Work & Financial Info' },
  { id: 3, title: 'Investment', subtitle: 'Fund & Payment Details' },
  { id: 4, title: 'Bank Account', subtitle: 'Redemption Proceeds' },
  { id: 5, title: 'FATCA / CRS', subtitle: 'Tax Declaration' },
  { id: 6, title: 'Sign & Submit', subtitle: 'Review & Signature' },
];

// ── Shared UI helpers ──────────────────────────────────────────────
const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all ${props.className ?? ''}`}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all appearance-none ${props.className ?? ''}`}
  />
);

const RadioGroup = ({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        onClick={() => onChange(opt.value)}
        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
          value === opt.value
            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const CheckboxGroup = ({ options, values, onChange }: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) => {
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
            values.includes(opt.value)
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="bg-slate-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg mb-4">
    {title}
  </div>
);

// ── Step 1: Personal Info ──────────────────────────────────────────
function Step1({ data, set }: { data: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Particulars of Principal Holder" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Full Name (as per NRIC/Passport)" required>
            <Input
              value={data.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              placeholder="Full name as per NRIC / Passport"
            />
          </Field>
        </div>

        <Field label="NRIC / Passport No." required>
          <Input
            value={data.nric}
            onChange={(e) => set('nric', e.target.value)}
            placeholder="e.g. 900101-14-1234"
          />
        </Field>

        <Field label="Salutation" required>
          <RadioGroup
            options={[
              { value: 'Mr', label: 'Mr' },
              { value: 'Mrs', label: 'Mrs' },
              { value: 'Ms', label: 'Ms' },
              { value: 'Other', label: 'Other' },
            ]}
            value={data.salutation}
            onChange={(v) => set('salutation', v)}
          />
          {data.salutation === 'Other' && (
            <Input
              className="mt-2"
              value={data.salutationOther}
              onChange={(e) => set('salutationOther', e.target.value)}
              placeholder="Please specify"
            />
          )}
        </Field>

        <Field label="Date of Birth" required>
          <Input
            type="date"
            value={data.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
        </Field>

        <Field label="Gender" required>
          <RadioGroup
            options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
            value={data.gender}
            onChange={(v) => set('gender', v)}
          />
        </Field>

        <Field label="Race" required>
          <RadioGroup
            options={[
              { value: 'Malay', label: 'Malay' },
              { value: 'Chinese', label: 'Chinese' },
              { value: 'Indian', label: 'Indian' },
              { value: 'Others', label: 'Others' },
            ]}
            value={data.race}
            onChange={(v) => set('race', v)}
          />
        </Field>

        <Field label="Nationality" required>
          <RadioGroup
            options={[
              { value: 'Malaysian', label: 'Malaysian' },
              { value: 'Non-Malaysian', label: 'Non-Malaysian' },
            ]}
            value={data.nationality}
            onChange={(v) => set('nationality', v)}
          />
          {data.nationality === 'Non-Malaysian' && (
            <Input
              className="mt-2"
              value={data.nationalityCountry}
              onChange={(e) => set('nationalityCountry', e.target.value)}
              placeholder="Country"
            />
          )}
        </Field>

        <Field label="Marital Status" required>
          <RadioGroup
            options={[
              { value: 'Single', label: 'Single' },
              { value: 'Married', label: 'Married' },
              { value: 'Divorced', label: 'Divorced' },
              { value: 'Widow', label: 'Widow' },
            ]}
            value={data.maritalStatus}
            onChange={(v) => set('maritalStatus', v)}
          />
        </Field>

        <Field label="Mobile No." required>
          <Input
            type="tel"
            value={data.mobileNo}
            onChange={(e) => set('mobileNo', e.target.value)}
            placeholder="e.g. 012-3456789"
          />
        </Field>

        <Field label="Home No.">
          <Input
            type="tel"
            value={data.homeNo}
            onChange={(e) => set('homeNo', e.target.value)}
            placeholder="e.g. 03-12345678"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Email Address" required>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="example@email.com"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Residential Address (as per NRIC)" required>
            <textarea
              value={data.residentialAddress}
              onChange={(e) => set('residentialAddress', e.target.value)}
              rows={3}
              placeholder="Full residential address"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Correspondence Address (if different from residential)">
            <textarea
              value={data.correspondenceAddress}
              onChange={(e) => set('correspondenceAddress', e.target.value)}
              rows={2}
              placeholder="Leave blank if same as residential"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Employment ─────────────────────────────────────────────
function Step2({ data, set }: { data: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Employment of Principal Holder" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Employment Status" required>
            <RadioGroup
              options={[
                { value: 'Employed', label: 'Employed' },
                { value: 'Self-Employed', label: 'Self-Employed' },
                { value: 'Retiree', label: 'Retiree' },
                { value: 'Student', label: 'Student' },
                { value: 'Housewife', label: 'Housewife' },
                { value: 'Unemployed', label: 'Unemployed' },
              ]}
              value={data.employmentType}
              onChange={(v) => set('employmentType', v)}
            />
          </Field>
        </div>

        <Field label="Designation" required>
          <Input
            value={data.designation}
            onChange={(e) => set('designation', e.target.value)}
            placeholder="e.g. Manager, Engineer"
          />
        </Field>

        <Field label="Name of Company" required>
          <Input
            value={data.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            placeholder="Company name"
          />
        </Field>

        <Field label="Nature of Business" required>
          <Input
            value={data.natureOfBusiness}
            onChange={(e) => set('natureOfBusiness', e.target.value)}
            placeholder="e.g. Finance, Technology"
          />
        </Field>

        <Field label="Office No.">
          <Input
            type="tel"
            value={data.officeNo}
            onChange={(e) => set('officeNo', e.target.value)}
            placeholder="Office number"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Company Address" required>
            <textarea
              value={data.companyAddress}
              onChange={(e) => set('companyAddress', e.target.value)}
              rows={2}
              placeholder="Company address"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Present Annual Income" required>
            <RadioGroup
              options={[
                { value: '<=30k', label: 'Up to RM30,000' },
                { value: '30k-60k', label: 'RM30,001–RM60,000' },
                { value: '60k-120k', label: 'RM60,001–RM120,000' },
                { value: '120k-300k', label: 'RM120,001–RM300,000' },
                { value: '>300k', label: 'Above RM300,000' },
              ]}
              value={data.annualIncome}
              onChange={(v) => set('annualIncome', v)}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Estimated Net Worth" required>
            <RadioGroup
              options={[
                { value: '<=100k', label: 'Up to RM100,000' },
                { value: '100k-500k', label: 'RM100,001–RM500,000' },
                { value: '500k-3M', label: 'RM500,001–RM3,000,000' },
                { value: '>3M', label: 'Above RM3,000,000' },
              ]}
              value={data.netWorth}
              onChange={(v) => set('netWorth', v)}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Source of Funds" required>
            <CheckboxGroup
              options={[
                { value: 'Salary', label: 'Salary / Employment / Commission' },
                { value: 'Inheritance', label: 'Inheritance' },
                { value: 'Investment Returns', label: 'Investment Returns' },
                { value: 'Insurance', label: 'Insurance Maturity' },
                { value: 'Own Business', label: 'Own Business Income' },
                { value: 'Gift', label: 'Gift' },
                { value: 'EPF', label: 'EPF' },
                { value: 'Others', label: 'Others' },
              ]}
              values={data.sourceOfFunds}
              onChange={(v) => set('sourceOfFunds', v)}
            />
            {data.sourceOfFunds.includes('Others') && (
              <Input
                className="mt-2"
                value={data.sourceOfFundsOther}
                onChange={(e) => set('sourceOfFundsOther', e.target.value)}
                placeholder="Please specify"
              />
            )}
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Purpose of Investment">
            <CheckboxGroup
              options={[
                { value: 'Asset Accumulation', label: 'Asset Accumulation' },
                { value: "Children's Education", label: "Children's Education" },
                { value: 'Retirement', label: 'Saving for Retirement' },
                { value: 'Regular Income', label: 'Regular Income' },
                { value: 'Others', label: 'Others' },
              ]}
              values={data.purposeOfInvestment}
              onChange={(v) => set('purposeOfInvestment', v)}
            />
            {data.purposeOfInvestment.includes('Others') && (
              <Input
                className="mt-2"
                value={data.purposeOther}
                onChange={(e) => set('purposeOther', e.target.value)}
                placeholder="Please specify"
              />
            )}
          </Field>
        </div>

        <Field label="TIN Number">
          <Input
            value={data.tinNumber}
            onChange={(e) => set('tinNumber', e.target.value)}
            placeholder="IRBM Tax Identification Number"
          />
        </Field>

        <Field label="SST Number">
          <Input
            value={data.sstNumber}
            onChange={(e) => set('sstNumber', e.target.value)}
            placeholder="Malaysia SST Number"
          />
        </Field>
      </div>
    </div>
  );
}

// ── Step 3: Investment Details ─────────────────────────────────────
function Step3({ data, set }: { data: FormData; set: (k: keyof FormData, v: any) => void }) {
  const updateInv = (i: number, field: string, value: string) => {
    const updated = data.investments.map((inv, idx) =>
      idx === i ? { ...inv, [field]: value } : inv
    );
    set('investments', updated);
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Details of Initial Investment" />

      <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        Sales Charge is subject to 8% SST deducted from gross investment amount. Fill only the funds you wish to invest in.
      </p>

      <div className="space-y-4">
        {data.investments.map((inv, i) => (
          <div key={i} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-400 mb-3">Fund {i + 1}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Fund Name">
                  <Input
                    value={inv.fundName}
                    onChange={(e) => updateInv(i, 'fundName', e.target.value)}
                    placeholder="e.g. Phillip Master Equity Fund"
                  />
                </Field>
              </div>
              <Field label="Currency Class">
                <Select value={inv.currencyClass} onChange={(e) => updateInv(i, 'currencyClass', e.target.value)}>
                  <option value="MYR">MYR</option>
                  <option value="USD">USD</option>
                  <option value="SGD">SGD</option>
                  <option value="AUD">AUD</option>
                  <option value="JPY">JPY</option>
                  <option value="CNY">CNY</option>
                </Select>
              </Field>
              <Field label="Lump Sum Amount (RM)">
                <Input
                  type="number"
                  value={inv.amountLumpSum}
                  onChange={(e) => updateInv(i, 'amountLumpSum', e.target.value)}
                  placeholder="e.g. 10000"
                />
              </Field>
              <Field label="Sales Charge (%)">
                <Input
                  type="number"
                  step="0.5"
                  max="5"
                  value={inv.salesCharge}
                  onChange={(e) => updateInv(i, 'salesCharge', e.target.value)}
                  placeholder="e.g. 3"
                />
              </Field>
              <Field label="Regular Saving Plan / Month (RM)">
                <Input
                  type="number"
                  value={inv.regularSavingPlan}
                  onChange={(e) => updateInv(i, 'regularSavingPlan', e.target.value)}
                  placeholder="Monthly amount"
                />
              </Field>
              {inv.regularSavingPlan && (
                <Field label="Auto-Debit Date">
                  <RadioGroup
                    options={[
                      { value: '15th', label: '15th' },
                      { value: '28th', label: '28th' },
                    ]}
                    value={inv.deductionDate}
                    onChange={(v) => updateInv(i, 'deductionDate', v)}
                  />
                </Field>
              )}
              <div className="sm:col-span-2">
                <Field label="Remarks">
                  <Input
                    value={inv.remarks}
                    onChange={(e) => updateInv(i, 'remarks', e.target.value)}
                    placeholder="Optional remarks"
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionHeader title="Payment Mode" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Mode of Payment">
            <RadioGroup
              options={[
                { value: 'Cheque', label: 'Cheque / Bank Draft' },
                { value: 'TelegraphicTransfer', label: 'Telegraphic / Bank Transfer' },
                { value: 'OnlineTransfer', label: 'Online Transfer' },
                { value: 'AutoDebit', label: 'Auto Debit' },
              ]}
              value={data.paymentMode}
              onChange={(v) => set('paymentMode', v)}
            />
          </Field>
        </div>
        {data.paymentMode && data.paymentMode !== 'AutoDebit' && (
          <>
            <Field label="Cheque / Reference No.">
              <Input
                value={data.paymentReference}
                onChange={(e) => set('paymentReference', e.target.value)}
                placeholder="Reference number"
              />
            </Field>
            <Field label="Payment Date">
              <Input
                type="date"
                value={data.paymentDate}
                onChange={(e) => set('paymentDate', e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

// ── Step 4: Bank Account ───────────────────────────────────────────
function Step4({ data, set }: { data: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="Bank Account Details (For Redemption Proceeds)" />
      <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        Please provide bank account ownership proof (bank statement or passbook front page showing account holder name & number).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Bank Account Holder Name" required>
            <Input
              value={data.bankAccountHolder}
              onChange={(e) => set('bankAccountHolder', e.target.value)}
              placeholder="Full name as per bank records"
            />
          </Field>
        </div>

        <Field label="Currency" required>
          <Select value={data.currency} onChange={(e) => set('currency', e.target.value)}>
            <option value="MYR">MYR</option>
            <option value="USD">USD</option>
            <option value="SGD">SGD</option>
            <option value="AUD">AUD</option>
            <option value="JPY">JPY</option>
            <option value="CNY">CNY</option>
          </Select>
        </Field>

        <Field label="Bank Name" required>
          <Input
            value={data.bankName}
            onChange={(e) => set('bankName', e.target.value)}
            placeholder="e.g. Maybank, CIMB, Public Bank"
          />
        </Field>

        <Field label="Account No." required>
          <Input
            value={data.accountNo}
            onChange={(e) => set('accountNo', e.target.value)}
            placeholder="Bank account number"
          />
        </Field>

        <Field label="Branch" required>
          <Input
            value={data.branch}
            onChange={(e) => set('branch', e.target.value)}
            placeholder="Branch name"
          />
        </Field>

        <Field label="Bank SWIFT Code (for foreign accounts)">
          <Input
            value={data.swiftCode}
            onChange={(e) => set('swiftCode', e.target.value)}
            placeholder="e.g. MBBEMYKL"
          />
        </Field>
      </div>
    </div>
  );
}

// ── Step 5: FATCA / CRS ────────────────────────────────────────────
function Step5({ data, set }: { data: FormData; set: (k: keyof FormData, v: any) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader title="FATCA / CRS Declaration" />

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-amber-700 mb-1">Section A – U.S. Indicia (Individual Investors Only)</p>
        <p className="text-xs text-amber-600">Answer Yes or No for each question below.</p>
      </div>

      <div className="space-y-3">
        {[
          { key: 'isUSCitizen', label: '1. Are you a U.S. citizen or resident? (U.S. Passport / Green Card holder, U.S. taxpayer, etc.)' },
        ].map(({ key, label }) => (
          <div key={key} className="border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-sm text-slate-700 mb-2">{label}</p>
            <RadioGroup
              options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }]}
              value={String(data[key as keyof FormData])}
              onChange={(v) => set(key as keyof FormData, v === 'true')}
            />
          </div>
        ))}
      </div>

      <SectionHeader title="Section B – Declaration of U.S. Person" />
      <Field label="I am / we are" required>
        <RadioGroup
          options={[
            { value: 'NonUSNoIndicia', label: 'Non-U.S. person with No U.S. indicia' },
            { value: 'NonUSWithIndicia', label: 'Non-U.S. person with one or more U.S. indicia' },
            { value: 'USPerson', label: 'U.S. person / U.S. Legal Entity' },
          ]}
          value={data.usPerson}
          onChange={(v) => set('usPerson', v)}
        />
      </Field>

      <SectionHeader title="Section C – Tax Residency" />
      <Field label="Tax Residency" required>
        <RadioGroup
          options={[
            { value: 'Malaysia', label: 'Tax resident in Malaysia ONLY' },
            { value: 'Foreign', label: 'Foreign tax resident (other than Malaysia)' },
          ]}
          value={data.taxResidency}
          onChange={(v) => set('taxResidency', v)}
        />
      </Field>

      {data.taxResidency === 'Foreign' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Country of Tax Residence">
            <Input
              value={data.foreignTaxCountry}
              onChange={(e) => set('foreignTaxCountry', e.target.value)}
              placeholder="Country name"
            />
          </Field>
          <Field label="Tax Identification No.">
            <Input
              value={data.foreignTaxTIN}
              onChange={(e) => set('foreignTaxTIN', e.target.value)}
              placeholder="TIN"
            />
          </Field>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <p className="text-xs text-slate-500">
          By proceeding, I/We declare that the information provided is true, correct, and complete to the best of my/our knowledge and belief. I/We consent for Phillip Mutual Berhad to share this information with regulatory authorities as required under FATCA and CRS.
        </p>
      </div>
    </div>
  );
}

// ── Step 6: Sign & Submit ──────────────────────────────────────────
function Step6({
  data,
  set,
  onDownload,
  isGenerating,
  downloadDone,
}: {
  data: FormData;
  set: (k: keyof FormData, v: any) => void;
  onDownload: () => void;
  isGenerating: boolean;
  downloadDone: boolean;
}) {
  const missing: string[] = [];
  if (!data.fullName) missing.push('Full Name');
  if (!data.nric) missing.push('NRIC / Passport No.');
  if (!data.dateOfBirth) missing.push('Date of Birth');
  if (!data.mobileNo) missing.push('Mobile No.');
  if (!data.email) missing.push('Email');
  if (!data.residentialAddress) missing.push('Residential Address');
  if (!data.sourceOfFunds.length) missing.push('Source of Funds');
  if (!data.signatureDataUrl) missing.push('Signature');

  return (
    <div className="space-y-6">
      <SectionHeader title="Client Declaration & Signature" />

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 space-y-2">
        <p className="text-xs font-semibold text-slate-600">By signing, I/We confirm that:</p>
        <ul className="text-xs text-slate-500 space-y-1.5 list-disc list-inside">
          <li>I have read and understood the latest prospectus(es) and T&Cs of the Master Account.</li>
          <li>The information provided is true, accurate and complete to the best of my knowledge.</li>
          <li>I am not an undischarged bankrupt.</li>
          <li>I have read and understood the Unit Trust Loan Financing Risk Disclosure Statement.</li>
          <li>I am aware of all fees and charges that will be incurred.</li>
        </ul>
      </div>

      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700 mb-1">Missing required fields:</p>
            <div className="flex flex-wrap gap-1">
              {missing.map((m) => (
                <span key={m} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-medium">{m}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <Field label="Signature Date" required>
        <Input
          type="date"
          value={data.signatureDate}
          onChange={(e) => set('signatureDate', e.target.value)}
        />
      </Field>

      <Field label="Signature of Principal Holder" required>
        <SignaturePad
          value={data.signatureDataUrl}
          onSignature={(url) => set('signatureDataUrl', url)}
        />
      </Field>

      <div className="pt-2">
        <button
          type="button"
          disabled={isGenerating || !data.signatureDataUrl}
          onClick={onDownload}
          className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-sm transition-all ${
            data.signatureDataUrl && !isGenerating
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Generating PDF...
            </>
          ) : (
            <>
              <Download size={16} />
              Download Filled PDF
            </>
          )}
        </button>

        {downloadDone && (
          <div className="mt-3 flex items-center gap-2 text-emerald-600 text-sm font-medium justify-center">
            <CheckCircle size={16} />
            PDF downloaded successfully!
          </div>
        )}

        {!data.signatureDataUrl && (
          <p className="text-center text-xs text-slate-400 mt-2">Please provide your signature to download the PDF</p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function PhillipUTForm() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(emptyForm);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  const set = (key: keyof FormData, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setDownloadDone(false);
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    setDownloadDone(false);
    try {
      const pdfBytes = await fillPhillipPdf(data);
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phillip_UT_Form_${data.fullName.replace(/\s+/g, '_') || 'Client'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadDone(true);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const stepProps = { data, set };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800 text-base">Phillip Mutual Fund</h1>
            <p className="text-xs text-slate-400">Fund Master Form – Individual Account</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-blue-600">Step {step} of {STEPS.length}</p>
            <p className="text-xs text-slate-400">{STEPS[step - 1].title}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-1">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`flex-1 h-1 rounded-full transition-all ${
                  s.id <= step ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Step tabs (scrollable) */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                s.id === step
                  ? 'bg-blue-600 text-white'
                  : s.id < step
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s.id < step ? '✓ ' : ''}{s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Form content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
          {step === 1 && <Step1 {...stepProps} />}
          {step === 2 && <Step2 {...stepProps} />}
          {step === 3 && <Step3 {...stepProps} />}
          {step === 4 && <Step4 {...stepProps} />}
          {step === 5 && <Step5 {...stepProps} />}
          {step === 6 && (
            <Step6
              {...stepProps}
              onDownload={handleDownload}
              isGenerating={isGenerating}
              downloadDone={downloadDone}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pb-8">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all ${
              step === 1
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 bg-white border border-slate-200 hover:border-slate-300 shadow-sm'
            }`}
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {step < STEPS.length && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25"
            >
              Next
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
