// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { signAccessToken, signRefreshToken, verifyToken } from '../utils/jwt';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });

  // [FIX 1] Recherche par email OU téléphone
  const user = await prisma.user.findFirst({
    where: { OR: [{ email }, { telephone: email }] },
    select: { id:true, email:true, nom:true, prenom:true, role:true, actif:true, passwordHash:true, telephone:true }
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: 'Identifiants incorrects' });
  if (!user.actif)
    return res.status(403).json({ error: 'Compte inactif. Contactez votre conseiller.' });

  const payload      = { userId:user.id, email:user.email, role:user.role, telephone:user.telephone };
  const accessToken  = signAccessToken(payload);
  const refresh      = signRefreshToken({ userId:user.id });

  await prisma.user.update({ where:{ id:user.id }, data:{ lastLoginAt:new Date(), refreshToken:refresh } });
  await prisma.auditLog.create({ data:{ action:'LOGIN', entite:'User', entiteId:user.id, actorId:user.id, ipAddress:req.ip } });

  // [FIX 2] Suppression SMS à chaque connexion — inutile et coûteux
  // sendSms alerte connexion RETIRÉ intentionnellement

  return res.json({
    accessToken, refreshToken: refresh,
    user: { id:user.id, email:user.email, nom:user.nom, prenom:user.prenom, role:user.role }
  });
}

export async function refreshToken(req: Request, res: Response) {
  const { refreshToken: token } = req.body;
  if (!token) return res.status(400).json({ error: 'Refresh token requis' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
  const user = await prisma.user.findUnique({
    where:{ id:payload.userId },
    select:{ id:true, email:true, role:true, telephone:true, refreshToken:true, actif:true }
  });
  if (!user || user.refreshToken !== token || !user.actif)
    return res.status(401).json({ error: 'Session invalide' });
  const newAccess  = signAccessToken({ userId:user.id, email:user.email, role:user.role, telephone:user.telephone });
  const newRefresh = signRefreshToken({ userId:user.id });
  await prisma.user.update({ where:{ id:user.id }, data:{ refreshToken:newRefresh } });
  return res.json({ accessToken:newAccess, refreshToken:newRefresh });
}

export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where:{ id:req.user!.userId },
    select:{
      id:true, email:true, nom:true, prenom:true, role:true, telephone:true, actif:true, createdAt:true,
      compte:{ select:{ numeroCompte:true, rib:true, solde:true, type:true, statut:true } },
      client:{ select:{ code:true, region:true, ville:true, commune:true } },
      conseiller:{ select:{ code:true, type:true } },
      distributeur:{ select:{ code:true, nomEntreprise:true, type:true } },
    }
  });
  if (!user) return res.status(404).json({ error:'Utilisateur introuvable' });
  return res.json({ data:user });
}

export async function changePassword(req: Request, res: Response) {
  const { ancienPassword, nouveauPassword } = req.body;
  if (!ancienPassword || !nouveauPassword) return res.status(400).json({ error:'Champs requis' });
  if (nouveauPassword.length < 8) return res.status(400).json({ error:'Mot de passe trop court (min 8 caractères)' });
  const user = await prisma.user.findUnique({ where:{ id:req.user!.userId } });
  if (!user || !(await bcrypt.compare(ancienPassword, user.passwordHash)))
    return res.status(400).json({ error:'Ancien mot de passe incorrect' });
  await prisma.user.update({ where:{ id:user.id }, data:{ passwordHash:await bcrypt.hash(nouveauPassword,12), refreshToken:null } });
  return res.json({ success:true, message:'Mot de passe modifié. Reconnectez-vous.' });
}
