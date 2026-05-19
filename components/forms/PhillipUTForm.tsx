import React, { useState, useEffect } from 'react';
import {
  ChevronRight, ChevronLeft, Send, AlertCircle, Info, X,
  Check, Building2, Users, Landmark, FileCheck, PenLine, FileText, ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { fillPhillipPdf, PhillipCorpFormData } from '../../lib/phillipPdfFiller';

const TOTAL_STEPS = 6;
const STEPS = [
  { label: 'Corporate Details',   icon: Building2 },
  { label: 'Directors & Contact', icon: Users },
  { label: 'Bank Account',        icon: Landmark },
  { label: 'FATCA & Mandate',     icon: FileCheck },
  { label: 'Sign',                icon: PenLine },
  { label: 'Review & Submit',     icon: FileText },
];

function emptyForm(): PhillipCorpFormData {
  return {
    isWrapAccount: false, isNonWrap: true, serviceFee: '', wrapFee: '',
    corporateName: '', registrationNo: '', natureOfBusiness: '',
    incorporationDate: '', placeOfIncorporation: '',
    paidUpCapital: '', shareholdersEquity: '', corporateStatus: '',
    registeredAddress: '', correspondenceAddress: '',
    tel: '', fax: '', email: '',
    director1Name: '', director1Nric: '', director1Address: '',
    director2Name: '', director2Nric: '', director2Address: '',
    contactPersonName: '', contactPersonNric: '', contactPersonDesignation: '',
    contactPersonMobile: '', contactPersonOffice: '', contactPersonFax: '', contactPersonEmail: '',
    investments: Array.from({ length: 5 }, () => ({
      fundName: '', currencyClass: '', amountLumpSum: '', salesCharge: '',
      regularSavingPlan: '', deductionDate: '' as const, remarks: '',
    })),
    paymentMode: '', paymentReference: '', paymentDate: '',
    bankAccountHolder: '', currency: '', bankName: '', accountNo: '', branch: '', swiftCode: '',
    usPerson: '', taxResidency: '', foreignTaxCountry: '', foreignTaxTIN: '',
    nfeType: '', corporateMandate: '', sstNumber: '', tinNumber: '',
    signatureDataUrl: '', signatureDate: '',
  };
}

// ── Shared UI helpers ────────────────────────────────────────────────

function SectionHeader({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-xin-gold/30 mb-5">
      {Icon && (
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-xin-blue to-xin-blueLight flex items-center justify-center shadow-sm">
          <Icon size={16} className="text-xin-gold" />
        </div>
      )}
      <h3 className="font-serif text-lg text-xin-blue">{children}</h3>
    </div>
  );
}

function Field({ label, required, children, hint }: {
  label: React.ReactNode; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-xin-blue/80 tracking-wide">
        {label}{required && <span className="text-xin-goldDark ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 italic">{hint}</p>}
    </div>
  );
}

const INPUT_CLASSES =
  'w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-xin-dark placeholder-gray-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-xin-gold/40 focus:border-xin-gold transition-all ' +
  'bg-white shadow-sm hover:border-gray-300';

function Input({ value, onChange, placeholder, type = 'text', inputMode, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal'; autoComplete?: string;
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={INPUT_CLASSES}
    />
  );
}

function CurrencyInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-xin-blue/60">RM</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          if (!raw) return onChange('');
          const [intPart, decPart] = raw.split('.');
          const formatted = parseInt(intPart || '0', 10).toLocaleString('en-US');
          onChange(decPart !== undefined ? `${formatted}.${decPart.slice(0, 2)}` : formatted);
        }}
        placeholder={placeholder}
        className={INPUT_CLASSES + ' pl-10'}
      />
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT_CLASSES + ' appearance-none cursor-pointer bg-[url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%23A68255" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>\')] bg-no-repeat bg-[right_1rem_center]'}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ChoiceCards({ value, onChange, options, columns = 2 }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string; description?: string }[]; columns?: 1 | 2 | 3;
}) {
  const colClass = columns === 1 ? 'grid-cols-1' : columns === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2';
  return (
    <div className={`grid ${colClass} gap-2`}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative text-left px-4 py-3 rounded-lg border-2 transition-all ${
              selected
                ? 'border-xin-gold bg-gradient-to-br from-xin-gold/10 to-xin-goldLight/5 shadow-sm'
                : 'border-gray-200 bg-white hover:border-xin-gold/40 hover:bg-xin-bg/40'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  selected ? 'border-xin-goldDark bg-xin-goldDark' : 'border-gray-300 bg-white'
                }`}
              >
                {selected && <Check size={10} className="text-white stroke-[3]" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-tight ${selected ? 'font-semibold text-xin-blue' : 'font-medium text-gray-700'}`}>
                  {o.label}
                </p>
                {o.description && (
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{o.description}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Step components ──────────────────────────────────────────────────

function Step1({ data, set }: { data: PhillipCorpFormData; set: (d: Partial<PhillipCorpFormData>) => void }) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <SectionHeader icon={Building2}>Corporate Particulars</SectionHeader>

      <Field label="Name of Corporation" required>
        <Input value={data.corporateName} onChange={(v) => set({ corporateName: v })} placeholder="As per Company Registration" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Registration No." required>
          <Input value={data.registrationNo} onChange={(v) => set({ registrationNo: v })} placeholder="e.g. 1234567-H" />
        </Field>
        <Field label="Nature of Business" required>
          <Input value={data.natureOfBusiness} onChange={(v) => set({ natureOfBusiness: v })} placeholder="e.g. Investment Holding" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Incorporation Date" required>
          <Input type="date" value={data.incorporationDate} onChange={(v) => set({ incorporationDate: v })} />
        </Field>
        <Field label="Place of Incorporation" required>
          <Input value={data.placeOfIncorporation} onChange={(v) => set({ placeOfIncorporation: v })} placeholder="e.g. Malaysia" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Paid-up Capital" required>
          <CurrencyInput value={data.paidUpCapital} onChange={(v) => set({ paidUpCapital: v })} placeholder="500,000" />
        </Field>
        <Field label="Shareholder's Equity" hint="Optional">
          <CurrencyInput value={data.shareholdersEquity} onChange={(v) => set({ shareholdersEquity: v })} placeholder="1,000,000" />
        </Field>
      </div>

      <Field label="Corporate Status" required>
        <ChoiceCards
          value={data.corporateStatus}
          onChange={(v) => set({ corporateStatus: v as PhillipCorpFormData['corporateStatus'] })}
          options={[
            { label: 'Bumiputra Controlled',     value: 'Bumiputra' },
            { label: 'Non-Bumiputra Controlled', value: 'NonBumiputra' },
            { label: 'Non-Malaysian Controlled', value: 'NonMalaysian' },
            { label: 'Government Controlled',    value: 'Government' },
          ]}
        />
      </Field>

      <Field label="Registered Address" required>
        <Input value={data.registeredAddress} onChange={(v) => set({ registeredAddress: v })} placeholder="Full registered address" />
      </Field>

      <Field label="Correspondence Address" hint="Leave blank if same as registered address">
        <Input value={data.correspondenceAddress} onChange={(v) => set({ correspondenceAddress: v })} placeholder="If different from registered address" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Telephone" required>
          <Input type="tel" inputMode="tel" autoComplete="tel" value={data.tel} onChange={(v) => set({ tel: v })} placeholder="03-1234 5678" />
        </Field>
        <Field label="Fax">
          <Input type="tel" inputMode="tel" value={data.fax} onChange={(v) => set({ fax: v })} placeholder="03-1234 5679" />
        </Field>
      </div>

      <Field label="Email Address">
        <Input type="email" inputMode="email" autoComplete="email" value={data.email} onChange={(v) => set({ email: v })} placeholder="company@example.com" />
      </Field>
    </div>
  );
}

function Step2({ data, set }: { data: PhillipCorpFormData; set: (d: Partial<PhillipCorpFormData>) => void }) {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <SectionHeader icon={Users}>Director 1</SectionHeader>
        <div className="space-y-4">
          <Field label="Full Name" required>
            <Input value={data.director1Name} onChange={(v) => set({ director1Name: v })} placeholder="As per NRIC / Passport" />
          </Field>
          <Field label="NRIC / Passport No." required>
            <Input value={data.director1Nric} onChange={(v) => set({ director1Nric: v })} placeholder="e.g. 800101-14-1234" />
          </Field>
          <Field label="Permanent Address" required>
            <Input value={data.director1Address} onChange={(v) => set({ director1Address: v })} placeholder="As per NRIC" />
          </Field>
        </div>
      </div>

      <div>
        <SectionHeader icon={Users}>Director 2 <span className="text-sm text-gray-400 font-sans ml-1">(Optional)</span></SectionHeader>
        <div className="space-y-4">
          <Field label="Full Name">
            <Input value={data.director2Name} onChange={(v) => set({ director2Name: v })} placeholder="As per NRIC / Passport" />
          </Field>
          <Field label="NRIC / Passport No.">
            <Input value={data.director2Nric} onChange={(v) => set({ director2Nric: v })} placeholder="e.g. 800101-14-1234" />
          </Field>
          <Field label="Permanent Address">
            <Input value={data.director2Address} onChange={(v) => set({ director2Address: v })} placeholder="As per NRIC" />
          </Field>
        </div>
      </div>

      <div>
        <SectionHeader icon={Users}>Authorised Contact Person</SectionHeader>
        <div className="space-y-4">
          <Field label="Full Name" required>
            <Input value={data.contactPersonName} onChange={(v) => set({ contactPersonName: v })} placeholder="As per NRIC / Passport" />
          </Field>
          <Field label="NRIC / Passport No." required>
            <Input value={data.contactPersonNric} onChange={(v) => set({ contactPersonNric: v })} placeholder="e.g. 800101-14-1234" />
          </Field>
          <Field label="Designation">
            <Input value={data.contactPersonDesignation} onChange={(v) => set({ contactPersonDesignation: v })} placeholder="e.g. Finance Manager" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mobile" required>
              <Input type="tel" inputMode="tel" autoComplete="tel" value={data.contactPersonMobile} onChange={(v) => set({ contactPersonMobile: v })} placeholder="012-345 6789" />
            </Field>
            <Field label="Office">
              <Input type="tel" inputMode="tel" value={data.contactPersonOffice} onChange={(v) => set({ contactPersonOffice: v })} placeholder="03-1234 5678" />
            </Field>
          </div>
          <Field label="Fax">
            <Input type="tel" inputMode="tel" value={data.contactPersonFax} onChange={(v) => set({ contactPersonFax: v })} placeholder="03-1234 5679" />
          </Field>
          <Field label="Email Address" required>
            <Input type="email" inputMode="email" autoComplete="email" value={data.contactPersonEmail} onChange={(v) => set({ contactPersonEmail: v })} placeholder="contact@company.com" />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step3({ data, set }: { data: PhillipCorpFormData; set: (d: Partial<PhillipCorpFormData>) => void }) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <SectionHeader icon={Landmark}>Bank Account for Redemption</SectionHeader>
      <p className="text-xs text-gray-500 italic -mt-2">Redemption proceeds will be paid into this account.</p>

      <Field label="Bank Account Holder Name" required>
        <Input value={data.bankAccountHolder} onChange={(v) => set({ bankAccountHolder: v })} placeholder="As per bank records" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Currency" required>
          <Select
            value={data.currency}
            onChange={(v) => set({ currency: v })}
            placeholder="Select currency"
            options={[
              { label: 'MYR — Malaysian Ringgit', value: 'MYR' },
              { label: 'USD — US Dollar',         value: 'USD' },
              { label: 'SGD — Singapore Dollar',  value: 'SGD' },
              { label: 'AUD — Australian Dollar', value: 'AUD' },
              { label: 'JPY — Japanese Yen',      value: 'JPY' },
              { label: 'CNY — Chinese Yuan',      value: 'CNY' },
            ]}
          />
        </Field>
        <Field label="Bank Name" required>
          <Input value={data.bankName} onChange={(v) => set({ bankName: v })} placeholder="e.g. Maybank" />
        </Field>
      </div>

      <Field label="Account No." required>
        <Input inputMode="numeric" value={data.accountNo} onChange={(v) => set({ accountNo: v })} placeholder="Bank account number" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Branch" required>
          <Input value={data.branch} onChange={(v) => set({ branch: v })} placeholder="e.g. KL Main Office" />
        </Field>
        <Field label="Bank SWIFT Code" hint="Required for foreign currency accounts">
          <Input value={data.swiftCode} onChange={(v) => set({ swiftCode: v })} placeholder="e.g. MBBEMYKL" />
        </Field>
      </div>
    </div>
  );
}

