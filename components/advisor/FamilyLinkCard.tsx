import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useLanguage } from '../../context/LanguageContext';

// Family relationships between clients of the same advisor. Rows are stored
// bidirectionally by a DB trigger (see 20260817000001_client_relationships.sql),
// so reading is always a plain .eq('client_id', …) and unlinking one side
// removes both.
//
// Rendered as the inner content of a ProfileTab <Card>, so it carries no card
// chrome of its own.

export const RELATIONSHIP_TYPES = ['spouse', 'child', 'parent', 'sibling', 'other'] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_LABEL: Record<RelationshipType, { en: string; zh: string }> = {
  spouse: { en: 'Spouse', zh: '配偶' },
  child: { en: 'Child', zh: '子女' },
  parent: { en: 'Parent', zh: '父母' },
  sibling: { en: 'Sibling', zh: '兄弟姐妹' },
  other: { en: 'Other', zh: '其他' },
};

// Both FKs point at clients, so PostgREST needs the constraint name to know
// which one to embed.
const RELATED_JOIN =
  'id, relationship_type, related_client_id, related:clients!client_relationships_related_client_id_fkey(full_name, status)';

export interface FamilyRelation {
  id: string;
  relationship_type: RelationshipType;
  related_client_id: string;
  related: { full_name: string; status: string } | null;
}

/** Shared loader — ClientDetail reuses it for the header spouse chip. */
export async function fetchFamilyRelations(clientId: string): Promise<FamilyRelation[]> {
  const { data } = await supabase
    .from('client_relationships')
    .select(RELATED_JOIN)
    .eq('client_id', clientId);
  return ((data as any[]) ?? []).map(r => ({
    ...r,
    related: Array.isArray(r.related) ? r.related[0] ?? null : r.related,
  })) as FamilyRelation[];
}

export default function FamilyLinkCard({ client }: { client: any }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);
  const navigate = useNavigate();

  const [rels, setRels] = useState<FamilyRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [relType, setRelType] = useState<RelationshipType>('spouse');
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setRels(await fetchFamilyRelations(client.id));
    setLoading(false);
  }

  useEffect(() => { setLoading(true); load(); }, [client.id]);

  async function openPicker() {
    setError('');
    setTargetId('');
    setPicking(true);
    // Same query the client list uses, minus this client and anyone already linked.
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, status')
      .eq('advisor_id', client.advisor_id)
      .order('full_name');
    const linked = new Set(rels.map(r => r.related_client_id));
    setCandidates(((data as any[]) ?? []).filter(c => c.id !== client.id && !linked.has(c.id)));
  }

  async function handleLink() {
    if (!targetId || saving) return;
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('client_relationships').insert({
      advisor_id: client.advisor_id,
      client_id: client.id,
      related_client_id: targetId,
      relationship_type: relType,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setPicking(false);
    await load();
  }

  async function handleUnlink(rel: FamilyRelation) {
    const name = rel.related?.full_name ?? '';
    if (!confirm(t(`Unlink ${name}?`, `确定解除与 ${name} 的关系链接？`))) return;
    const { error: err } = await supabase.from('client_relationships').delete().eq('id', rel.id);
    if (err) { setError(err.message); return; }
    await load();
  }

  if (loading) {
    return <div className="py-3 text-sm text-slate-400">…</div>;
  }

  return (
    <div>
      {rels.length === 0 ? (
        <div className="py-2 text-sm text-slate-400">
          {t('No family members linked.', '尚未链接家庭成员。')}
        </div>
      ) : (
        rels.map(rel => (
          <div key={rel.id} className="flex items-center py-2 border-b border-slate-50 last:border-0 gap-2">
            <span className="w-32 shrink-0 text-xs text-slate-400 font-medium">
              {t(RELATIONSHIP_LABEL[rel.relationship_type].en, RELATIONSHIP_LABEL[rel.relationship_type].zh)}
            </span>
            <button
              onClick={() => navigate(`/advisor/clients/${rel.related_client_id}`)}
              className="flex-1 text-left text-sm text-xin-blue hover:text-xin-gold transition-colors truncate"
            >
              {rel.related?.full_name ?? '—'}
            </button>
            <button
              onClick={() => handleUnlink(rel)}
              className="text-xs text-slate-300 hover:text-red-500 transition-colors shrink-0"
            >
              {t('Unlink', '解除')}
            </button>
          </div>
        ))
      )}

      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}

      <button
        onClick={openPicker}
        className="mt-3 text-xs font-semibold text-xin-blue hover:text-xin-gold transition-colors"
      >
        ＋ {t('Link family member', '链接家庭成员')}
      </button>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-serif text-lg font-bold text-xin-blue mb-4">
              {t('Link family member', '链接家庭成员')}
            </h3>

            <label className="block text-xs text-slate-400 font-medium mb-1">
              {t('Relationship', '关系')}
            </label>
            <select
              value={relType}
              onChange={e => setRelType(e.target.value as RelationshipType)}
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:border-xin-gold"
            >
              {RELATIONSHIP_TYPES.map(rt => (
                <option key={rt} value={rt}>
                  {t(RELATIONSHIP_LABEL[rt].en, RELATIONSHIP_LABEL[rt].zh)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mb-3">
              {t(
                `Describes who the selected client is to ${client.full_name}.`,
                `表示所选客户是 ${client.full_name} 的什么人。`,
              )}
            </p>

            <label className="block text-xs text-slate-400 font-medium mb-1">
              {t('Client', '客户')}
            </label>
            <select
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold"
            >
              <option value="">{t('Select a client…', '选择客户…')}</option>
              {candidates.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
            {candidates.length === 0 && (
              <p className="mt-2 text-xs text-slate-400">
                {t('No other clients available to link.', '没有可链接的其他客户。')}
              </p>
            )}

            {error && <div className="mt-3 text-xs text-red-600">{error}</div>}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setPicking(false); setError(''); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                {t('Cancel', '取消')}
              </button>
              <button
                onClick={handleLink}
                disabled={!targetId || saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-xin-blue text-white hover:bg-xin-blueLight disabled:opacity-50"
              >
                {saving ? '…' : t('Link', '链接')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
