import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PhillipCorpFormData {
  // Account options
  isWrapAccount: boolean;
  isNonWrap: boolean;
  serviceFee: string;
  wrapFee: string;

  // Corporate Details (Page 2)
  corporateName: string;
  registrationNo: string;
  natureOfBusiness: string;
  incorporationDate: string;
  placeOfIncorporation: string;
  paidUpCapital: string;
  shareholdersEquity: string;
  corporateStatus: 'Bumiputra' | 'NonBumiputra' | 'NonMalaysian' | 'Government' | '';
  registeredAddress: string;
  correspondenceAddress: string;
  tel: string;
  fax: string;
  email: string;

  // Directors
  director1Name: string;
  director1Nric: string;
  director1Address: string;
  director2Name: string;
  director2Nric: string;
  director2Address: string;

  // Contact Person
  contactPersonName: string;
  contactPersonNric: string;
  contactPersonDesignation: string;
  contactPersonMobile: string;
  contactPersonOffice: string;
  contactPersonFax: string;
  contactPersonEmail: string;

  // Investment details (up to 5)
  investments: Array<{
    fundName: string;
    currencyClass: string;
    amountLumpSum: string;
    salesCharge: string;
    regularSavingPlan: string;
    deductionDate: '15th' | '28th' | '';
    remarks: string;
  }>;
  paymentMode: 'Cheque' | 'TelegraphicTransfer' | 'OnlineTransfer' | 'AutoDebit' | '';
  paymentReference: string;
  paymentDate: string;

  // Bank account
  bankAccountHolder: string;
  currency: string;
  bankName: string;
  accountNo: string;
  branch: string;
  swiftCode: string;

  // FATCA Section B
  usPerson: 'USPerson' | 'NonUSNoIndicia' | 'NonUSWithIndicia' | '';

  // FATCA Section C
  taxResidency: 'Malaysia' | 'Foreign' | '';
  foreignTaxCountry: string;
  foreignTaxTIN: string;

  // FATCA Section D (Corporate NFE)
  nfeType: 'ActiveNFE' | 'PassiveNFE' | '';

  // Corporate Mandate (Page 2)
  corporateMandate: 'BoardResolution' | 'SoleProprietor' | '';

  // SST / TIN (Page 2)
  sstNumber: string;
  tinNumber: string;

  // Signature
  signatureDataUrl: string;
  signatureDate: string;
}

const FONT_SIZE = 8;
const TICK_SIZE = 9;
const H = 841.92; // A4 height in PDF points

function y(top: number) {
  return H - top;
}

