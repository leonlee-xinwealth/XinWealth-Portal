import React, { useMemo, useState } from 'react';
import { Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';

// 一次性营销活动「财富觉醒·上帝视角」的申请表单（非诚勿扰资格问卷）。
// 全部字段必填；不达标答案硬性拦截，不能提交。

type YesNo = '' | 'yes' | 'no';

interface Props {
  /** 提交成功后回调（用于父组件刷新剩余名额）。 */
  onSuccess?: () => void;
  /** 活动已结束 / 名额已满时禁用整张表单。 */
  disabled?: boolean;
}

const ELIGIBILITY_OPTIONS = [
  { value: 'income', label: '年收入六位数以上（RM100,000+）' },
  { value: 'investable', label: '可投资资金六位数以上（RM100,000+）' },
  { value: 'both', label: '两者皆是' },
  { value: 'none', label: '以上参与条件都不符合' },
];

const RANGE_OPTIONS = [
  { value: '<100k', label: '少于 RM100k' },
  { value: '100k-500k', label: 'RM100k – 500k' },
  { value: '500k-1m', label: 'RM500k – 1M' },
  { value: '1m+', label: 'RM1M 以上' },
];

// ── 小型展示组件 ───────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-sm font-semibold text-xin-goldLight mb-2">
    {children}
    {required && <span className="text-red-400 ml-1">*</span>}
  </label>
);

const inputClass =
  'w-full bg-black/30 border border-xin-gold/25 rounded-xl px-4 py-3 text-white placeholder-white/30 ' +
  'focus:outline-none focus:border-xin-gold focus:ring-1 focus:ring-xin-gold/40 transition-colors';

