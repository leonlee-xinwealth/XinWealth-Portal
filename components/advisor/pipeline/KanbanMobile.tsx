import React, { useState } from 'react';
import { STAGES, getStage } from './stages';
import LeadCard from './LeadCard';
import type { Lead } from './types';
import type { StageKey } from './stages';

interface Props {
  leads: Lead[];
  showLost: boolean;
  onSelectLead: (lead: Lead) => void;
  language: string;
}

export default function KanbanMobile({ leads, showLost, onSelectLead, language }: Props) {
  const visibleStages = showLost ? STAGES : STAGES.filter(s => s.key !== 'closed_lost');
  const [activeStage, setActiveStage] = useState<StageKey>(visibleStages[0].key);

  const stageLeads = leads.filter(l => l.pipeline_stage === activeStage);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Stage tabs — horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {visibleStages.map(s => {
          const count = leads.filter(l => l.pipeline_stage === s.key).length;
          const hasOverdue = leads.some(l =>
            l.pipeline_stage === s.key && l.next_action_date && l.next_action_date < today
          );
          const isActive = activeStage === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActiveStage(s.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shrink-0 transition-all ${
                isActive
                  ? `${s.bg} ${s.text} ${s.border}`
                  : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              {language === 'zh' ? s.zh : s.en}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-white/60' : 'bg-slate-100'
              } ${hasOverdue ? 'text-red-600' : ''}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Card list for active stage */}
      <div className="space-y-2">
        {stageLeads.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-xs text-slate-300">
            {language === 'zh' ? '此阶段没有线索' : 'No leads in this stage'}
          </div>
        ) : (
          stageLeads.map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onSelectLead(lead)} language={language} />
          ))
        )}
      </div>
    </div>
  );
}
