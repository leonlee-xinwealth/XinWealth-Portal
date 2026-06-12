// components/advisor/prs/prsFields.ts
import type { PrsFormData } from '../../../types/prs';

export type ControlType = 'text' | 'date' | 'select' | 'radio' | 'multicheck' | 'toggle';

export interface FieldDef {
  key: keyof PrsFormData | string;
  labelEn: string;
  labelZh: string;
  control: ControlType;
  options?: { value: string; en: string; zh: string }[];
  placeholder?: string;
  showIf?: (d: PrsFormData) => boolean;
}

export interface SectionDef {
  key: string;
  titleEn: string;
  titleZh: string;
  advisorOnly?: boolean;
  fields: FieldDef[];
  repeat?: {
    key: 'nominees' | 'crs_tax_residences' | 'dim_allocations' | 'utc_funds' | 'isa_acks';
    rows: number;
    itemFields: FieldDef[];
  };
}

const MY_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak',
  'Selangor', 'Terengganu', 'WP Kuala Lumpur', 'WP Labuan', 'WP Putrajaya',
];

const STATE_OPTIONS = [
  { value: '', en: '—', zh: '—' },
  ...MY_STATES.map(s => ({ value: s, en: s, zh: s })),
];

export const PRS_SECTIONS: SectionDef[] = [
  // ─── Applicant Type ───────────────────────────────────────────────────────
  {
    key: 'applicant',
    titleEn: 'Applicant Type',
    titleZh: '申请人类型',
    fields: [
      {
        key: 'applicant_type',
        labelEn: 'Applicant Type',
        labelZh: '申请人类型',
        control: 'radio',
        options: [
          { value: 'new', en: 'New Applicant', zh: '新开户' },
          { value: 'existing', en: 'Existing PRS Account Holder', zh: '已有 PPA 账户' },
        ],
      },
      {
        key: 'existing_ppa_account_no',
        labelEn: 'Existing PPA Account No.',
        labelZh: '现有 PPA 账户号码',
        control: 'text',
        showIf: (d) => d.applicant_type === 'existing',
      },
      {
        key: 'applicant_category',
        labelEn: 'Applicant Category',
        labelZh: '申请人类别',
        control: 'radio',
        options: [
          { value: 'personal', en: 'Personal', zh: '个人' },
          { value: 'employee', en: 'Employee', zh: '员工' },
        ],
      },
      {
        key: 'employer_prs_contract_no',
        labelEn: 'Employer PRS Contract No.',
        labelZh: '雇主 PRS 合约号码',
        control: 'text',
        showIf: (d) => d.applicant_category === 'employee',
      },
      {
        key: 'staff_no',
        labelEn: 'Staff No.',
        labelZh: '员工编号',
        control: 'text',
        showIf: (d) => d.applicant_category === 'employee',
      },
      {
        key: 'employment_date',
        labelEn: 'Employment Date',
        labelZh: '受聘日期',
        control: 'date',
        showIf: (d) => d.applicant_category === 'employee',
      },
    ],
  },

  // ─── Personal ─────────────────────────────────────────────────────────────
  {
    key: 'personal',
    titleEn: 'Personal Information',
    titleZh: '个人资料',
    fields: [
      {
        key: 'salutation',
        labelEn: 'Salutation',
        labelZh: '称谓',
        control: 'select',
        options: [
          { value: '', en: '—', zh: '—' },
          { value: 'Mr', en: 'Mr', zh: 'Mr' },
          { value: 'Mrs', en: 'Mrs', zh: 'Mrs' },
          { value: 'Ms', en: 'Ms', zh: 'Ms' },
          { value: 'Dr', en: 'Dr', zh: 'Dr' },
        ],
      },
      {
        key: 'full_name',
        labelEn: 'Full Name (as per NRIC)',
        labelZh: '全名（如身份证所示）',
        control: 'text',
        placeholder: 'As per NRIC',
      },
      {
        key: 'nric',
        labelEn: 'NRIC No.',
        labelZh: '身份证号码',
        control: 'text',
        placeholder: '900101-14-1234',
      },
      {
        key: 'other_id_type',
        labelEn: 'Other ID Type',
        labelZh: '其他证件类型',
        control: 'select',
        options: [
          { value: '', en: '—', zh: '—' },
          { value: 'old_ic', en: 'Old IC', zh: '旧身份证' },
          { value: 'police_id', en: 'Police ID', zh: '警察证' },
          { value: 'army_id', en: 'Army ID', zh: '军人证' },
          { value: 'passport', en: 'Passport', zh: '护照' },
        ],
      },
      {
        key: 'other_id_no',
        labelEn: 'Other ID No.',
        labelZh: '其他证件号码',
        control: 'text',
      },
      {
        key: 'passport_country',
        labelEn: 'Passport Country',
        labelZh: '护照国家',
        control: 'text',
        showIf: (d) => d.other_id_type === 'passport',
      },
      {
        key: 'passport_expiry',
        labelEn: 'Passport Expiry',
        labelZh: '护照到期日',
        control: 'date',
        showIf: (d) => d.other_id_type === 'passport',
      },
      {
        key: 'date_of_birth',
        labelEn: 'Date of Birth',
        labelZh: '出生日期',
        control: 'date',
      },
      {
        key: 'gender',
        labelEn: 'Gender',
        labelZh: '性别',
        control: 'radio',
        options: [
          { value: 'male', en: 'Male', zh: '男' },
          { value: 'female', en: 'Female', zh: '女' },
        ],
      },
      {
        key: 'race',
        labelEn: 'Race',
        labelZh: '种族',
        control: 'radio',
        options: [
          { value: 'bumiputera', en: 'Bumiputera', zh: '土著' },
          { value: 'chinese', en: 'Chinese', zh: '华人' },
          { value: 'indian', en: 'Indian', zh: '印度人' },
          { value: 'others', en: 'Others', zh: '其他' },
        ],
      },
      {
        key: 'race_other',
        labelEn: 'Race (specify)',
        labelZh: '种族（请注明）',
        control: 'text',
        showIf: (d) => d.race === 'others',
      },
      {
        key: 'nationality',
        labelEn: 'Nationality',
        labelZh: '国籍',
        control: 'text',
      },
      {
        key: 'marital_status',
        labelEn: 'Marital Status',
        labelZh: '婚姻状况',
        control: 'radio',
        options: [
          { value: 'single', en: 'Single', zh: '单身' },
          { value: 'married', en: 'Married', zh: '已婚' },
          { value: 'widowed', en: 'Widowed', zh: '丧偶' },
          { value: 'divorced', en: 'Divorced', zh: '离婚' },
        ],
      },
      {
        key: 'mothers_maiden_name',
        labelEn: "Mother's Maiden Name",
        labelZh: '母亲婚前姓名',
        control: 'text',
      },
    ],
  },

  // ─── Occupation ───────────────────────────────────────────────────────────
  {
    key: 'occupation',
    titleEn: 'Occupation & Income',
    titleZh: '职业与收入',
    fields: [
      {
        key: 'occupation_category',
        labelEn: 'Occupation Category',
        labelZh: '职业类别',
        control: 'select',
        options: [
          { value: '', en: '—', zh: '—' },
          { value: 'executive', en: 'Executive', zh: '管理人员' },
          { value: 'management', en: 'Management', zh: '经理级' },
          { value: 'professional', en: 'Professional', zh: '专业人士' },
          { value: 'self_employed', en: 'Self-Employed', zh: '自雇人士' },
          { value: 'clerical', en: 'Clerical', zh: '文员' },
          { value: 'skilled_worker', en: 'Skilled Worker', zh: '技术工人' },
          { value: 'government', en: 'Government', zh: '政府雇员' },
          { value: 'housewife', en: 'Housewife', zh: '家庭主妇' },
          { value: 'retiree', en: 'Retiree', zh: '退休人士' },
          { value: 'unemployed', en: 'Unemployed', zh: '待业' },
          { value: 'student', en: 'Student', zh: '学生' },
          { value: 'others', en: 'Others', zh: '其他' },
        ],
      },
      {
        key: 'occupation_other',
        labelEn: 'Occupation (specify)',
        labelZh: '职业（请注明）',
        control: 'text',
        showIf: (d) => d.occupation_category === 'others',
      },
      {
        key: 'nature_of_occupation',
        labelEn: 'Nature of Occupation',
        labelZh: '职业性质',
        control: 'select',
        options: [
          { value: '', en: '—', zh: '—' },
          { value: 'agriculture_forestry', en: 'Agriculture / Forestry', zh: '农业/林业' },
          { value: 'construction', en: 'Construction', zh: '建筑业' },
          { value: 'education_health', en: 'Education / Health', zh: '教育/医疗' },
          { value: 'electricity_gas_water', en: 'Electricity / Gas / Water', zh: '电力/燃气/水务' },
          { value: 'finance_insurance_property', en: 'Finance / Insurance / Property', zh: '金融/保险/房地产' },
          { value: 'manufacturing', en: 'Manufacturing', zh: '制造业' },
          { value: 'mining_quarrying', en: 'Mining / Quarrying', zh: '采矿业' },
          { value: 'trading_restaurant_hotel', en: 'Trading / Restaurant / Hotel', zh: '贸易/餐饮/酒店' },
          { value: 'transport_storage_communication', en: 'Transport / Storage / Communication', zh: '运输/仓储/通讯' },
          { value: 'others', en: 'Others', zh: '其他' },
        ],
      },
      {
        key: 'nature_other',
        labelEn: 'Nature of Occupation (specify)',
        labelZh: '职业性质（请注明）',
        control: 'text',
        showIf: (d) => d.nature_of_occupation === 'others',
      },
      {
        key: 'employer_name',
        labelEn: 'Employer Name',
        labelZh: '雇主名称',
        control: 'text',
      },
      {
        key: 'monthly_income_bracket',
        labelEn: 'Monthly Income',
        labelZh: '月收入范围',
        control: 'select',
        options: [
          { value: '', en: '—', zh: '—' },
          { value: 'up_to_1500', en: '≤RM 1,500', zh: '≤RM 1,500' },
          { value: '1501_3000', en: 'RM 1,501–3,000', zh: 'RM 1,501–3,000' },
          { value: '3001_5000', en: 'RM 3,001–5,000', zh: 'RM 3,001–5,000' },
          { value: '5001_8000', en: 'RM 5,001–8,000', zh: 'RM 5,001–8,000' },
          { value: '8001_15000', en: 'RM 8,001–15,000', zh: 'RM 8,001–15,000' },
          { value: '15001_20000', en: 'RM 15,001–20,000', zh: 'RM 15,001–20,000' },
          { value: '20001_50000', en: 'RM 20,001–50,000', zh: 'RM 20,001–50,000' },
          { value: '50001_100000', en: 'RM 50,001–100,000', zh: 'RM 50,001–100,000' },
          { value: '100001_200000', en: 'RM 100,001–200,000', zh: 'RM 100,001–200,000' },
          { value: 'above_200000', en: '>RM 200,000', zh: '>RM 200,000' },
        ],
      },
    ],
  },

  // ─── Contact & Address ────────────────────────────────────────────────────
  {
    key: 'contact',
    titleEn: 'Contact & Address',
    titleZh: '联系与地址',
    fields: [
      {
        key: 'phone_mobile',
        labelEn: 'Mobile Phone',
        labelZh: '手机号码',
        control: 'text',
        placeholder: '+60 12-xxx xxxx',
      },
      {
        key: 'phone_house',
        labelEn: 'House Phone',
        labelZh: '住宅电话',
        control: 'text',
      },
      {
        key: 'phone_office',
        labelEn: 'Office Phone',
        labelZh: '办公室电话',
        control: 'text',
      },
      {
        key: 'email',
        labelEn: 'Email',
        labelZh: '邮箱',
        control: 'text',
        placeholder: 'example@email.com',
      },
      {
        key: 'corr_address',
        labelEn: 'Correspondence Address',
        labelZh: '通讯地址',
        control: 'text',
      },
      {
        key: 'corr_postcode',
        labelEn: 'Postcode',
        labelZh: '邮政编码',
        control: 'text',
      },
      {
        key: 'corr_city',
        labelEn: 'City',
        labelZh: '城市',
        control: 'text',
      },
      {
        key: 'corr_state',
        labelEn: 'State',
        labelZh: '州属',
        control: 'select',
        options: STATE_OPTIONS,
      },
      {
        key: 'corr_country',
        labelEn: 'Country',
        labelZh: '国家',
        control: 'text',
      },
      {
        key: 'perm_same_as_corr',
        labelEn: 'Same as Correspondence',
        labelZh: '与通讯地址相同',
        control: 'toggle',
      },
      {
        key: 'perm_address',
        labelEn: 'Permanent Address',
        labelZh: '永久地址',
        control: 'text',
        showIf: (d) => !d.perm_same_as_corr,
      },
      {
        key: 'perm_postcode',
        labelEn: 'Postcode',
        labelZh: '邮政编码',
        control: 'text',
        showIf: (d) => !d.perm_same_as_corr,
      },
      {
        key: 'perm_city',
        labelEn: 'City',
        labelZh: '城市',
        control: 'text',
        showIf: (d) => !d.perm_same_as_corr,
      },
      {
        key: 'perm_state',
        labelEn: 'State',
        labelZh: '州属',
        control: 'select',
        options: STATE_OPTIONS,
        showIf: (d) => !d.perm_same_as_corr,
      },
      {
        key: 'perm_country',
        labelEn: 'Country',
        labelZh: '国家',
        control: 'text',
        showIf: (d) => !d.perm_same_as_corr,
      },
    ],
  },

  // ─── Source of Funds ──────────────────────────────────────────────────────
  {
    key: 'funds',
    titleEn: 'Source of Funds & Purpose',
    titleZh: '资金来源与目的',
    fields: [
      {
        key: 'source_of_funds',
        labelEn: 'Source of Funds',
        labelZh: '资金来源',
        control: 'radio',
        options: [
          { value: 'employment', en: 'Employment', zh: '受薪' },
          { value: 'investment', en: 'Investment', zh: '投资' },
          { value: 'retirement', en: 'Retirement', zh: '退休金' },
          { value: 'sales_of_assets', en: 'Sales of Assets', zh: '资产出售' },
          { value: 'inheritance', en: 'Inheritance', zh: '继承' },
          { value: 'savings', en: 'Savings', zh: '储蓄' },
          { value: 'business', en: 'Business', zh: '商业' },
          { value: 'others', en: 'Others', zh: '其他' },
        ],
      },
      {
        key: 'source_of_funds_other',
        labelEn: 'Source of Funds (specify)',
        labelZh: '资金来源（请注明）',
        control: 'text',
        showIf: (d) => d.source_of_funds === 'others',
      },
      {
        key: 'purpose',
        labelEn: 'Purpose of Investment',
        labelZh: '投资目的',
        control: 'radio',
        options: [
          { value: 'investment', en: 'Investment', zh: '投资' },
          { value: 'retirement', en: 'Retirement', zh: '退休' },
          { value: 'protection', en: 'Protection', zh: '保障' },
          { value: 'others', en: 'Others', zh: '其他' },
        ],
      },
      {
        key: 'purpose_other',
        labelEn: 'Purpose (specify)',
        labelZh: '目的（请注明）',
        control: 'text',
        showIf: (d) => d.purpose === 'others',
      },
      {
        key: 'pep_status',
        labelEn: 'Politically Exposed Person (PEP)',
        labelZh: '政治敏感人士（PEP）',
        control: 'radio',
        options: [
          { value: 'yes', en: 'Yes', zh: '是' },
          { value: 'no', en: 'No', zh: '否' },
        ],
      },
    ],
  },

  // ─── Contribution & Banking ───────────────────────────────────────────────
  {
    key: 'contribution',
    titleEn: 'Contribution & Banking',
    titleZh: '供款与银行',
    fields: [
      {
        key: 'contribution_amount',
        labelEn: 'Contribution Amount (RM)',
        labelZh: '供款金额（RM）',
        control: 'text',
      },
      {
        key: 'cheque_no',
        labelEn: 'Cheque No.',
        labelZh: '支票号码',
        control: 'text',
      },
      {
        key: 'rsp_enabled',
        labelEn: 'Regular Savings Plan',
        labelZh: '定期储蓄计划',
        control: 'toggle',
      },
      {
        key: 'rsp_bank',
        labelEn: 'RSP Bank',
        labelZh: 'RSP 银行',
        control: 'text',
        showIf: (d) => d.rsp_enabled,
      },
      {
        key: 'rsp_bank_account_no',
        labelEn: 'RSP Bank Account No.',
        labelZh: 'RSP 银行账户号码',
        control: 'text',
        showIf: (d) => d.rsp_enabled,
      },
      {
        key: 'rsp_amount',
        labelEn: 'RSP Amount (RM)',
        labelZh: 'RSP 金额（RM）',
        control: 'text',
        showIf: (d) => d.rsp_enabled,
      },
      {
        key: 'rsp_deduction_day',
        labelEn: 'RSP Deduction Day',
        labelZh: 'RSP 扣款日',
        control: 'text',
        showIf: (d) => d.rsp_enabled,
      },
      {
        key: 'epf_redirection_percent',
        labelEn: 'EPF Redirection (%)',
        labelZh: 'EPF 转拨百分比（%）',
        control: 'select',
        options: [
          { value: '', en: '—', zh: '—' },
          { value: '1', en: '1%', zh: '1%' },
          { value: '2', en: '2%', zh: '2%' },
          { value: '3', en: '3%', zh: '3%' },
          { value: '4', en: '4%', zh: '4%' },
          { value: '5', en: '5%', zh: '5%' },
          { value: '6', en: '6%', zh: '6%' },
          { value: '7', en: '7%', zh: '7%' },
        ],
      },
      {
        key: 'salary_deduction_rm',
        labelEn: 'Salary Deduction (RM)',
        labelZh: '薪金扣款（RM）',
        control: 'text',
      },
      {
        key: 'salary_deduction_percent',
        labelEn: 'Salary Deduction (%)',
        labelZh: '薪金扣款（%）',
        control: 'text',
      },
      {
        key: 'bank_name',
        labelEn: 'Bank Name',
        labelZh: '银行名称',
        control: 'text',
      },
      {
        key: 'bank_account_number',
        labelEn: 'Bank Account No.',
        labelZh: '银行账户号码',
        control: 'text',
      },
      {
        key: 'epf_account_number',
        labelEn: 'EPF Account No.',
        labelZh: 'EPF 账户号码',
        control: 'text',
      },
      {
        key: 'ppa_account_no',
        labelEn: 'PPA Account No.',
        labelZh: 'PPA 账户号码',
        control: 'text',
      },
      {
        key: 'prs_plus_account_no',
        labelEn: 'PRS Plus Account No.',
        labelZh: 'PRS Plus 账户号码',
        control: 'text',
      },
      {
        key: 'topup_type',
        labelEn: 'Top-Up Type',
        labelZh: '追加类型',
        control: 'radio',
        options: [
          { value: 'topup', en: 'Top-Up', zh: '追加供款' },
          { value: 'change_direction', en: 'Change Direction', zh: '更改方向' },
        ],
      },
      {
        key: 'contribution_direction',
        labelEn: 'Contribution Direction',
        labelZh: '供款方向',
        control: 'radio',
        options: [
          { value: 'do_it_for_me', en: 'Do It For Me', zh: '代我操作' },
          { value: 'do_it_myself', en: 'Do It Myself', zh: '自行决定' },
        ],
      },
      {
        key: 'difm_scheme',
        labelEn: 'DIFM Scheme',
        labelZh: 'DIFM 计划',
        control: 'radio',
        options: [
          { value: 'prs_plus', en: 'PRS Plus', zh: 'PRS Plus' },
          { value: 'islamic_prs_plus', en: 'Islamic PRS Plus', zh: '伊斯兰 PRS Plus' },
        ],
        showIf: (d) => d.contribution_direction === 'do_it_for_me',
      },
    ],
    repeat: {
      key: 'dim_allocations',
      rows: 6,
      itemFields: [
        {
          key: 'fund',
          labelEn: 'Fund',
          labelZh: '基金',
          control: 'select',
          options: [
            { value: '', en: '—', zh: '—' },
            { value: 'Principal RetireEasy 2020', en: 'Principal RetireEasy 2020', zh: 'Principal RetireEasy 2020' },
            { value: 'Principal RetireEasy 2025', en: 'Principal RetireEasy 2025', zh: 'Principal RetireEasy 2025' },
            { value: 'Principal RetireEasy 2030', en: 'Principal RetireEasy 2030', zh: 'Principal RetireEasy 2030' },
            { value: 'Principal RetireEasy 2035', en: 'Principal RetireEasy 2035', zh: 'Principal RetireEasy 2035' },
            { value: 'Principal RetireEasy 2040', en: 'Principal RetireEasy 2040', zh: 'Principal RetireEasy 2040' },
            { value: 'Principal RetireEasy 2045', en: 'Principal RetireEasy 2045', zh: 'Principal RetireEasy 2045' },
            { value: 'Principal RetireEasy 2050', en: 'Principal RetireEasy 2050', zh: 'Principal RetireEasy 2050' },
            { value: 'Principal RetireEasy 2055', en: 'Principal RetireEasy 2055', zh: 'Principal RetireEasy 2055' },
            { value: 'Principal Islamic RetireEasy 2025', en: 'Principal Islamic RetireEasy 2025', zh: 'Principal Islamic RetireEasy 2025' },
            { value: 'Principal Islamic RetireEasy 2030', en: 'Principal Islamic RetireEasy 2030', zh: 'Principal Islamic RetireEasy 2030' },
            { value: 'Principal Islamic RetireEasy 2035', en: 'Principal Islamic RetireEasy 2035', zh: 'Principal Islamic RetireEasy 2035' },
            { value: 'Principal Islamic RetireEasy 2040', en: 'Principal Islamic RetireEasy 2040', zh: 'Principal Islamic RetireEasy 2040' },
            { value: 'Principal Islamic RetireEasy 2045', en: 'Principal Islamic RetireEasy 2045', zh: 'Principal Islamic RetireEasy 2045' },
            { value: 'Principal Islamic RetireEasy 2050', en: 'Principal Islamic RetireEasy 2050', zh: 'Principal Islamic RetireEasy 2050' },
            { value: 'Principal PRS Plus Conservative', en: 'Principal PRS Plus Conservative', zh: 'Principal PRS Plus Conservative' },
            { value: 'Principal PRS Plus Moderate', en: 'Principal PRS Plus Moderate', zh: 'Principal PRS Plus Moderate' },
            { value: 'Principal PRS Plus Growth', en: 'Principal PRS Plus Growth', zh: 'Principal PRS Plus Growth' },
            { value: 'Principal Islamic PRS Plus Conservative', en: 'Principal Islamic PRS Plus Conservative', zh: 'Principal Islamic PRS Plus Conservative' },
            { value: 'Principal Islamic PRS Plus Moderate', en: 'Principal Islamic PRS Plus Moderate', zh: 'Principal Islamic PRS Plus Moderate' },
            { value: 'Principal Islamic PRS Plus Growth', en: 'Principal Islamic PRS Plus Growth', zh: 'Principal Islamic PRS Plus Growth' },
          ],
        },
        {
          key: 'percent',
          labelEn: 'Allocation (%)',
          labelZh: '配置比例（%）',
          control: 'text',
          placeholder: '100',
        },
      ],
    },
  },

  // ─── Tax & CRS ────────────────────────────────────────────────────────────
  {
    key: 'tax',
    titleEn: 'Tax & CRS Declaration',
    titleZh: '税务与 CRS 声明',
    fields: [
      {
        key: 'tax_residency',
        labelEn: 'Tax Residency',
        labelZh: '税务居民身份',
        control: 'radio',
        options: [
          { value: 'resident', en: 'Tax Resident', zh: '税务居民' },
          { value: 'non_resident', en: 'Non-Resident', zh: '非居民' },
        ],
      },
      {
        key: 'tin_number',
        labelEn: 'TIN Number',
        labelZh: '纳税人识别号',
        control: 'text',
      },
      {
        key: 'place_of_birth',
        labelEn: 'Place of Birth',
        labelZh: '出生地点',
        control: 'text',
      },
      {
        key: 'country_of_birth',
        labelEn: 'Country of Birth',
        labelZh: '出生国家',
        control: 'text',
      },
    ],
    repeat: {
      key: 'crs_tax_residences',
      rows: 3,
      itemFields: [
        {
          key: 'country',
          labelEn: 'Country',
          labelZh: '国家',
          control: 'text',
        },
        {
          key: 'tin',
          labelEn: 'TIN',
          labelZh: '税务识别号',
          control: 'text',
        },
        {
          key: 'noTinReason',
          labelEn: 'No TIN Reason',
          labelZh: '无 TIN 原因',
          control: 'select',
          options: [
            { value: '', en: '—', zh: '—' },
            { value: 'A', en: 'A – Country does not issue TINs', zh: 'A – 该国不发放 TIN' },
            { value: 'B', en: 'B – Unable to obtain TIN', zh: 'B – 无法取得 TIN' },
            { value: 'C', en: 'C – TIN not required', zh: 'C – 不需要 TIN' },
          ],
        },
        {
          key: 'reasonBExplanation',
          labelEn: 'Reason B Explanation',
          labelZh: '原因 B 说明',
          control: 'text',
        },
      ],
    },
  },

  // ─── Nomination ───────────────────────────────────────────────────────────
  {
    key: 'nomination',
    titleEn: 'Beneficiary Nomination',
    titleZh: '受益人提名',
    fields: [
      {
        key: 'religion_islam',
        labelEn: 'Religion',
        labelZh: '宗教',
        control: 'radio',
        options: [
          { value: 'muslim', en: 'Muslim', zh: '穆斯林' },
          { value: 'non_muslim', en: 'Non-Muslim', zh: '非穆斯林' },
        ],
      },
    ],
    repeat: {
      key: 'nominees',
      rows: 6,
      itemFields: [
        {
          key: 'name',
          labelEn: 'Full Name',
          labelZh: '全名',
          control: 'text',
        },
        {
          key: 'nric',
          labelEn: 'NRIC',
          labelZh: '身份证号码',
          control: 'text',
        },
        {
          key: 'mobile',
          labelEn: 'Mobile',
          labelZh: '手机号码',
          control: 'text',
        },
        {
          key: 'email',
          labelEn: 'Email',
          labelZh: '邮箱',
          control: 'text',
        },
        {
          key: 'percentage',
          labelEn: 'Share (%)',
          labelZh: '分配比例（%）',
          control: 'text',
          placeholder: '100',
        },
      ],
    },
  },

  // ─── ISA ──────────────────────────────────────────────────────────────────
  {
    key: 'isa',
    titleEn: 'Investor Suitability Assessment',
    titleZh: '投资适当性评估',
    fields: [
      {
        key: 'isa_mode',
        labelEn: 'ISA Mode',
        labelZh: 'ISA 模式',
        control: 'radio',
        options: [
          { value: 'new', en: 'New Investor', zh: '新投资者' },
          { value: 'review', en: 'Review', zh: '复审' },
        ],
      },
      {
        key: 'isa_education',
        labelEn: 'Education Level',
        labelZh: '教育程度',
        control: 'radio',
        options: [
          { value: 'degree_above', en: 'Degree & above', zh: '大学及以上' },
          { value: 'diploma', en: 'Diploma', zh: '文凭' },
          { value: 'stpm', en: 'STPM', zh: '高考' },
          { value: 'spm_below', en: 'SPM & below', zh: '中学及以下' },
        ],
      },
      {
        key: 'isa_disposable_income',
        labelEn: 'Monthly Disposable Income',
        labelZh: '每月可支配收入',
        control: 'radio',
        options: [
          { value: 'below_5000', en: '<RM5,000', zh: '<RM5,000' },
          { value: '5001_8000', en: 'RM5,001-8,000', zh: 'RM5,001-8,000' },
          { value: '8001_15000', en: 'RM8,001-15,000', zh: 'RM8,001-15,000' },
          { value: 'above_15001', en: '>RM15,001', zh: '>RM15,001' },
        ],
      },
      {
        key: 'isa_commitment',
        labelEn: 'Monthly Financial Commitment',
        labelZh: '每月财务承担',
        control: 'radio',
        options: [
          { value: 'below_2000', en: '<RM2,000', zh: '<RM2,000' },
          { value: '2001_5000', en: 'RM2,001-5,000', zh: 'RM2,001-5,000' },
          { value: '5001_10000', en: 'RM5,001-10,000', zh: 'RM5,001-10,000' },
          { value: 'above_10001', en: '>RM10,001', zh: '>RM10,001' },
        ],
      },
      {
        key: 'isa_invest_pct',
        labelEn: 'Investment as % of Net Worth',
        labelZh: '投资占净资产百分比',
        control: 'radio',
        options: [
          { value: 'below_10', en: '<10%', zh: '<10%' },
          { value: '11_20', en: '11-20%', zh: '11-20%' },
          { value: '21_30', en: '21-30%', zh: '21-30%' },
          { value: '31_40', en: '31-40%', zh: '31-40%' },
          { value: '41_50', en: '41-50%', zh: '41-50%' },
          { value: 'above_50', en: '>50%', zh: '>50%' },
        ],
      },
      {
        key: 'isa_expectation',
        labelEn: 'Investment Expectation',
        labelZh: '投资期望',
        control: 'radio',
        options: [
          { value: 'capital_growth', en: 'Capital Growth', zh: '资本增值' },
          { value: 'regular_income', en: 'Regular Income', zh: '定期收入' },
          { value: 'capital_protection', en: 'Capital Protection', zh: '资本保值' },
        ],
      },
      {
        key: 'isa_purpose',
        labelEn: 'Purpose of Investment',
        labelZh: '投资目的',
        control: 'radio',
        options: [
          { value: 'asset_accumulation', en: 'Asset Accumulation', zh: '资产积累' },
          { value: 'children_education', en: "Children's Education", zh: '子女教育' },
          { value: 'retirement', en: 'Retirement', zh: '退休规划' },
          { value: 'regular_income', en: 'Regular Income', zh: '定期收入' },
          { value: 'others', en: 'Others', zh: '其他' },
        ],
      },
      {
        key: 'isa_purpose_other',
        labelEn: 'Purpose (specify)',
        labelZh: '目的（请注明）',
        control: 'text',
        showIf: (d) => d.isa_purpose === 'others',
      },
      {
        key: 'isa_reasons',
        labelEn: 'Reasons for Investment',
        labelZh: '投资原因',
        control: 'multicheck',
        options: [
          { value: 'meet_objective', en: 'Meets my objective', zh: '符合我的目标' },
          { value: 'risk_return', en: 'Suitable risk/return', zh: '风险回报适合' },
          { value: 'strategy', en: 'Complements my strategy', zh: '互补策略' },
        ],
      },
      {
        key: 'isa_exp_unit_trust',
        labelEn: 'Unit Trust Experience (years)',
        labelZh: '单位信托投资经验（年）',
        control: 'text',
      },
      {
        key: 'isa_exp_bond',
        labelEn: 'Bond Experience (years)',
        labelZh: '债券投资经验（年）',
        control: 'text',
      },
      {
        key: 'isa_exp_equities',
        labelEn: 'Equities Experience (years)',
        labelZh: '股票投资经验（年）',
        control: 'text',
      },
      {
        key: 'isa_exp_derivatives',
        labelEn: 'Derivatives Experience (years)',
        labelZh: '衍生品投资经验（年）',
        control: 'text',
      },
      {
        key: 'isa_exp_prs',
        labelEn: 'PRS Experience (years)',
        labelZh: 'PRS 投资经验（年）',
        control: 'text',
      },
      {
        key: 'isa_exp_others',
        labelEn: 'Other Investment Experience (years)',
        labelZh: '其他投资经验（年）',
        control: 'text',
      },
      {
        key: 'isa_q1_age',
        labelEn: 'Q1: Age',
        labelZh: 'Q1：年龄',
        control: 'radio',
        options: [
          { value: '1', en: '55 years or above', zh: '55岁及以上' },
          { value: '3', en: '36-54 years', zh: '36-54岁' },
          { value: '5', en: '35 years & below', zh: '35岁及以下' },
        ],
      },
      {
        key: 'isa_q2_experience',
        labelEn: 'Q2: Investment Experience',
        labelZh: 'Q2：投资经验',
        control: 'radio',
        options: [
          { value: '1', en: 'No experience', zh: '无经验' },
          { value: '3', en: '1-3 years', zh: '1-3年' },
          { value: '5', en: 'More than 3 years', zh: '3年以上' },
        ],
      },
      {
        key: 'isa_q3_understanding',
        labelEn: 'Q3: Product Understanding',
        labelZh: 'Q3：产品了解程度',
        control: 'radio',
        options: [
          { value: '1', en: 'Do not understand', zh: '不了解' },
          { value: '3', en: 'Basic understanding', zh: '基本了解' },
          { value: '5', en: 'Good understanding', zh: '充分了解' },
        ],
      },
      {
        key: 'isa_q4_objective',
        labelEn: 'Q4: Investment Objective',
        labelZh: 'Q4：投资目标',
        control: 'radio',
        options: [
          { value: '1', en: 'Capital protection', zh: '保值' },
          { value: '3', en: 'Moderate growth', zh: '稳健增长' },
          { value: '5', en: 'Capital growth', zh: '增值' },
        ],
      },
      {
        key: 'isa_q5_duration',
        labelEn: 'Q5: Investment Duration',
        labelZh: 'Q5：投资期限',
        control: 'radio',
        options: [
          { value: '1', en: 'Less than 3 years', zh: '少于3年' },
          { value: '3', en: '3-10 years', zh: '3-10年' },
          { value: '5', en: 'More than 10 years', zh: '10年以上' },
        ],
      },
      {
        key: 'isa_q6_risk',
        labelEn: 'Q6: Risk Tolerance',
        labelZh: 'Q6：风险承受能力',
        control: 'radio',
        options: [
          { value: '1', en: 'Not comfortable', zh: '不适' },
          { value: '3', en: 'Somewhat comfortable', zh: '尚可' },
          { value: '5', en: 'Comfortable', zh: '适应' },
        ],
      },
      {
        key: 'isa_vulnerable',
        labelEn: 'Vulnerable Customer Characteristics',
        labelZh: '弱势客户属性',
        control: 'multicheck',
        options: [
          { value: 'elderly', en: 'Elderly', zh: '老年人' },
          { value: 'low_education', en: 'Low Education', zh: '教育程度低' },
          { value: 'no_experience', en: 'No Investment Experience', zh: '无投资经验' },
          { value: 'limited_means', en: 'Limited Financial Means', zh: '经济能力有限' },
          { value: 'breadwinner_loss', en: 'Loss of Breadwinner', zh: '失去经济支柱' },
          { value: 'impairment', en: 'Mental/Physical Impairment', zh: '身心障碍' },
          { value: 'none', en: 'None of the above', zh: '以上皆否' },
        ],
      },
    ],
    repeat: {
      key: 'isa_acks',
      rows: 5,
      itemFields: [
        {
          key: 'value',
          labelEn: 'Acknowledgment',
          labelZh: '确认',
          control: 'radio',
          options: [
            { value: 'yes', en: 'Yes', zh: '是' },
            { value: 'no', en: 'No', zh: '否' },
          ],
        },
      ],
    },
  },

  // ─── Advisor Section ──────────────────────────────────────────────────────
  {
    key: 'advisor',
    titleEn: 'Advisor Section',
    titleZh: '顾问专区',
    advisorOnly: true,
    fields: [
      {
        key: 'consultant_name',
        labelEn: 'Consultant Name',
        labelZh: '顾问姓名',
        control: 'text',
      },
      {
        key: 'consultant_code',
        labelEn: 'Consultant Code',
        labelZh: '顾问代码',
        control: 'text',
      },
      {
        key: 'consultant_nric',
        labelEn: 'Consultant NRIC',
        labelZh: '顾问身份证号码',
        control: 'text',
      },
      {
        key: 'consultant_phone',
        labelEn: 'Consultant Phone',
        labelZh: '顾问电话',
        control: 'text',
      },
      {
        key: 'branch_name_code',
        labelEn: 'Branch Name / Code',
        labelZh: '分行名称/代码',
        control: 'text',
      },
      {
        key: 'distributor_code',
        labelEn: 'Distributor Code',
        labelZh: '分销商代码',
        control: 'text',
      },
      {
        key: 'channel',
        labelEn: 'Channel',
        labelZh: '销售渠道',
        control: 'radio',
        options: [
          { value: 'prs_consultant', en: 'PRS Consultant', zh: 'PRS 咨询顾问' },
          { value: 'corporate_prs_distributor', en: 'Corporate PRS Distributor', zh: '企业分销商' },
          { value: 'institutional_prs_adviser', en: 'Institutional PRS Adviser', zh: '机构顾问' },
        ],
      },
      {
        key: 'class_for_application',
        labelEn: 'Class for Application',
        labelZh: '申请类别',
        control: 'text',
      },
      {
        key: 'utc_recommended_category',
        labelEn: 'UTC Recommended Category',
        labelZh: 'UTC 推荐类别',
        control: 'radio',
        options: [
          { value: 'conservative', en: 'Conservative', zh: '保守型' },
          { value: 'moderate', en: 'Moderate', zh: '稳健型' },
          { value: 'aggressive', en: 'Aggressive', zh: '进取型' },
        ],
      },
      {
        key: 'utc_basis',
        labelEn: 'UTC Basis',
        labelZh: 'UTC 依据',
        control: 'multicheck',
        options: [
          { value: 'risk_profile', en: 'Risk Profile', zh: '风险评级' },
          { value: 'objectives_horizon', en: 'Objectives & Horizon', zh: '目标与期限' },
          { value: 'complements_portfolio', en: 'Complements Portfolio', zh: '互补投资组合' },
          { value: 'others', en: 'Others', zh: '其他' },
        ],
      },
      {
        key: 'utc_basis_other',
        labelEn: 'UTC Basis (specify)',
        labelZh: 'UTC 依据（请注明）',
        control: 'text',
      },
      {
        key: 'sign_date',
        labelEn: 'Signing Date',
        labelZh: '签署日期',
        control: 'date',
      },
    ],
    repeat: {
      key: 'utc_funds',
      rows: 5,
      itemFields: [
        {
          key: 'value',
          labelEn: 'Recommended Fund',
          labelZh: '推荐基金',
          control: 'text',
        },
      ],
    },
  },
];