export async function fillPhillipPdf(formData: PhillipCorpFormData): Promise<Uint8Array> {
  const pdfBytes = await fetch('/forms/phillip-ut-form.pdf').then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const p1 = pages[0]; // Wrap header
  const p2 = pages[1]; // Corporate applicant
  const p3 = pages[2]; // Investment + Bank
  const p4 = pages[3]; // FATCA
  const p9 = pages[8]; // Signature

  const black = rgb(0, 0, 0);
  const blue = rgb(0.06, 0.13, 0.48);

  function text(page: typeof p1, value: string, x: number, yPos: number, size = FONT_SIZE, bold = false) {
    if (!value) return;
    page.drawText(value, { x, y: yPos, size, font: bold ? helveticaBold : helvetica, color: black });
  }

  function tick(page: typeof p1, x: number, yPos: number) {
    page.drawText('X', { x, y: yPos, size: TICK_SIZE, font: helveticaBold, color: blue });
  }

  // ── PAGE 1 ── WRAP ACCOUNT HEADER ── always Non-Wrap ───────────────
  tick(p1, 143, y(76));

  // ── PAGE 2 ── CORPORATE APPLICANT ──────────────────────────────────
  // Corporation Name
  text(p2, formData.corporateName, 165, y(58));

  // Registration No. | Nature of Business
  text(p2, formData.registrationNo, 100, y(79));
  text(p2, formData.natureOfBusiness, 390, y(79));

  // Incorporation Date | Place of Incorporation
  text(p2, formData.incorporationDate, 100, y(97));
  text(p2, formData.placeOfIncorporation, 390, y(97));

  // Paid-up Capital | Shareholder's Equity
  text(p2, formData.paidUpCapital, 100, y(114));
  text(p2, formData.shareholdersEquity, 390, y(114));

  // Corporate Status ticks
  if (formData.corporateStatus === 'Bumiputra')    tick(p2, 144, y(132));
  if (formData.corporateStatus === 'NonBumiputra') tick(p2, 245, y(132));
  if (formData.corporateStatus === 'NonMalaysian') tick(p2, 359, y(132));
  if (formData.corporateStatus === 'Government')   tick(p2, 475, y(132));

  // Registered Address
  text(p2, formData.registeredAddress, 165, y(162));

  // Correspondence Address
  text(p2, formData.correspondenceAddress, 165, y(186));

  // Tel | Fax
  text(p2, formData.tel, 168, y(198));
  text(p2, formData.fax, 308, y(198));

  // Email
  text(p2, formData.email, 165, y(215));

  // Director 1
  text(p2, formData.director1Name, 165, y(229));
  text(p2, formData.director1Nric, 370, y(233));
  text(p2, formData.director1Address, 165, y(260));

  // Director 2 (optional)
  text(p2, formData.director2Name, 165, y(271));
  text(p2, formData.director2Nric, 370, y(275));
  text(p2, formData.director2Address, 165, y(302));

  // Contact Person
  text(p2, formData.contactPersonName, 165, y(313));
  text(p2, formData.contactPersonNric, 370, y(317));
  text(p2, formData.contactPersonDesignation, 144, y(334));
  text(p2, formData.contactPersonMobile, 187, y(352));
  text(p2, formData.contactPersonOffice, 320, y(352));
  text(p2, formData.contactPersonFax, 450, y(352));
  text(p2, formData.contactPersonEmail, 165, y(377));

  // Corporate Mandate
  if (formData.corporateMandate === 'BoardResolution') tick(p2, 144, y(511));
  if (formData.corporateMandate === 'SoleProprietor')  tick(p2, 264, y(511));

  // SST / TIN
  if (formData.sstNumber) text(p2, formData.sstNumber, 240, y(572));
  if (formData.tinNumber) text(p2, formData.tinNumber, 240, y(601));

  // ── PAGE 3 ── INVESTMENT TABLE ──────────────────────────────────────
  // Row tops from pdfplumber extraction
  const rowTops = [74.7, 95.4, 117.0, 138.3, 159.0];
  const col = { fund: 57, currency: 190, lumpSum: 242, salesPct: 298, rsp: 348, remarks: 506 };

  // Row 0 is always auto-filled with the cash management fund
  const row0y = y(rowTops[0] + 3);
  text(p3, 'Phillip Master Islamic Cash Fund', col.fund, row0y);
  text(p3, 'MYR', col.currency, row0y);
  text(p3, '0%', col.salesPct, row0y);

  // Payment mode rows (tops from pdfplumber)
  const pmRows: Record<string, number> = {
    Cheque: 333.5,
    TelegraphicTransfer: 348.2,
    OnlineTransfer: 362.8,
  };
  if (formData.paymentMode && formData.paymentMode in pmRows) {
    const rowTop = pmRows[formData.paymentMode];
    text(p3, formData.paymentReference, 140, y(rowTop + 2));
    text(p3, formData.paymentDate, 490, y(rowTop + 2));
  }

  // Bank Account Details (bottom of page 3)
  text(p3, formData.bankAccountHolder, 135, y(719));
  text(p3, formData.currency,          135, y(733));
  text(p3, formData.bankName,          135, y(748));
  text(p3, formData.accountNo,         135, y(762));
  text(p3, formData.branch,            135, y(776));
  text(p3, formData.swiftCode,         135, y(791));

  // ── PAGE 4 ── FATCA / CRS ──────────────────────────────────────────
  // Section B – US Person
  if (formData.usPerson === 'USPerson')         tick(p4, 41,  y(212));
  if (formData.usPerson === 'NonUSNoIndicia')   tick(p4, 194, y(212));
  if (formData.usPerson === 'NonUSWithIndicia') tick(p4, 364, y(212));

  // Section C – Tax Residency
  if (formData.taxResidency === 'Malaysia') tick(p4, 134, y(271));
  if (formData.taxResidency === 'Foreign') {
    tick(p4, 134, y(287));
    text(p4, formData.foreignTaxCountry, 120, y(317));
    text(p4, formData.foreignTaxTIN,     445, y(317));
  }

  // Section D – NFE Type
  if (formData.nfeType === 'ActiveNFE')  tick(p4, 134, y(373));
  if (formData.nfeType === 'PassiveNFE') tick(p4, 134, y(387));

  // ── PAGE 9 ── SIGNATURE ─────────────────────────────────────────────
  if (formData.signatureDataUrl) {
    try {
      const sigBytes = await fetch(formData.signatureDataUrl).then((r) => r.arrayBuffer());
      const sigImage = await pdfDoc.embedPng(sigBytes);
      p9.drawImage(sigImage, { x: 28, y: y(530) + 5, width: 180, height: 40 });
    } catch (_) {}
  }

  text(p9, formData.corporateName,   56, y(534));
  text(p9, formData.signatureDate,   56, y(544));

  return pdfDoc.save();
}
