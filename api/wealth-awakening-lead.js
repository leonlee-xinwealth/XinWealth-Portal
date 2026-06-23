// api/wealth-awakening-lead.js
// One-off marketing campaign endpoint for the "财富觉醒·上帝视角" landing page.
//
//   GET  -> { total, remaining }  公开剩余名额（按 metadata.campaign 真实计数）
//   POST -> { success: true }     提交申请，写入 clients 表（含资格审核硬闸门）
//
// 一次性活动：刻意不新增 lead_source 枚举/迁移，用 lead_source='other' +
// metadata.campaign='wealth_awakening' 归集，活动结束后整批可清理。
import { supabaseAdmin } from './_lib/supabase.js';

const CAMPAIGN = 'wealth_awakening';
const TOTAL_SPOTS = 10;

// landing leads 全部归到唯一顾问（Leon Lee / XinWealth）。可用环境变量覆盖。
const FALLBACK_ADVISOR_ID = '5ac7f25c-421e-4f03-8dac-ac5375626586';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ELIGIBILITY = ['income', 'investable', 'both', 'none'];
const RANGES = ['<100k', '100k-500k', '500k-1m', '1m+'];

const ELIGIBILITY_LABEL = { income: '年收入6位数', investable: '可投资6位数', both: '两者皆是' };

// 提交成功后通过 CallMeBot 给顾问发 WhatsApp 通知（best-effort，未配置则静默跳过）。
// 设置环境变量 CALLMEBOT_PHONE（国际格式，如 +60123456789）与 CALLMEBOT_APIKEY 即可启用。
async function notifyWhatsApp(lead) {
  const phone = (process.env.CALLMEBOT_PHONE || '').trim();
  const apikey = (process.env.CALLMEBOT_APIKEY || '').trim();
  if (!phone || !apikey) return; // 未配置 → 跳过
  const text =
    `🔔 财富觉醒 · 新申请\n` +
    `姓名: ${lead.full_name}\n` +
    `电话: ${lead.phone}\n` +
    `邮箱: ${lead.email}\n` +
    `资格: ${ELIGIBILITY_LABEL[lead.eligibility] || lead.eligibility} / 可投资 ${lead.investable_range}\n` +
    `最关心: ${lead.top_concern}\n` +
    `期望: ${lead.expectation}\n` +
    `同意提供财务资料: ${lead.can_consult ? '是' : '否'}`;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) console.error('CallMeBot notify failed:', res.status);
}

async function countApplications() {
  const { count, error } = await supabaseAdmin
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .contains('metadata', { campaign: CAMPAIGN });
  if (error) throw new Error(error.message);
  return count || 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabaseAdmin) {
    return res.status(500).json({
      error: 'Server Config Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
    });
  }

  try {
    if (req.method === 'GET') {
      const used = await countApplications();
      return res.status(200).json({ total: TOTAL_SPOTS, remaining: Math.max(0, TOTAL_SPOTS - used) });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const full_name = String(b.full_name || '').trim();
      const phone = String(b.phone || '').trim();
      const email = String(b.email || '').trim().toLowerCase();
      const eligibility = String(b.eligibility || '').trim();
      const investable_range = String(b.investable_range || '').trim();
      const top_concern = String(b.top_concern || '').trim();
      const expectation = String(b.expectation || '').trim();
      const testimonial_willing = b.testimonial_willing === true;
      const can_consult = b.can_consult === true;

      // 必填校验（全部必填）
      if (!full_name) return res.status(400).json({ error: 'FULL_NAME_REQUIRED' });
      if (phone.replace(/\D/g, '').length < 7) return res.status(400).json({ error: 'PHONE_REQUIRED' });
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'EMAIL_REQUIRED' });
      if (!ELIGIBILITY.includes(eligibility)) return res.status(400).json({ error: 'ELIGIBILITY_REQUIRED' });
      if (!RANGES.includes(investable_range)) return res.status(400).json({ error: 'RANGE_REQUIRED' });
      if (top_concern.length < 5) return res.status(400).json({ error: 'CONCERN_REQUIRED' });
      if (!expectation) return res.status(400).json({ error: 'EXPECTATION_REQUIRED' });

      // 硬性资格闸门（服务端兜底）
      if (eligibility === 'none') {
        return res.status(422).json({ error: 'NOT_QUALIFIED', reason: 'ELIGIBILITY' });
      }
      if (!testimonial_willing) {
        return res.status(422).json({ error: 'NOT_QUALIFIED', reason: 'TESTIMONIAL' });
      }

      const { error } = await supabaseAdmin.from('clients').insert({
        advisor_id: process.env.LANDING_LEAD_ADVISOR_ID || FALLBACK_ADVISOR_ID,
        full_name,
        phone,
        email,
        status: 'prospect',
        pipeline_stage: 'new_lead',
        lead_source: 'other',
        locale: 'zh',
        metadata: {
          campaign: CAMPAIGN,
          qualified: true,
          eligibility,
          investable_range,
          top_concern,
          expectation,
          testimonial_willing: true,
          can_consult,
          applied_at: new Date().toISOString(),
          source_page: '/projectXWOS',
        },
      });
      if (error) throw new Error(error.message);

      // 通知顾问（不阻断、不影响申请结果）
      try {
        await notifyWhatsApp({ full_name, phone, email, eligibility, investable_range, top_concern, expectation, can_consult });
      } catch (e) {
        console.error('WhatsApp notify error:', e);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('wealth-awakening-lead error:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
