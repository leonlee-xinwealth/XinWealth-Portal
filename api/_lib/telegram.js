// Best-effort Telegram delivery for advisor notifications.
//
// Same discipline as the marketing site's lib/server/notify.ts: no-ops when the
// bot token is unset, and NEVER throws. Callers treat a false return as "record
// the failure and let the user retry", never as a reason to fail the request
// that triggered it.
//
// Plain JavaScript (not TypeScript) so both .js and .ts serverless functions can
// import it, matching the existing api/_lib/supabase.js convention.
//
// Chat id resolution is the caller's job: advisor.telegram_chat_id first, then
// the TELEGRAM_CHAT_ID env var as the single-advisor fallback.

const API = 'https://api.telegram.org';

function token() {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

export function defaultChatId() {
  return (process.env.TELEGRAM_CHAT_ID || '').trim();
}

export function isTelegramConfigured() {
  return Boolean(token());
}

/**
 * Sends a PDF as a document.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendDocument(chatId, buffer, fileName, caption) {
  const bot = token();
  if (!bot) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };
  if (!chatId) return { ok: false, error: 'No Telegram chat id for this advisor' };

  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    // No parse_mode: a prospect named "Lee_Wei" or "A*B" would break Markdown
    // parsing and Telegram would reject the whole send with a 400.
    if (caption) form.append('caption', caption.slice(0, 1024));
    form.append(
      'document',
      new Blob([buffer], { type: 'application/pdf' }),
      fileName || 'report.pdf',
    );

    // Content-Type is deliberately unset — fetch must own the multipart boundary.
    const res = await fetch(`${API}/bot${bot}/sendDocument`, { method: 'POST', body: form });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Telegram ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Telegram request failed' };
  }
}

/** Plain-text fallback, used when there is no PDF to attach. */
export async function sendMessage(chatId, text) {
  const bot = token();
  if (!bot || !chatId) return { ok: false, error: 'Telegram not configured' };
  try {
    const res = await fetch(`${API}/bot${bot}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chatId), text, disable_web_page_preview: true }),
    });
    if (!res.ok) return { ok: false, error: `Telegram ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Telegram request failed' };
  }
}
