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
  return crypto.randomInt(1000, 10000).toString();
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

// Référence courte imprimée sur la carte (utilisée pour la recharge SMS)
// Format : CSE-XXXXXXXX (8 caractères alphanumériques)
export function generateRefCourt(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans O/0/I/1
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return `CSE-${out}`;
}

// Référence d'un lot de cartes : LOT-XXXXXX
export function generateLotRef(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return `LOT-${out}`;
}

// ─── Code d'acteur (client, conseiller, distributeur) ────────────────
// [CODIFICATION] Ancien format séquentiel « CLI-000001 » : révélait le rang
// (qui est le premier, combien d'inscrits) et était énumérable.
// Nouveau format « CLI-A3F9K2 » : 6 caractères alphanumériques tirés par
// crypto (alphabet sans O/0/I/1). Un code unique, stable et traçable,
// mais qui ne révèle ni l'ordre d'inscription ni le rang de l'acteur.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateCodeActeur(prefix: string, length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `${prefix}-${out}`;
}
