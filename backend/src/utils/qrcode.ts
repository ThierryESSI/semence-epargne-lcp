// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/utils/qrcode.ts
import QRCode from 'qrcode';
import { signQrPayload } from './crypto';

export async function makeQrImage(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
    color: { dark: '#1B4F8A', light: '#FFFFFF' },
  });
}

export async function generateQrAuth(carteId: string, reference: string) {
  const token = signQrPayload({ type: 'AUTH', carteId, reference, iat: Date.now() });
  const image = await makeQrImage(`SEMENCE-AUTH:${token}`);
  return { token, image };
}

export async function generateQrEpargne(carteId: string, montant: number, reference: string) {
  const token = signQrPayload({ type: 'EPARGNE', carteId, montant, reference, iat: Date.now() });
  const image = await makeQrImage(`SEMENCE-EPARGNE:${token}`);
  return { token, image };
}
