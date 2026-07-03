// Client-side API for the PDF e-signature feature (/api/sign).
// Advisor calls use the ADVISOR Supabase session (lib/supabaseClient, storage
// key 'xinwealth_supabase_auth') — NOT lib/supabase, which is the client
// portal's instance.
import { getAccessToken } from '../lib/supabaseClient';

export interface SigBox {
  page: number; // 1-based
  x: number;    // normalized 0-1, top-left origin
  y: number;
  w: number;
  h: number;
}

export interface SignatureRequestRow {
  id: string;
  client_name: string | null;
  file_name: string;
  status: 'pending' | 'signed' | 'cancelled';
  token: string | null;
  token_expires_at: string | null;
  created_at: string;
  signed_at: string | null;
}

export interface SignRequestPublic {
  fileName: string;
  clientName: string | null;
  sig: SigBox;
  pdfUrl: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}` };
}

async function parseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Request failed (${response.status})`);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }
  return data;
}

// ---------- advisor (authenticated) ----------

export async function createSignatureRequest(input: {
  fileName: string;
  clientName?: string;
  pdfBase64: string;
  sig: SigBox;
}): Promise<{ id: string; token: string }> {
  const response = await fetch('/api/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ action: 'create', ...input }),
  });
  return parseJson(response);
}

export async function listSignatureRequests(): Promise<SignatureRequestRow[]> {
  const response = await fetch('/api/sign?action=list', { headers: await authHeaders() });
  const data = await parseJson(response);
  return data.requests || [];
}

export async function getDownloadUrl(id: string): Promise<{ url: string; signed: boolean }> {
  const response = await fetch(`/api/sign?action=download&id=${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  return parseJson(response);
}

export async function cancelSignatureRequest(id: string): Promise<void> {
  const response = await fetch('/api/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ action: 'cancel', id }),
  });
  await parseJson(response);
}

// ---------- public (client signing page) ----------

export async function fetchSignRequest(token: string): Promise<SignRequestPublic> {
  const response = await fetch(`/api/sign?token=${encodeURIComponent(token)}`);
  return parseJson(response);
}

export async function submitSignature(token: string, signaturePng: string): Promise<void> {
  const response = await fetch('/api/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'submit', token, signaturePng }),
  });
  await parseJson(response);
}
