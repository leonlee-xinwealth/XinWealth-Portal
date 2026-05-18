import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Send, AlertCircle, Building2, Info, X } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { fillPhillipPdf, PhillipCorpFormData } from '../../lib/phillipPdfFiller';

const TOTAL_STEPS = 6;
const STEP_LABELS = [
  'Corporate Details',
  'Directors & Contact',
  'Bank Account',
  'FATCA / Mandate',
  'Sign',
  'Review & Submit',
];

function emptyForm(): PhillipCorpFormData {
  return {
    isWrapAccount: false,
    isNonWrap: true,
    serviceFee: '',
    wrapFee: '',
    corporateName: '',
    registrationNo: '',
    natureOfBusiness: '',
    incorporationDate: '',
    placeOfIncorporation: '',
    paidUpCapital: '',
    shareholdersEquity: '',
    corporateStatus: '',
    registeredAddress: '',
    correspondenceAddress: '',
    tel: '',
    fax: '',
    email: '',
    director1Name: '',
    director1Nric: '',
    director1Address: '',
    director2Name: '',
    director2Nric: '',
    director2Address: '',
    contactPersonName: '',
    contactPersonNric: '',
    contactPersonDesignation: '',
    contactPersonMobile: '',
    contactPersonOffice: '',
    contactPersonFax: '',
    contactPersonEmail: '',
    investments: Array.from({ length: 5 }, () => ({
      fundName: '',
      currencyClass: '',
      amountLumpSum: '',
      salesCharge: '',
      regularSavingPlan: '',
      deductionDate: '' as const,
      remarks: '',
    })),
    paymentMode: '',
    paymentReference: '',
    paymentDate: '',
    bankAccountHolder: '',
    currency: '',
    bankName: '',
    accountNo: '',
    branch: '',
    swiftCode: '',
    usPerson: '',
    taxResidency: '',
    foreignTaxCountry: '',
    foreignTaxTIN: '',
    nfeType: '',
    corporateMandate: '',
    sstNumber: '',
    tinNumber: '',
    signatureDataUrl: '',
    signatureDate: '',
  };
}

// ── Shared UI helpers ────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 px-4 py-2 rounded-r-lg mb-4">
      <h3 className="text-sm font-semibold text-blue-800 uppercase tracking-wide">{children}</h3>
    </div>
  );
}

