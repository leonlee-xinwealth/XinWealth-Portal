import React, { useState } from 'react';
import { X } from 'lucide-react';
import { LOST_REASONS } from './stages';
import type { LostPayload } from './types';
import type { LostReasonKey } from './stages';

interface Props {
  leadId: string;
  onConfirm: (payload: LostPayload) => void;
  onCancel: () => void;
  language: string;
}

export default function LostReasonDialog({ leadId, onConfirm, onCancel, language }: Props) {
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [category, setCategory] = useState<LostReasonKey | null>(null);
  const [notes, setNotes] = useState('');

  function handleConfirm() {
    if (!category) return;
    onConfirm({ leadId, category, notes });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-xin-blue">{t('Mark as Closed Lost', '标记为已流失')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t('Please select a reason', '请选择流失原因')}</p>
          </div>
          <button onClick={onCancel} className="text-slate-300 hover:text-slate-500">
            <X size={18} />
          </button>
        </div>

        {/* Reasons */}
        <div className="px-5 py-4 space-y-2">
          {LOST_REASONS.map(r => (
            <button
              key={r.key}
              onClick={() => setCategory(r.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all ${
                category === r.key
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                category === r.key ? 'border-rose-500' : 'border-slate-300'
              }`}>
                {category === r.key && <div className="w-2 h-2 rounded-full bg-rose-500" />}
              </div>
              {language === 'zh' ? r.zh : r.en}
            </button>
          ))}

          {/* Notes */}
          <div className="pt-1">
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">
              {t('Notes (optional)', '备注（选填）')}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={t('Any additional details…', '其他说明…')}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={handleConfirm}
            disabled={!category}
            className="flex-1 py-3 bg-rose-500 text-white font-semibold rounded-xl text-sm hover:bg-rose-600 disabled:opacity-40 transition-colors"
          >
            {t('Confirm Lost', '确认流失')}
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-3 bg-white border border-slate-200 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50"
          >
            {t('Cancel', '取消')}
          </button>
        </div>
      </div>
    </div>
  );
}
