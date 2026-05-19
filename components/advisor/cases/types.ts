export interface Case {
  id: string;
  case_number: string;
  client_id: string;
  advisor_id: string;
  case_type: string;
  status: 'open' | 'completed' | 'cancelled' | 'lost';
  renewed_from_policy_id: string | null;
  due_date: string | null;          // ISO date string (YYYY-MM-DD)
  notes: string | null;
  lost_reason_category: 'price' | 'no_need' | 'switched_competitor' | 'lost_contact' | 'other' | null;
  lost_reason_notes: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  // 前端 join 字段（从 Supabase select 时附带）
  client_full_name?: string;
}

export interface CaseChecklistItem {
  id: string;
  case_id: string;
  item_key: string;
  label_en: string;
  label_zh: string;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
}

export interface CaseLostPayload {
  caseId: string;
  category: 'price' | 'no_need' | 'switched_competitor' | 'lost_contact' | 'other';
  notes: string;
}

export interface NewCasePayload {
  client_id: string;
  advisor_id: string;
  case_type: string;
  due_date?: string | null;
  renewed_from_policy_id?: string | null;
}

// 新建 Policy 时需要填的字段（Mark Completed 时强制）
export interface NewPolicyFromCase {
  case_id: string;
  client_id: string;
  advisor_id: string;
  policy_number: string;
  premium: number;
  effective_date: string;
  expiry_date: string;
}
