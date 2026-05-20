import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { STAGES, getStage } from './stages';
import LeadCard from './LeadCard';
import type { Lead } from './types';
import type { StageKey } from './stages';

interface Props {
  leads: Lead[];
  showLost: boolean;
  onMoveStage: (leadId: string, stage: StageKey) => void;
  onSelectLead: (lead: Lead) => void;
  language: string;
}

// ── Droppable column ──────────────────────────────────────────
function Column({
  stageKey, leads, isOver, language, onSelectLead,
}: {
  stageKey: StageKey;
  leads: Lead[];
  isOver: boolean;
  language: string;
  onSelectLead: (lead: Lead) => void;
}) {
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const meta = getStage(stageKey);
  const overdue = leads.filter(l => l.next_action_date && l.next_action_date < new Date().toISOString().split('T')[0]).length;

  return (
    <div className={`flex flex-col min-h-[400px] rounded-2xl border transition-colors ${
      isOver ? 'border-xin-gold bg-xin-gold/5' : `${meta.border} bg-slate-50/60`
    }`}>
      {/* Column header */}
      <div className={`px-3 py-2.5 flex items-center justify-between border-b ${meta.border}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${meta.text}`}>
            {language === 'zh' ? STAGES.find(s => s.key === stageKey)?.zh : STAGES.find(s => s.key === stageKey)?.en}
          </span>
          {overdue > 0 && (
            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
              {overdue} {t('overdue', '逾期')}
            </span>
          )}
        </div>
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.text}`}>
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-slate-300">
            {t('Drop here', '拖到此处')}
          </div>
        )}
        {leads.map(lead => (
          <DraggableCard key={lead.id} lead={lead} language={language} onSelectLead={onSelectLead} />
        ))}
      </div>
    </div>
  );
}

// ── Draggable card wrapper ────────────────────────────────────
function DraggableCard({ lead, language, onSelectLead }: { lead: Lead; language: string; onSelectLead: (l: Lead) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <LeadCard lead={lead} onClick={() => onSelectLead(lead)} language={language} />
    </div>
  );
}

// ── Droppable column wrapper ──────────────────────────────────
function DroppableColumn({ stageKey, leads, language, onSelectLead }: {
  stageKey: StageKey; leads: Lead[]; language: string; onSelectLead: (l: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey });
  return (
    <div ref={setNodeRef} className="flex-1 min-w-[200px]">
      <Column stageKey={stageKey} leads={leads} isOver={isOver} language={language} onSelectLead={onSelectLead} />
    </div>
  );
}

// ── Main board ───────────────────────────────────────────────
export default function KanbanBoard({ leads, showLost, onMoveStage, onSelectLead, language }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const visibleStages = showLost ? STAGES : STAGES.filter(s => s.key !== 'closed_lost');

  const leadsByStage = (key: StageKey) => leads.filter(l => l.pipeline_stage === key);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const newStage = String(over.id) as StageKey;
    const lead = leads.find(l => l.id === String(active.id));
    if (!lead || lead.pipeline_stage === newStage) return;
    onMoveStage(String(active.id), newStage);
  }

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {visibleStages.map(stage => (
          <DroppableColumn
            key={stage.key}
            stageKey={stage.key}
            leads={leadsByStage(stage.key)}
            language={language}
            onSelectLead={onSelectLead}
          />
        ))}
      </div>

      {/* Drag overlay: ghost card while dragging */}
      <DragOverlay>
        {activeLead && (
          <div className="w-[220px]">
            <LeadCard lead={activeLead} onClick={() => {}} language={language} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