function Step4({ data, set }: { data: PhillipCorpFormData; set: (d: Partial<PhillipCorpFormData>) => void }) {
  const [showNFEInfo, setShowNFEInfo] = useState(false);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <SectionHeader icon={ShieldCheck}>FATCA / CRS Declaration</SectionHeader>
        <p className="text-xs text-gray-500 italic mb-5">Required under Foreign Account Tax Compliance Act &amp; Common Reporting Standard.</p>

        <div className="space-y-5">
          <Field label="Section B — US Person Status" required>
            <ChoiceCards
              columns={1}
              value={data.usPerson}
              onChange={(v) => set({ usPerson: v as PhillipCorpFormData['usPerson'] })}
              options={[
                { label: 'US Person / US Legal Entity',     value: 'USPerson',         description: 'Incorporated in the US or otherwise classified as a US tax person' },
                { label: 'Non-US, No US indicia',           value: 'NonUSNoIndicia',   description: 'No connection to the US' },
                { label: 'Non-US with US indicia',          value: 'NonUSWithIndicia', description: 'Non-US but has US-related signals (address, phone, etc.)' },
              ]}
            />
          </Field>

          <Field label="Section C — Tax Residency" required>
            <ChoiceCards
              value={data.taxResidency}
              onChange={(v) => set({ taxResidency: v as PhillipCorpFormData['taxResidency'] })}
              options={[
                { label: 'Malaysia Only',         value: 'Malaysia' },
                { label: 'Foreign Tax Resident',  value: 'Foreign' },
              ]}
            />
          </Field>

          {data.taxResidency === 'Foreign' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-xin-bg/60 border border-gray-200 animate-fade-in-up">
              <Field label="Country of Tax Residence">
                <Input value={data.foreignTaxCountry} onChange={(v) => set({ foreignTaxCountry: v })} placeholder="e.g. Singapore" />
              </Field>
              <Field label="Tax Identification No.">
                <Input value={data.foreignTaxTIN} onChange={(v) => set({ foreignTaxTIN: v })} placeholder="Foreign TIN" />
              </Field>
            </div>
          )}

          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                Section D — NFE Type (Corporate)
                <button
                  type="button"
                  onClick={() => setShowNFEInfo((v) => !v)}
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-xin-gold/20 text-xin-goldDark hover:bg-xin-gold/30 transition-colors"
                  aria-label="NFE explanation"
                >
                  <Info size={10} />
                </button>
              </span>
            }
          >
            {showNFEInfo && (
              <div className="relative bg-gradient-to-br from-xin-blue to-xin-blueLight text-white rounded-lg p-4 text-xs space-y-2 shadow-md animate-fade-in-up mb-3">
                <button
                  type="button"
                  onClick={() => setShowNFEInfo(false)}
                  className="absolute top-3 right-3 text-white/60 hover:text-xin-gold transition-colors"
                >
                  <X size={14} />
                </button>
                <p className="font-serif text-xin-gold text-sm">How to determine your NFE type</p>
                <ul className="list-disc pl-4 space-y-1 leading-relaxed">
                  <li>Did more than 50% of last year's gross income come from <strong>dividends, interest, rent, royalties, or capital gains</strong>?</li>
                  <li>Do more than 50% of your assets produce (or are held to produce) the above passive income?</li>
                </ul>
                <p className="pt-1 leading-relaxed">
                  If <strong>yes</strong> to either → <strong className="text-xin-gold">Passive NFE</strong>.<br />
                  If <strong>no</strong> to both → <strong className="text-xin-gold">Active NFE</strong>.
                </p>
              </div>
            )}
            <ChoiceCards
              value={data.nfeType}
              onChange={(v) => set({ nfeType: v as PhillipCorpFormData['nfeType'] })}
              options={[
                { label: 'Active NFE',  value: 'ActiveNFE',  description: 'Mainly trading / operating income' },
                { label: 'Passive NFE', value: 'PassiveNFE', description: 'Mainly investment / passive income' },
              ]}
            />
          </Field>
        </div>
      </div>

      <div>
        <SectionHeader icon={FileCheck}>Operating Mandate</SectionHeader>
        <Field label="Signing Instruction" required>
          <ChoiceCards
            value={data.corporateMandate}
            onChange={(v) => set({ corporateMandate: v as PhillipCorpFormData['corporateMandate'] })}
            options={[
              { label: 'As per Board Resolution', value: 'BoardResolution' },
              { label: 'As per Sole Proprietor',  value: 'SoleProprietor' },
            ]}
          />
        </Field>
      </div>

      <div>
        <SectionHeader icon={FileCheck}>SST &amp; TIN <span className="text-sm text-gray-400 font-sans ml-1">(Optional)</span></SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="SST Number">
            <Input value={data.sstNumber} onChange={(v) => set({ sstNumber: v })} placeholder="SST registration no." />
          </Field>
          <Field label="TIN Number (IRBM)">
            <Input value={data.tinNumber} onChange={(v) => set({ tinNumber: v })} placeholder="Tax identification no." />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step5({ data, set }: { data: PhillipCorpFormData; set: (d: Partial<PhillipCorpFormData>) => void }) {
  const missing: string[] = [];
  if (!data.corporateName)      missing.push('Company name');
  if (!data.registrationNo)     missing.push('Registration No.');
  if (!data.director1Name)      missing.push('Director 1 name');
  if (!data.contactPersonName)  missing.push('Contact person name');
  if (!data.contactPersonEmail) missing.push('Contact person email');
  if (!data.bankAccountHolder)  missing.push('Bank account holder');
  if (!data.bankName)           missing.push('Bank name');
  if (!data.accountNo)          missing.push('Account No.');

  return (
    <div className="space-y-6 animate-fade-in-up">
      <SectionHeader icon={PenLine}>Authorised Signatory</SectionHeader>
      <p className="text-xs text-gray-500 italic -mt-2">
        Sign below as the authorised signatory / director. Affix the company stamp / common seal on the printed form before submission.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <SignaturePad
          onSignature={(url) => {
            const today = new Date().toISOString().slice(0, 10);
            set({
              signatureDataUrl: url,
              signatureDate: data.signatureDate || today,
            });
          }}
          value={data.signatureDataUrl}
        />
      </div>

      <Field label="Date of Signing" required>
        <Input type="date" value={data.signatureDate} onChange={(v) => set({ signatureDate: v })} />
      </Field>

      {missing.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-xin-goldLight/20 border border-xin-gold/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-xin-goldDark flex-shrink-0" />
            <p className="text-xs font-semibold text-xin-blue">Please complete the following before previewing:</p>
          </div>
          <ul className="text-xs text-xin-blue/70 space-y-0.5 pl-5 list-disc">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Step6Review({
  pdfBlobUrl, pdfFileName, onBack, onSubmit, submitting, submitted, submitError,
}: {
  pdfBlobUrl: string; pdfFileName: string;
  onBack: () => void; onSubmit: () => void;
  submitting: boolean; submitted: boolean; submitError: string;
}) {
  return (
    <div className="space-y-5 animate-fade-in-up">
      <SectionHeader icon={FileText}>Review Your Application</SectionHeader>
      <p className="text-xs text-gray-500 italic -mt-2">
        Please review the completed form below. If everything looks correct, tap <strong className="text-xin-blue not-italic">Submit</strong> to send it to your advisor.
      </p>

      {/* PDF viewer with elegant frame */}
      <div className="rounded-xl overflow-hidden bg-xin-blue/95 p-1 shadow-lg" style={{ height: '64vh' }}>
        <div className="bg-gray-100 rounded-lg overflow-hidden h-full">
          <object data={pdfBlobUrl} type="application/pdf" className="w-full h-full">
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
              <AlertCircle size={32} className="text-gray-400" />
              <p className="text-sm text-gray-600">PDF preview is not available in this browser.</p>
              <a
                href={pdfBlobUrl}
                download={pdfFileName}
                className="px-4 py-2 bg-gradient-to-r from-xin-blue to-xin-blueLight text-white rounded-lg text-sm font-medium"
              >
                Download to Review
              </a>
            </div>
          </object>
        </div>
      </div>

      {submitted ? (
        <div className="bg-gradient-to-br from-xin-blue to-xin-blueLight rounded-xl p-6 text-center space-y-3 shadow-md">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-xin-gold/20 border border-xin-gold/40">
            <Check size={22} className="text-xin-gold stroke-[2.5]" />
          </div>
          <div>
            <p className="font-serif text-xin-gold text-lg">Submitted Successfully</p>
            <p className="text-xs text-white/70 mt-1">Your advisor has received your form and will be in touch shortly.</p>
          </div>
        </div>
      ) : (
        <>
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs text-red-700 leading-relaxed">{submitError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-white hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Back to Edit
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-xin-blue to-xin-blueLight hover:from-xin-dark hover:to-xin-blue text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-60 text-sm tracking-wide"
            >
              {submitting
                ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                : <Send size={16} className="text-xin-gold" />}
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center italic">
            Print the submitted form, sign, and affix the company stamp before handing to Phillip Mutual.
          </p>
        </>
      )}
    </div>
  );
}

// ── Main form component ──────────────────────────────────────────────

export default function PhillipUTForm() {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Phillip Corporate UT Account Opening | XinWealth';
    return () => { document.title = prev; };
  }, []);

  const [step, setStep] = useState(1);
  const [data, setData] = useState<PhillipCorpFormData>(emptyForm);
  const [generating, setGenerating] = useState(false);

  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function set(patch: Partial<PhillipCorpFormData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  const step5Missing =
    !data.corporateName || !data.registrationNo || !data.director1Name ||
    !data.contactPersonName || !data.contactPersonEmail ||
    !data.bankAccountHolder || !data.bankName || !data.accountNo;

  const canPreview = !step5Missing && !!data.signatureDataUrl && !!data.signatureDate;
  const currentStepLabel = STEPS[step - 1].label;

  async function handleGeneratePreview() {
    setGenerating(true);
    try {
      const pdfBytes = await fillPhillipPdf(data);
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      let binary = '';
      for (let i = 0; i < pdfBytes.byteLength; i++) binary += String.fromCharCode(pdfBytes[i]);
      const b64 = btoa(binary);

      const name = `Phillip_UT_Corp_${(data.corporateName || 'Company').replace(/\s+/g, '_')}_${data.signatureDate || new Date().toISOString().slice(0, 10)}.pdf`;

      setPdfBlobUrl(url);
      setPdfBase64(b64);
      setPdfFileName(name);
      setSubmitted(false);
      setSubmitError('');
      setStep(6);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/submit-phillip-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64, fileName: pdfFileName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setSubmitError(`Failed to submit: ${message}. Please contact your advisor directly.`);
    } finally {
      setSubmitting(false);
    }
  }

  function goToStep(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isReviewStep = step === 6;

  return (
    <div className="min-h-screen bg-xin-bg font-sans selection:bg-xin-gold selection:text-white pb-32">
      {/* ── Brand Header ───────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Logo */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-xin-blue to-xin-blueLight rounded-xl flex items-center justify-center shadow-sm border border-xin-blueLight/30">
                <span className="text-xin-gold font-bold font-serif text-xl tracking-wider">X</span>
              </div>
              <div className="min-w-0">
                <span className="font-serif font-bold text-xin-blue leading-tight text-lg sm:text-xl tracking-tight block truncate">
                  Xin<span className="text-xin-gold">Wealth</span>
                </span>
                <p className="text-[10px] sm:text-xs text-gray-400 leading-tight truncate">
                  Phillip Mutual · Corporate Account
                </p>
              </div>
            </div>

            {/* Step badge */}
            <div className="flex-shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Step {step} / {TOTAL_STEPS}</p>
              <p className="text-xs sm:text-sm font-semibold text-xin-blue truncate max-w-[140px] sm:max-w-none">{currentStepLabel}</p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const stepNum = i + 1;
              const isCompleted = stepNum < step;
              const isCurrent = stepNum === step;
              const isClickable = stepNum < step;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => isClickable && goToStep(stepNum)}
                  disabled={!isClickable}
                  className={`group flex-1 flex items-center gap-1.5 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                  aria-label={`${s.label}${isCompleted ? ' (completed)' : ''}`}
                >
                  <div
                    className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                      isCompleted
                        ? 'bg-xin-gold'
                        : isCurrent
                        ? 'bg-gradient-to-r from-xin-gold to-xin-goldLight'
                        : 'bg-gray-200 group-hover:bg-gray-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
          {step === 1 && <Step1 data={data} set={set} />}
          {step === 2 && <Step2 data={data} set={set} />}
          {step === 3 && <Step3 data={data} set={set} />}
          {step === 4 && <Step4 data={data} set={set} />}
          {step === 5 && <Step5 data={data} set={set} />}
          {step === 6 && (
            <Step6Review
              pdfBlobUrl={pdfBlobUrl}
              pdfFileName={pdfFileName}
              onBack={() => goToStep(5)}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitted={submitted}
              submitError={submitError}
            />
          )}
        </div>

        {/* Trust signal */}
        {!isReviewStep && (
          <div className="mt-5 flex items-start gap-2 text-xs text-gray-400 px-2">
            <ShieldCheck size={14} className="text-xin-goldDark flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Your personal information will be kept private and confidential. It will be used for the processing of this account opening with Phillip Mutual, as well as for the purpose of providing ongoing financial advisory services by your appointed financial planner and their team. By proceeding, you consent to your information being accessed and used by your financial planner and their authorised team members solely for advisory purposes related to your financial planning needs.
            </p>
          </div>
        )}
      </main>

      {/* ── Floating navigation ────────────────────────────────────── */}
      {!isReviewStep && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 shadow-[0_-4px_16px_rgba(10,37,64,0.06)]">
          <div className="max-w-3xl mx-auto px-4 py-3 flex gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                className="flex items-center gap-1.5 px-5 py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-xin-bg hover:border-gray-300 transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            ) : <div className="w-[88px]" />}
            {step < 5 && (
              <button
                type="button"
                onClick={() => goToStep(step + 1)}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-xin-blue to-xin-blueLight hover:from-xin-dark hover:to-xin-blue text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg text-sm tracking-wide"
              >
                Continue
                <ChevronRight size={16} className="text-xin-gold" />
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={!canPreview || generating}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-xin-blue to-xin-blueLight hover:from-xin-dark hover:to-xin-blue disabled:bg-gray-300 disabled:bg-none disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg text-sm tracking-wide"
              >
                {generating
                  ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  : <FileText size={16} className="text-xin-gold" />}
                {generating ? 'Generating PDF…' : 'Preview PDF'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
