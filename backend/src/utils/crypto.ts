// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/utils/crypto.ts
import crypto from 'crypto';

const ENC_KEY = process.env.ENCRYPTION_KEY!;
const QR_KEY  = process.env.QR_SIGNING_KEY!;

// ─── AES-256-GCM ──────────────────────────────────────────────────────────────
export function encrypt(text: string): string {
  const iv  = crypto.randomBytes(16);
  const key = Buffer.from(ENC_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc    = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encHex] = data.split(':');
  const key = Buffer.from(ENC_KEY, 'hex');
  const dec = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  dec.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([dec.update(Buffer.from(encHex, 'hex')), dec.final()]).toString('utf8');
}

// ─── HMAC QR Code signature ───────────────────────────────────────────────────
export function signQrPayload(payload: object): string {
  const data = JSON.stringify(payload);
  const sig  = crypto.createHmac('sha256', QR_KEY).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}

export function verifyQrToken(token: string): { valid: boolean; payload?: any } {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const expected = crypto.createHmac('sha256', QR_KEY).update(decoded.data).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(decoded.sig))) return { valid: false };
    return { valid: true, payload: JSON.parse(decoded.data) };
  } catch {
    return { valid: false };
  }
}

// ─── Code de validation carte ────────────────────────────────────────────────
export function generateCode4(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function hashCode(code: string): string {
  return crypto.createHmac('sha256', QR_KEY).update(code).digest('hex');
}

export function verifyHashedCode(code: string, hash: string): boolean {
  const expected = hashCode(code);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
  } catch {
    return false;
  }
}

// ─── Références uniques ───────────────────────────────────────────────────────
export function generateRef(prefix: string): string {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

export function generateCodeActeur(prefix: string, seq: number): string {
  return `${prefix}-${seq.toString().padStart(6, '0')}`;
}