function Field({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white ${className}`}
    />
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string }[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function RadioGroup({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            value === o.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Step components ──────────────────────────────────────────────────

function Step1({ data, set }: { data: PhillipCorpFormData; set: (d: Partial<PhillipCorpFormData>) => void }) {
  return (
    <div className="space-y-5">
      <SectionHeader>Particulars of Corporate Applicant</SectionHeader>
      <Field label="Name of Corporation" required>
        <Input value={data.corporateName} onChange={(v) => set({ corporateName: v })} placeholder="As per Company Registration" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Registration No." required>
          <Input value={data.registrationNo} onChange={(v) => set({ registrationNo: v })} placeholder="e.g. 1234567-H" />
        </Field>
        <Field label="Nature of Business" required>
          <Input value={data.natureOfBusiness} onChange={(v) => set({ natureOfBusiness: v })} placeholder="e.g. Investment Holding" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Incorporation Date" required>
          <Input value={data.incorporationDate} onChange={(v) => set({ incorporationDate: v })} placeholder="DD/MM/YYYY" />
        </Field>
        <Field label="Place of Incorporation" required>
          <Input value={data.placeOfIncorporation} onChange={(v) => set({ placeOfIncorporation: v })} placeholder="e.g. Malaysia" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid-up Capital (RM)" required>
          <Input value={data.paidUpCapital} onChange={(v) => set({ paidUpCapital: v })} placeholder="e.g. 500,000" />
        </Field>
        <Field label="Shareholder's Equity (RM)">
          <Input value={data.shareholdersEquity} onChange={(v) => set({ shareholdersEquity: v })} placeholder="e.g. 1,000,000" />
        </Field>
      </div>

      <Field label="Corporate Status" required>
        <RadioGroup
          value={data.corporateStatus}
          onChange={(v) => set({ corporateStatus: v as PhillipCorpFormData['corporateStatus'] })}
          options={[
            { label: 'Bumiputra Controlled', value: 'Bumiputra' },
            { label: 'Non-Bumiputra Controlled', value: 'NonBumiputra' },
            { label: 'Non-Malaysian Controlled', value: 'NonMalaysian' },
            { label: 'Government Controlled', value: 'Government' },
          ]}
        />
      </Field>

      <Field label="Registered Address" required>
        <Input value={data.registeredAddress} onChange={(v) => set({ registeredAddress: v })} placeholder="Full registered address" />
      </Field>

      <Field label="Correspondence Address" hint="Leave blank if same as registered address">
        <Input value={data.correspondenceAddress} onChange={(v) => set({ correspondenceAddress: v })} placeholder="If different from registered address" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tel" required>
          <Input value={data.tel} onChange={(v) => set({ tel: v })} placeholder="e.g. 03-1234 5678" />
        </Field>
        <Field label="Fax">
          <Input value={data.fax} onChange={(v) => set({ fax: v })} placeholder="e.g. 03-1234 5679" />
        </Field>
      </div>

      <Field label="Email Address">
        <Input value={data.email} onChange={(v) => set({ email: v })} placeholder="company@example.com" type="email" />
      </Field>
    </div>
  );
}

function Step2({ data, set }: { data: PhillipCorpFormData; set: (d: Partial<PhillipCorpFormData>) => void }) {
  return (
    <div className="space-y-5">
      <SectionHeader>Director 1</SectionHeader>
      <Field label="Full Name" required>
        <Input value={data.director1Name} onChange={(v) => set({ director1Name: v })} placeholder="As per NRIC/Passport" />
      </Field>
      <Field label="NRIC / Passport No." required>
        <Input value={data.director1Nric} onChange={(v) => set({ director1Nric: v })} placeholder="e.g. 800101-14-1234" />
      </Field>
      <Field label="Permanent Address" required>
        <Input value={data.director1Address} onChange={(v) => set({ director1Address: v })} placeholder="As per NRIC" />
      </Field>

      <SectionHeader>Director 2 (if applicable)</SectionHeader>
      <Field label="Full Name">
        <Input value={data.director2Name} onChange={(v) => set({ director2Name: v })} placeholder="As per NRIC/Passport" />
      </Field>
      <Field label="NRIC / Passport No.">
        <Input value={data.director2Nric} onChange={(v) => set({ director2Nric: v })} placeholder="e.g. 800101-14-1234" />
      </Field>
      <Field label="Permanent Address">
        <Input value={data.director2Address} onChange={(v) => set({ director2Address: v })} placeholder="As per NRIC" />
      </Field>

      <SectionHeader>Contact Person</SectionHeader>
      <Field label="Full Name" required>
        <Input value={data.contactPersonName} onChange={(v) => set({ contactPersonName: v })} placeholder="As per NRIC/Passport" />
      </Field>
      <Field label="NRIC / Passport No." required>
        <Input value={data.contactPersonNric} onChange={(v) => set({ contactPersonNric: v })} placeholder="e.g. 800101-14-1234" />
      </Field>
      <Field label="Designation">
        <Input value={data.contactPersonDesignation} onChange={(v) => set({ contactPersonDesignation: v })} placeholder="e.g. Finance Manager" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Mobile" required>
          <Input value={data.contactPersonMobile} onChange={(v) => set({ contactPersonMobile: v })} placeholder="e.g. 012-345 6789" />
        </Field>
        <Field label="Office">
          <Input value={data.contactPersonOffice} onChange={(v) => set({ contactPersonOffice: v })} placeholder="e.g. 03-1234 5678" />
        </Field>
      </div>
      <Field label="Fax">
        <Input value={data.contactPersonFax} onChange={(v) => set({ contactPersonFax: v })} placeholder="e.g. 03-1234 5679" />
      </Field>
      <Field label="Email Address" required>
        <Input value={data.contactPersonEmail} onChange={(v) => set({ contactPersonEmail: v })} placeholder="contact@company.com" type="email" />
      </Field>
    </div>
  );
}

function Step3({ data, set }: { data: PhillipCorpFormData; set: (d: Partial<PhillipCorpFormData>) => void }) {
  return (
    <div className="space-y-5">
      <SectionHeader>Bank Account Details (For Redemption)</SectionHeader>
      <Field label="Bank Account Holder Name" required>
        <Input value={data.bankAccountHolder} onChange={(v) => set({ bankAccountHolder: v })} placeholder="As per bank records" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency" required>
          <Select
            value={data.currency}
            onChange={(v) => set({ currency: v })}
            placeholder="Select currency"
            options={[
              { label: 'MYR', value: 'MYR' },
              { label: 'USD', value: 'USD' },
              { label: 'SGD', value: 'SGD' },
              { label: 'AUD', value: 'AUD' },
              { label: 'JPY', value: 'JPY' },
              { label: 'CNY', value: 'CNY' },
            ]}
          />
        </Field>
        <Field label="Bank Name" required>
          <Input value={data.bankName} onChange={(v) => set({ bankName: v })} placeholder="e.g. Maybank" />
        </Field>
      </div>
      <Field label="Account No." required>
        <Input value={data.accountNo} onChange={(v) => set({ accountNo: v })} placeholder="Bank account number" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
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
    <div className="space-y-5">
      <SectionHeader>FATCA — Section B: US Person Declaration</SectionHeader>
      <p className="text-xs text-slate-500">All investors (individual, legal entity or corporate) must complete this section.</p>
      <Field label="Select one" required>
        <RadioGroup
          value={data.usPerson}
          onChange={(v) => set({ usPerson: v as PhillipCorpFormData['usPerson'] })}
          options={[
            { label: 'US Person / US Legal Entity', value: 'USPerson' },
            { label: 'Non-US, No US indicia', value: 'NonUSNoIndicia' },
            { label: 'Non-US with US indicia', value: 'NonUSWithIndicia' },
          ]}
        />
      </Field>

      <SectionHeader>FATCA — Section C: Tax Residency</SectionHeader>
      <p className="text-xs text-slate-500">All investors must complete this section.</p>
      <Field label="Tax residency" required>
        <RadioGroup
          value={data.taxResidency}
          onChange={(v) => set({ taxResidency: v as PhillipCorpFormData['taxResidency'] })}
          options={[
            { label: 'Malaysia ONLY', value: 'Malaysia' },
            { label: 'Foreign tax resident', value: 'Foreign' },
          ]}
        />
      </Field>
      {data.taxResidency === 'Foreign' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Country of Tax Residence">
            <Input value={data.foreignTaxCountry} onChange={(v) => set({ foreignTaxCountry: v })} placeholder="e.g. Singapore" />
          </Field>
          <Field label="Tax Identification No.">
            <Input value={data.foreignTaxTIN} onChange={(v) => set({ foreignTaxTIN: v })} placeholder="Foreign TIN" />
          </Field>
        </div>
      )}

      <SectionHeader>FATCA — Section D: NFE Declaration (Corporate)</SectionHeader>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs text-slate-500">For corporate non-financial entities (NFE) only.</p>
        <button
          type="button"
          onClick={() => setShowNFEInfo((v) => !v)}
          className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
          aria-label="NFE explanation"
        >
          <Info size={11} />
        </button>
      </div>
      {showNFEInfo && (
        <div className="relative bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800 space-y-2">
          <button
            type="button"
            onClick={() => setShowNFEInfo(false)}
            className="absolute top-3 right-3 text-blue-400 hover:text-blue-600"
          >
            <X size={14} />
          </button>
          <p className="font-semibold">How to determine your NFE type:</p>
          <p>Ask yourself the following:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Did more than 50% of last year's gross income come from <strong>dividends, interest, rent, royalties, or capital gains</strong>?</li>
            <li>Do more than 50% of your assets produce (or are held to produce) the above passive income?</li>
          </ul>
          <p className="pt-1">
            If <strong>yes</strong> to either question → select <strong className="text-blue-900">Passive NFE</strong>.<br />
            If <strong>no</strong> to both → select <strong className="text-blue-900">Active NFE</strong>.
          </p>
        </div>
      )}
      <Field label="NFE Type">
        <RadioGroup
          value={data.nfeType}
          onChange={(v) => set({ nfeType: v as PhillipCorpFormData['nfeType'] })}
          options={[
            { label: 'Active NFE', value: 'ActiveNFE' },
            { label: 'Passive NFE', value: 'PassiveNFE' },
          ]}
        />
      </Field>

      <SectionHeader>Operating Mandate (Corporate Account)</SectionHeader>
      <Field label="Signing instruction" required>
        <RadioGroup
          value={data.corporateMandate}
          onChange={(v) => set({ corporateMandate: v as PhillipCorpFormData['corporateMandate'] })}
          options={[
            { label: 'As per Board Resolution', value: 'BoardResolution' },
            { label: 'As per Sole Proprietor', value: 'SoleProprietor' },
          ]}
        />
      </Field>

      <SectionHeader>SST & TIN Numbers</SectionHeader>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SST Number">
          <Input value={data.sstNumber} onChange={(v) => set({ sstNumber: v })} placeholder="SST registration no." />
        </Field>
        <Field label="TIN Number (IRBM)">
          <Input value={data.tinNumber} onChange={(v) => set({ tinNumber: v })} placeholder="Tax identification no." />
        </Field>
      </div>
    </div>
  );
}

function Step5({
  data,
  set,
}: {
  data: PhillipCorpFormData;
  set: (d: Partial<PhillipCorpFormData>) => void;
}) {
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
    <div className="space-y-5">
      <SectionHeader>Authorised Signatory</SectionHeader>
      <p className="text-xs text-slate-500">
        Sign below as the authorised signatory / director. Affix the company stamp / common seal on the printed form before submission.
      </p>

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

      <Field label="Date of Signing" required>
        <Input type="date" value={data.signatureDate} onChange={(v) => set({ signatureDate: v })} />
      </Field>

      {missing.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-700">Please complete earlier steps before previewing:</p>
          </div>
          <ul className="text-xs text-amber-600 space-y-0.5 pl-5 list-disc">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Step6Review({
  data,
  pdfBlobUrl,
  pdfFileName,
  onBack,
  onSubmit,
  submitting,
  submitted,
  submitError,
}: {
  data: PhillipCorpFormData;
  pdfBlobUrl: string;
  pdfFileName: string;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitted: boolean;
  submitError: string;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader>Review Your Application</SectionHeader>
      <p className="text-xs text-slate-500">
        Please review the completed form below. If everything looks correct, tap <strong>Submit</strong> to send it to your advisor.
      </p>

      {/* PDF viewer */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100" style={{ height: '62vh' }}>
        <object
          data={pdfBlobUrl}
          type="application/pdf"
          className="w-full h-full"
        >
          <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
            <AlertCircle size={32} className="text-slate-400" />
            <p className="text-sm text-slate-600">PDF preview is not available in this browser.</p>
            <a
              href={pdfBlobUrl}
              download={pdfFileName}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium"
            >
              Download to Review
            </a>
          </div>
        </object>
      </div>

      {submitted ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-2">
          <p className="text-green-700 font-semibold text-sm">Application submitted successfully!</p>
          <p className="text-xs text-green-600">Your advisor has received your form and will be in touch shortly.</p>
        </div>
      ) : (
        <>
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs text-red-700">{submitError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Back to Edit
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-2xl transition-colors text-sm"
            >
              {submitting
                ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                : <Send size={16} />}
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Print the submitted form, sign, and affix the company stamp before handing to Phillip Mutual.
          </p>
        </>
      )}
    </div>
  );
}

// ── Main form component ──────────────────────────────────────────────

export default function PhillipUTForm() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<PhillipCorpFormData>(emptyForm);
  const [generating, setGenerating] = useState(false);

  // Review step state
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

  async function handleGeneratePreview() {
    setGenerating(true);
    try {
      const pdfBytes = await fillPhillipPdf(data);
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // base64 encode for upload
      let binary = '';
      for (let i = 0; i < pdfBytes.byteLength; i++) {
        binary += String.fromCharCode(pdfBytes[i]);
      }
      const b64 = btoa(binary);

      const name = `Phillip_UT_Corp_${data.corporateName.replace(/\s+/g, '_') || 'Company'}_${data.signatureDate || new Date().toISOString().slice(0, 10)}.pdf`;

      setPdfBlobUrl(url);
      setPdfBase64(b64);
      setPdfFileName(name);
      setSubmitted(false);
      setSubmitError('');
      setStep(6);
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setSubmitError(`Failed to submit: ${message}. Please contact your advisor directly.`);
    } finally {
      setSubmitting(false);
    }
  }

  const isReviewStep = step === 6;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-base">Phillip Mutual Fund</h1>
              <p className="text-xs text-slate-400">Corporate Fund Master Form</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-blue-600">Step {step} of {TOTAL_STEPS}</p>
            <p className="text-xs text-slate-400">{STEP_LABELS[step - 1]}</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {step === 1 && <Step1 data={data} set={set} />}
        {step === 2 && <Step2 data={data} set={set} />}
        {step === 3 && <Step3 data={data} set={set} />}
        {step === 4 && <Step4 data={data} set={set} />}
        {step === 5 && <Step5 data={data} set={set} />}
        {step === 6 && (
          <Step6Review
            data={data}
            pdfBlobUrl={pdfBlobUrl}
            pdfFileName={pdfFileName}
            onBack={() => setStep(5)}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitted={submitted}
            submitError={submitError}
          />
        )}
      </div>

      {/* Navigation — hidden on review step (review step has its own buttons) */}
      {!isReviewStep && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-lg">
          <div className="max-w-2xl mx-auto px-4 py-4 flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
            {step < 5 && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-2xl transition-colors text-sm"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={!canPreview || generating}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-2xl transition-colors text-sm"
              >
                {generating
                  ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  : <ChevronRight size={16} />}
                {generating ? 'Generating…' : 'Preview PDF'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
