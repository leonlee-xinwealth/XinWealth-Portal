import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PhillipFormData {
  // Account options
  isWrapAccount: boolean;
  isNonWrap: boolean;
  serviceFee: string;
  wrapFee: string;

  // Principal Holder
  fullName: string;
  nric: string;
  salutation: 'Mr' | 'Mrs' | 'Ms' | 'Other';
  salutationOther: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  race: 'Malay' | 'Chinese' | 'Indian' | 'Others';
  nationality: 'Malaysian' | 'Non-Malaysian';
  nationalityCountry: string;
  mobileNo: string;
  homeNo: string;
  maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widow';
  email: string;
  residentialAddress: string;
  correspondenceAddress: string;

  // Employment
  employmentType: 'Employed' | 'Self-Employed' | 'Retiree' | 'Student' | 'Housewife' | 'Unemployed';
  designation: string;
  companyName: string;
  natureOfBusiness: string;
  companyAddress: string;
  officeNo: string;
  faxNo: string;
  annualIncome: '<=30k' | '30k-60k' | '60k-120k' | '120k-300k' | '>300k';
  netWorth: '<=100k' | '100k-500k' | '500k-3M' | '>3M';
  sourceOfFunds: string[];
  sourceOfFundsOther: string;
  purposeOfInvestment: string[];
  purposeOther: string;

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

  // FATCA
  isUSCitizen: boolean;
  usPerson: 'USPerson' | 'NonUSNoIndicia' | 'NonUSWithIndicia';
  taxResidency: 'Malaysia' | 'Foreign';
  foreignTaxCountry: string;
  foreignTaxTIN: string;

  // SST / TIN
  sstNumber: string;
  tinNumber: string;

  // Mandate
  jointAccountMandate: 'PrincipalOnly' | 'EitherOne' | 'BothSign' | '';

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

export async function fillPhillipPdf(formData: PhillipFormData): Promise<Uint8Array> {
  const pdfBytes = await fetch('/forms/phillip-ut-form.pdf').then((r) => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const p1 = pages[0];
  const p2 = pages[1];
  const p3 = pages[2];
  const p9 = pages[8];

  const black = rgb(0, 0, 0);
  const blue = rgb(0.06, 0.13, 0.48);

  function text(page: typeof p1, value: string, x: number, yPos: number, size = FONT_SIZE, bold = false) {
    if (!value) return;
    page.drawText(value, {
      x,
      y: yPos,
      size,
      font: bold ? helveticaBold : helvetica,
      color: black,
    });
  }

  function tick(page: typeof p1, x: number, yPos: number) {
    page.drawText('X', { x, y: yPos, size: TICK_SIZE, font: helveticaBold, color: blue });
  }

  // ── PAGE 1 ── WRAP ACCOUNT HEADER ──────────────────────────────
  if (formData.isWrapAccount) tick(p1, 143, y(65));
  else tick(p1, 143, y(76)); // Non-wrap
  if (formData.serviceFee) text(p1, formData.serviceFee + '%', 330, y(65));
  if (formData.wrapFee) text(p1, formData.wrapFee + '%', 330, y(76));

  // ── PRINCIPAL HOLDER ───────────────────────────────────────────
  // Full Name (label top=173, entry to right, row height ~18)
  text(p1, formData.fullName, 125, y(182), FONT_SIZE);
  // NRIC/Passport No (label top=177)
  text(p1, formData.nric, 395, y(182), FONT_SIZE);

  // Salutation checkboxes (at top=192)
  if (formData.salutation === 'Mr')  tick(p1, 144, y(195));
  if (formData.salutation === 'Mrs') tick(p1, 175, y(195));
  if (formData.salutation === 'Ms')  tick(p1, 210, y(195));
  if (formData.salutation === 'Other') {
    tick(p1, 144, y(204));
    text(p1, formData.salutationOther, 218, y(204));
  }

  // Date of Birth (right side, top=196)
  text(p1, formData.dateOfBirth, 390, y(200));

  // Gender (right side, top=196)
  if (formData.gender === 'Male')   tick(p1, 492, y(199));
  if (formData.gender === 'Female') tick(p1, 529, y(199));

  // Race (left, top=212/221)
  if (formData.race === 'Malay')   tick(p1, 144, y(215));
  if (formData.race === 'Chinese') tick(p1, 210, y(215));
  if (formData.race === 'Indian')  tick(p1, 144, y(224));
  if (formData.race === 'Others')  tick(p1, 210, y(224));

  // Nationality (right, top=212/221)
  if (formData.nationality === 'Malaysian')     tick(p1, 400, y(215));
  if (formData.nationality === 'Non-Malaysian') {
    tick(p1, 400, y(224));
    text(p1, formData.nationalityCountry, 478, y(224));
  }

  // Contact (top=237)
  text(p1, formData.mobileNo, 165, y(240));
  text(p1, formData.homeNo, 252, y(240));

  // Marital Status (right, top=232/241)
  if (formData.maritalStatus === 'Single')   tick(p1, 400, y(235));
  if (formData.maritalStatus === 'Married')  tick(p1, 476, y(235));
  if (formData.maritalStatus === 'Divorced') tick(p1, 400, y(244));
  if (formData.maritalStatus === 'Widow')    tick(p1, 476, y(244));

  // Email (top=265, entry row above the disclaimer text)
  text(p1, formData.email, 125, y(268));

  // Residential Address (top=289)
  text(p1, formData.residentialAddress, 125, y(296));

  // Correspondence Address (top=311)
  text(p1, formData.correspondenceAddress, 125, y(318));

  // ── EMPLOYMENT ─────────────────────────────────────────────────
  // Employment type (top=357)
  if (formData.employmentType === 'Employed')      tick(p1, 145, y(360));
  if (formData.employmentType === 'Self-Employed') tick(p1, 221, y(360));
  if (formData.employmentType === 'Retiree')       tick(p1, 306, y(360));
  if (formData.employmentType === 'Student')       tick(p1, 376, y(360));
  if (formData.employmentType === 'Housewife')     tick(p1, 446, y(360));
  if (formData.employmentType === 'Unemployed')    tick(p1, 518, y(360));

  // Designation / Company Name (top=374)
  text(p1, formData.designation, 80, y(378));
  text(p1, formData.companyName, 300, y(378));

  // Nature of Business / Company Address (top=392)
  text(p1, formData.natureOfBusiness, 100, y(396));
  text(p1, formData.companyAddress, 300, y(396));

  // Office / Fax (top=408)
  text(p1, formData.officeNo, 165, y(411));
  text(p1, formData.faxNo, 270, y(411));

  // Annual Income (top=424)
  if (formData.annualIncome === '<=30k')      tick(p1, 145, y(427));
  if (formData.annualIncome === '30k-60k')    tick(p1, 214, y(427));
  if (formData.annualIncome === '60k-120k')   tick(p1, 297, y(427));
  if (formData.annualIncome === '120k-300k')  tick(p1, 386, y(427));
  if (formData.annualIncome === '>300k')      tick(p1, 483, y(427));

  // Net Worth (top=441)
  if (formData.netWorth === '<=100k')     tick(p1, 145, y(444));
  if (formData.netWorth === '100k-500k')  tick(p1, 234, y(444));
  if (formData.netWorth === '500k-3M')    tick(p1, 338, y(444));
  if (formData.netWorth === '>3M')        tick(p1, 452, y(444));

  // Source of Funds (top=456/465)
  if (formData.sourceOfFunds.includes('Salary'))            tick(p1, 145, y(459));
  if (formData.sourceOfFunds.includes('Inheritance'))       tick(p1, 265, y(459));
  if (formData.sourceOfFunds.includes('Investment Returns')) tick(p1, 338, y(459));
  if (formData.sourceOfFunds.includes('Insurance'))         tick(p1, 437, y(459));
  if (formData.sourceOfFunds.includes('Own Business'))      tick(p1, 145, y(468));
  if (formData.sourceOfFunds.includes('Gift'))              tick(p1, 265, y(468));
  if (formData.sourceOfFunds.includes('EPF'))               tick(p1, 347, y(468));
  if (formData.sourceOfFunds.includes('Others')) {
    tick(p1, 437, y(468));
    text(p1, formData.sourceOfFundsOther, 512, y(468));
  }

  // Purpose of Investment (top=476/486)
  if (formData.purposeOfInvestment.includes('Asset Accumulation'))    tick(p1, 145, y(479));
  if (formData.purposeOfInvestment.includes("Children's Education"))   tick(p1, 231, y(479));
  if (formData.purposeOfInvestment.includes('Retirement'))             tick(p1, 363, y(479));
  if (formData.purposeOfInvestment.includes('Regular Income'))         tick(p1, 465, y(479));
  if (formData.purposeOfInvestment.includes('Others')) {
    tick(p1, 145, y(488));
    text(p1, formData.purposeOther, 221, y(488));
  }

  // ── PAGE 2 ── SST / TIN / MANDATE ──────────────────────────────
  // SST Number (in the table on page 2, approximately top=330)
  if (formData.sstNumber) text(p2, formData.sstNumber, 240, y(333));
  if (formData.tinNumber) text(p2, formData.tinNumber, 240, y(349));

  // Operating Mandate (Joint account, top~270 on page 2)
  if (formData.jointAccountMandate === 'PrincipalOnly') tick(p2, 144, y(271));
  if (formData.jointAccountMandate === 'EitherOne')     tick(p2, 243, y(271));
  if (formData.jointAccountMandate === 'BothSign')      tick(p2, 340, y(271));

  // ── PAGE 3 ── INVESTMENT TABLE ──────────────────────────────────
  // Investment table rows. Each row is ~53.5pt tall starting at top=68
  // Columns: No | Fund Name | Currency | Lump Sum | Sales% | RSP | Deduction | Remarks
  // Column x positions:
  const col = { no: 37, fund: 98, currency: 186, lumpSum: 240, salesPct: 302, rsp: 345, deduction: 432, remarks: 508 };

  formData.investments.forEach((inv, i) => {
    const rowTop = 68 + i * 53.5;
    const ry = y(rowTop + 12); // entry y within the row
    text(p3, inv.fundName, col.fund, ry);
    text(p3, inv.currencyClass, col.currency, ry);
    text(p3, inv.amountLumpSum, col.lumpSum, ry);
    text(p3, inv.salesCharge, col.salesPct, ry);
    text(p3, inv.regularSavingPlan, col.rsp, ry);
    if (inv.deductionDate === '15th') tick(p3, col.deduction, ry);
    if (inv.deductionDate === '28th') tick(p3, col.deduction + 20, ry);
    text(p3, inv.remarks, col.remarks, ry);
  });

  // Payment mode (below the investment table, around top=600)
  // Payment mode rows at approx top=572,582,592,602
  const pmTop = { Cheque: 572, TelegraphicTransfer: 582, OnlineTransfer: 592 };
  if (formData.paymentMode in pmTop) {
    const pyVal = pmTop[formData.paymentMode as keyof typeof pmTop];
    text(p3, formData.paymentReference, 200, y(pyVal + 2));
    text(p3, formData.paymentDate, 470, y(pyVal + 2));
  }

  // ── BANK ACCOUNT (Page 3, bottom section) ──────────────────────
  // Labels at: Holder top=716.2, Currency=730.6, Bank=745, Acct=759.2, Branch=773.8, SWIFT=788.2
  text(p3, formData.bankAccountHolder, 135, y(719));
  text(p3, formData.currency, 135, y(733));
  text(p3, formData.bankName, 135, y(748));
  text(p3, formData.accountNo, 135, y(762));
  text(p3, formData.branch, 135, y(776));
  text(p3, formData.swiftCode, 135, y(791));

  // ── PAGE 9 ── SIGNATURE ─────────────────────────────────────────
  // Signature image on page 9 (principal holder box: x=28-195, top=479-531)
  // Signature area spans: y from ~310 to ~362 in pdf-lib coords (top=479 to top=531)
  if (formData.signatureDataUrl) {
    try {
      const sigImageBytes = await fetch(formData.signatureDataUrl).then((r) => r.arrayBuffer());
      const sigImage = await pdfDoc.embedPng(sigImageBytes);
      const sigWidth = 165;
      const sigHeight = 45;
      p9.drawImage(sigImage, {
        x: 28,
        y: y(531) + 5,
        width: sigWidth,
        height: sigHeight,
      });
    } catch (_) {}
  }

  // Name and Date (principal holder, top=531/541)
  text(p9, formData.fullName, 56, y(534));
  text(p9, formData.signatureDate, 56, y(544));

  return pdfDoc.save();
}