const ChipGroup: React.FC<{
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  cols?: string;
  disabled?: boolean;
}> = ({ options, value, onChange, cols = 'sm:grid-cols-2', disabled }) => (
  <div className={`grid grid-cols-1 ${cols} gap-2.5`}>
    {options.map((o) => {
      const active = value === o.value;
      return (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`text-left text-sm px-4 py-3 rounded-xl border transition-all ${
            active
              ? 'bg-xin-gold/15 border-xin-gold text-white shadow-[0_0_0_1px_rgba(200,169,126,0.4)]'
              : 'bg-black/20 border-white/10 text-white/70 hover:border-xin-gold/40 hover:text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {o.label}
        </button>
      );
    })}
  </div>
);

const ApplyForm: React.FC<Props> = ({ onSuccess, disabled = false }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [range, setRange] = useState('');
  const [concern, setConcern] = useState('');
  const [expectation, setExpectation] = useState('');
  const [testimonial, setTestimonial] = useState<YesNo>('');
  const [canConsult, setCanConsult] = useState<YesNo>('');

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);

  // 硬性拦截：不符合参与条件 / 不愿提供 testimonial
  const disqualifiedReason = useMemo(() => {
    if (eligibility === 'none') return 'ELIGIBILITY';
    if (testimonial === 'no') return 'TESTIMONIAL';
    return null;
  }, [eligibility, testimonial]);

  const filled =
    fullName.trim() &&
    phone.replace(/\D/g, '').length >= 7 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    eligibility &&
    range &&
    concern.trim().length >= 5 &&
    expectation.trim() &&
    testimonial &&
    canConsult;

  const canSubmit = !disabled && status === 'idle' && filled && !disqualifiedReason;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus('submitting');
    setError(null);
    try {
      const res = await fetch('/api/wealth-awakening-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          eligibility,
          investable_range: range,
          top_concern: concern.trim(),
          expectation: expectation.trim(),
          testimonial_willing: testimonial === 'yes',
          can_consult: canConsult === 'yes',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 422 && data?.reason === 'ELIGIBILITY') throw new Error('本次名额仅限符合参与条件者。');
        if (res.status === 422 && data?.reason === 'TESTIMONIAL') throw new Error('本活动需在完成后提供一段真实 testimonial。');
        throw new Error(data?.error ? '提交失败，请稍后再试。' : '提交失败，请稍后再试。');
      }
      setStatus('success');
      onSuccess?.();
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : '提交失败，请稍后再试。');
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-10 px-6">
        <CheckCircle2 className="w-14 h-14 text-xin-gold mx-auto mb-5" />
        <h3 className="font-serif text-2xl text-white mb-3">申请已收到！</h3>
        <p className="text-white/70 leading-relaxed max-w-md mx-auto">
          我们会尽快与你联系，确认资格并为你锁定名额。请留意你的电话 / WhatsApp。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <Label required>姓名</Label>
          <input className={inputClass} value={fullName} disabled={disabled}
            onChange={(e) => setFullName(e.target.value)} placeholder="你的称呼" />
        </div>
        <div>
          <Label required>电话 / WhatsApp</Label>
          <input className={inputClass} value={phone} disabled={disabled} inputMode="tel"
            onChange={(e) => setPhone(e.target.value)} placeholder="例如 012-345 6789" />
        </div>
      </div>

      <div>
        <Label required>邮箱</Label>
        <input className={inputClass} value={email} disabled={disabled} inputMode="email"
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>

      <div>
        <Label required>你符合哪一项参与条件？</Label>
        <ChipGroup options={ELIGIBILITY_OPTIONS} value={eligibility} onChange={setEligibility} disabled={disabled} />
      </div>

      <div>
        <Label required>你目前的可投资资金大约在？</Label>
        <ChipGroup options={RANGE_OPTIONS} value={range} onChange={setRange} cols="sm:grid-cols-4" disabled={disabled} />
      </div>

      <div>
        <Label required>目前你最关心自己财务的哪个问题？</Label>
        <textarea className={`${inputClass} resize-none`} rows={3} value={concern} disabled={disabled}
          onChange={(e) => setConcern(e.target.value)} placeholder="用一两句话描述（这能帮我更好地为你诊断）" />
      </div>

      <div>
        <Label required>你期望从这次评估中获得什么？</Label>
        <textarea className={`${inputClass} resize-none`} rows={2} value={expectation} disabled={disabled}
          onChange={(e) => setExpectation(e.target.value)} placeholder="例如：看清整体财务状况、找出风险、提升效率…" />
      </div>

      <div>
        <Label required>完成后，你是否愿意提供一段真实的 testimonial？</Label>
        <ChipGroup options={[{ value: 'yes', label: '愿意' }, { value: 'no', label: '暂不方便' }]}
          value={testimonial} onChange={(v) => setTestimonial(v as YesNo)} disabled={disabled} />
      </div>

      <div>
        <Label required>你能否配合一次约 45–60 分钟的咨询？</Label>
        <ChipGroup options={[{ value: 'yes', label: '可以' }, { value: 'no', label: '暂时不行' }]}
          value={canConsult} onChange={(v) => setCanConsult(v as YesNo)} disabled={disabled} />
      </div>

      {/* 不达标提示（硬拦截） */}
      {disqualifiedReason && (
        <div className="flex gap-3 items-start bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-200">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            {disqualifiedReason === 'ELIGIBILITY'
              ? '本次名额仅限符合参与条件者（年收入或可投资资金六位数以上），感谢你的关注。'
              : '本活动以一段真实 testimonial 交换价值 RM3,688 的方案；若暂不方便提供，可能不适合本次活动。'}
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-xin-goldDark via-xin-gold to-xin-goldLight
          text-xin-dark font-bold text-lg py-4 rounded-xl shadow-lg shadow-xin-gold/20
          hover:shadow-xin-gold/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> 提交中…
          </>
        ) : disabled ? (
          '名额已满 / 活动已结束'
        ) : (
          '立即申请，锁定免费名额 →'
        )}
      </button>
      <p className="text-center text-xs text-white/40">
        名额有限，先到先得 · 提交即表示同意我们就本次活动与你联系
      </p>
    </form>
  );
};

export default ApplyForm;
