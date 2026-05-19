import React from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import type { Lead } from './types';
import { getStage, getLeadSource } from './stages';

interface Props {
  lead: Lead;
  onClick: () => void;
  language: string;
  isDragging?: boolean;
}

function nextActionStatus(dateStr: string | null): { label: string; cls: string } | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: `Overdue ${Math.abs(diff)}d`, cls: 'text-red-600 bg-red-50' };
  if (diff === 0) return { label: 'Today',  cls: 'text-orange-600 bg-orange-50' };
  if (diff === 1) return { label: 'Tomorrow', cls: 'text-amber-600 bg-amber-50' };
  return { label: dateStr, cls: 'text-slate-400 bg-slate-50' };
}

function daysInStage(stageUpdatedAt: string | null, createdAt: string): number {
  const base = stageUpdatedAt ?? createdAt;
  return Math.max(0, Math.floor((Date.now() - new Date(base).getTime()) / 86400000));
}

export default function LeadCard({ lead, onClick, language, isDragging }: Props) {
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const source = getLeadSource(lead.lead_source);
  const actionStatus = nextActionStatus(lead.next_action_date);
  const days = daysInStage(lead.stage_updated_at, lead.created_at);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-100 p-3.5 cursor-pointer hover:border-xin-gold/50 hover:shadow-sm transition-all select-none ${
        isDragging ? 'shadow-lg rotate-1 opacity-90' : ''
      }`}
    >
      {/* Name row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-xin-blue/10 text-xin-blue font-bold text-xs flex items-center justify-center shrink-0">
            {lead.full_name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-xin-blue truncate">{lead.full_name}</span>
        </div>
        {/* Overdue icon */}
        {actionStatus && actionStatus.cls.includes('red') && (
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
        )}
      </div>

      {/* Source + days in stage */}
      <div className="flex items-center gap-1.5 mb-2.5">
        {source && (
          <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md font-medium">
            {language === 'zh' ? source.zh : source.en}
          </span>
        )}
        <span className="text-[10px] text-slate-300">·</span>
        <span className="text-[10px] text-slate-400">{days}d {t('in stage', '在此阶段')}</span>
      </div>

      {/* Next action */}
      {lead.next_action ? (
        <div className="border-t border-slate-50 pt-2.5 space-y-1">
          <p className="text-xs text-slate-600 line-clamp-2">{lead.next_action}</p>
          {actionStatus && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${actionStatus.cls}`}>
              <Calendar size={9} />
              {actionStatus.label}
            </span>
          )}
        </div>
      ) : (
        <div className="border-t border-slate-50 pt-2.5">
          <span className="text-[10px] text-slate-300 italic">{t('No next action set', '未设定下一步')}</span>
        </div>
      )}
    </div>
  );
}
