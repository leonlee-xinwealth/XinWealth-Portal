// components/advisor/prs/PrsForm.tsx
import React from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { isaTotalScore, riskProfileFromScore, type PrsFormData } from '../../../types/prs';
import { PRS_SECTIONS, type FieldDef, type SectionDef } from './prsFields';

interface PrsFormProps {
  data: PrsFormData;
  onChange: (patch: Partial<PrsFormData>) => void;
  mode: 'advisor' | 'client'; // client mode skips advisorOnly sections
  language?: 'en' | 'zh';
}

export default function PrsForm({ data, onChange, mode, language: langProp }: PrsFormProps) {
  const { language: ctxLang } = useLanguage();
  const lang = langProp ?? ctxLang;
  const t = (en: string, zh: string) => lang === 'zh' ? zh : en;

  function set(actualKey: string, v: unknown) {
    const parts = actualKey.split('.');
    if (parts.length === 3) {
      const [arrKey, idxStr, fieldKey] = parts;
      const idx = parseInt(idxStr, 10);
      const dataMap = data as unknown as Record<string, unknown>;
      const arr: unknown[] = Array.isArray(dataMap[arrKey])
        ? [...(dataMap[arrKey] as unknown[])]
        : [];
      while (arr.length <= idx) arr.push({});
      arr[idx] = { ...(arr[idx] as Record<string, unknown>), [fieldKey]: v };
      onChange({ [arrKey]: arr } as Partial<PrsFormData>);
    } else {
      onChange({ [actualKey]: v } as Partial<PrsFormData>);
    }
  }

  function renderField(f: FieldDef, actualKey: string, val: unknown) {
    if (f.showIf && !f.showIf(data)) return null;
    const label = lang === 'zh' ? f.labelZh : f.labelEn;
    return (
      <Field key={actualKey} label={label}>
        {f.control === 'text' && (
          <Inp
            value={String(val ?? '')}
            onChange={v => set(actualKey, v)}
            placeholder={f.placeholder}
          />
        )}
        {f.control === 'date' && (
          <Inp
            type="date"
            value={String(val ?? '')}
            onChange={v => set(actualKey, v)}
          />
        )}
        {f.control === 'select' && (
          <Sel
            value={String(val ?? '')}
            onChange={v => set(actualKey, v)}
            opts={(f.options ?? []).map(o => [o.value, lang === 'zh' ? o.zh : o.en] as [string, string])}
          />
        )}
        {f.control === 'radio' && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {(f.options ?? []).map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => set(actualKey, val === o.value ? '' : o.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  val === o.value
                    ? 'bg-xin-blue text-white border-xin-blue'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-xin-blue/40'
                }`}
              >
                {lang === 'zh' ? o.zh : o.en}
              </button>
            ))}
          </div>
        )}
        {f.control === 'multicheck' && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {(f.options ?? []).map(o => {
              const arr: string[] = Array.isArray(val) ? (val as string[]) : [];
              const checked = arr.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() =>
                    set(actualKey, checked ? arr.filter(x => x !== o.value) : [...arr, o.value])
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    checked
                      ? 'bg-xin-blue text-white border-xin-blue'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-xin-blue/40'
                  }`}
                >
                  {lang === 'zh' ? o.zh : o.en}
                </button>
              );
            })}
          </div>
        )}
        {f.control === 'toggle' && (
          <button
            type="button"
            onClick={() => set(actualKey, !val)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              val ? 'bg-xin-blue' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                val ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        )}
      </Field>
    );
  }

  function renderRepeat(s: SectionDef) {
    if (!s.repeat) return null;
    const { key: rKey, rows, itemFields } = s.repeat;
    const dataMap2 = data as unknown as Record<string, unknown>;
    const arr: unknown[] = Array.isArray(dataMap2[rKey])
      ? (dataMap2[rKey] as unknown[])
      : [];
    return (
      <div className="space-y-2 mt-2">
        {Array.from({ length: rows }, (_, i) => {
          const item = (arr[i] ?? {}) as Record<string, unknown>;
          return (
            <div key={i} className="border border-slate-100 rounded-xl p-3">
              <p className="text-xs font-bold text-slate-400 mb-2">#{i + 1}</p>
              <Grid>
                {itemFields.map(f => {
                  const fieldKey = `${rKey}.${i}.${f.key as string}`;
                  const val = typeof item === 'object' && item !== null
                    ? item[f.key as string]
                    : item;
                  return renderField(f, fieldKey, val);
                })}
              </Grid>
            </div>
          );
        })}
      </div>
    );
  }

  const isaScore = isaTotalScore(data);

  return (
    <div className="space-y-4">
      {PRS_SECTIONS.filter(s => mode === 'advisor' || !s.advisorOnly).map(s => (
        <Card key={s.key} title={lang === 'zh' ? s.titleZh : s.titleEn}>
          <Grid>
            {s.fields.map(f =>
              renderField(f, f.key as string, (data as unknown as Record<string, unknown>)[f.key as string])
            )}
          </Grid>
          {renderRepeat(s)}
          {s.key === 'isa' && isaScore !== null && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl text-sm">
              <span className="font-semibold text-slate-700">
                {t('ISA Total Score', 'ISA 总分')}:{' '}
              </span>
              <span className="text-xin-blue font-bold">{isaScore}</span>
              <span className="ml-2 text-slate-500">({riskProfileFromScore(isaScore)})</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── local UI primitives (same style as NewClient.tsx) ──────────────────────

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 border-b border-slate-50 pb-3">
      {title}
    </h3>
    {children}
  </div>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
    {children}
  </div>
);

const Inp = ({
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
  />
);

const Sel = ({
  value,
  onChange,
  opts,
}: {
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
}) => (
  <select
    value={value}
    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors"
  >
    {opts.map(([v, l]) => (
      <option key={v} value={v}>
        {l}
      </option>
    ))}
  </select>
);
