import type { StageKey, LeadSourceKey, LostReasonKey } from './stages';

export interface Lead {
  id: string;
  full_name: string;
  pipeline_stage: StageKey;
  lead_source: LeadSourceKey | null;
  next_action: string | null;
  next_action_date: string | null;  // ISO date 'YYYY-MM-DD'
  lost_reason_category: LostReasonKey | null;
  lost_reason_notes: string | null;
  stage_updated_at: string | null;
  status: 'prospect' | 'active' | 'inactive';
  created_at: string;
  metadata?: Record<string, any>;
}

export interface LostPayload {
  leadId: string;
  category: LostReasonKey;
  notes: string;
}
