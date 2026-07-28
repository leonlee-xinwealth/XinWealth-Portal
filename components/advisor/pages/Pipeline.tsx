import React, { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, Link2, Check } from 'lucide-react';
import KanbanBoard from '../pipeline/KanbanBoard';
import KanbanMobile from '../pipeline/KanbanMobile';
import LeadDetailPanel from '../pipeline/LeadDetailPanel';
import LostReasonDialog from '../pipeline/LostReasonDialog';
import type { Lead, LostPayload } from '../pipeline/types';
import type { StageKey } from '../pipeline/stages';

export default function Pipeline() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [advisorId, setAdvisorId] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [pendingLost, setPendingLost] = useState<{ leadId: string } | null>(null);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: adv } = await supabase.from('advisors').select('id, referral_code').eq('user_id', user.id).single();
    if (!adv) return;
    setAdvisorId(adv.id);
    setReferralCode(adv.referral_code ?? null);

    const { data } = await supabase
      .from('clients')
      .select('id, full_name, pipeline_stage, lead_source, next_action, next_action_date, lost_reason_category, lost_reason_notes, stage_updated_at, status, created_at')
      .eq('advisor_id', adv.id)
      .or(`status.eq.prospect,and(status.eq.active,pipeline_stage.eq.closed_won,stage_updated_at.gte.${thirtyDaysAgo})`)
      .order('next_action_date', { ascending: true, nullsFirst: false });

    setLeads((data as Lead[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function moveStage(leadId: string, newStage: StageKey) {
    if (newStage === 'closed_lost') {
      setPendingLost({ leadId });
      return;
    }
    if (newStage === 'closed_won') {
      const lead = leads.find(l => l.id === leadId);
      const name = lead?.full_name ?? '';
      if (!confirm(t(
        `Confirm ${name} has signed? They will be moved to your active clients.`,
        `确认 ${name} 已成交？将自动转为正式客户。`
      ))) return;
    }
    // Optimistic update (both list + open panel) for instant UI feedback
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_stage: newStage } : l));
    setSelectedLead(prev => prev?.id === leadId ? { ...prev, pipeline_stage: newStage } : prev);
    await supabase.from('clients').update({ pipeline_stage: newStage }).eq('id', leadId);
    // Refetch to sync trigger side-effects (status, onboarded_at, stage_updated_at)
    await load();
  }

  async function confirmLost(payload: LostPayload) {
    setLeads(prev => prev.map(l => l.id === payload.leadId
      ? { ...l, pipeline_stage: 'closed_lost', lost_reason_category: payload.category, lost_reason_notes: payload.notes }
      : l
    ));
    await supabase.from('clients').update({
      pipeline_stage: 'closed_lost',
      lost_reason_category: payload.category,
      lost_reason_notes: payload.notes,
    }).eq('id', payload.leadId);
    setPendingLost(null);
    setSelectedLead(null);
    await load();
  }

  async function updateLead(leadId: string, fields: Partial<Lead>) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...fields } : l));
    setSelectedLead(prev => prev?.id === leadId ? { ...prev, ...fields } : prev);
    await supabase.from('clients').update(fields).eq('id', leadId);
  }

  const visibleLeads = showLost ? leads : leads.filter(l => l.pipeline_stage !== 'closed_lost');
  const isMobile = useSyncExternalStore(
    cb => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); },
    () => window.innerWidth < 768,
    () => false
  );

  async function copyKycLink() {
    const link = referralCode
      ? `${window.location.origin}/kyc?ref=${referralCode}`
      : `${window.location.origin}/kyc`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t('Copy this KYC link:', '复制此 KYC 链接：'), link);
    }
  }

  if (loading) return <Loader />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-xin-blue">
            {t('Prospect Status Board', '潜在客户状态板')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {leads.filter(l => l.status === 'prospect').length} {t('prospects', '个潜在客户')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Show lost toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500 select-none">
            <div
              onClick={() => setShowLost(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative ${showLost ? 'bg-rose-400' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showLost ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            {t('Show Lost', '显示流失')}
          </label>
          {/* Copy personal KYC link for clients to self-fill */}
          <button
            onClick={copyKycLink}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Link2 size={15} />}
            {copied ? t('Copied!', '已复制！') : t('Copy KYC Link', '复制 KYC 链接')}
          </button>
          {/* New prospect */}
          <button
            onClick={() => navigate('/advisor/clients/new?quick=1')}
            className="flex items-center gap-1.5 bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors"
          >
            <Plus size={15} />
            {t('New Lead', '新线索')}
          </button>
        </div>
      </div>

      {/* Board */}
      {isMobile ? (
        <KanbanMobile
          leads={visibleLeads}
          showLost={showLost}
          onSelectLead={setSelectedLead}
          language={language}
        />
      ) : (
        <KanbanBoard
          leads={visibleLeads}
          showLost={showLost}
          onMoveStage={moveStage}
          onSelectLead={setSelectedLead}
          language={language}
        />
      )}

      {/* Detail panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onMoveStage={moveStage}
          onUpdateLead={updateLead}
          onRefresh={load}
          language={language}
        />
      )}

      {/* Lost reason dialog */}
      {pendingLost && (
        <LostReasonDialog
          onConfirm={confirmLost}
          onCancel={() => setPendingLost(null)}
          leadId={pendingLost.leadId}
          language={language}
        />
      )}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue" />
    </div>
  );
}
