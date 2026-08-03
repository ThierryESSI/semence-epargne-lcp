// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/conseillers.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateCodeActeur } from '../utils/crypto';
import { Role } from '@prisma/client';
import { upgradeRole, mergePermissions, PERMISSIONS_CONSEILLER } from '../utils/roles';

export async function creerConseiller(req: Request, res: Response) {
  try {
    const { nom, prenom, email, telephone, password, type = 'STAND', region, departement, commune, codeStand, distributeurId: distIdBody, caution } = req.body;

    const manquants: string[] = [];
    if (!telephone) manquants.push('telephone');
    if (!password)  manquants.push('password');
    if (!nom)       manquants.push('nom');
    if (manquants.length > 0) return res.status(400).json({ error: `Champs manquants : ${manquants.join(', ')}` });

    // Résoudre distributeurId
    let distributeurId = distIdBody;
    if (!distributeurId && (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE')) {
      const d = await prisma.distributeur.findFirst({ where: { userId: req.user!.userId } });
      distributeurId = d?.id;
    }
    if (!distributeurId) {
      return res.status(400).json({ error: 'distributeurId requis. Sélectionnez un distributeur.' });
    }

    const count = await prisma.conseiller.count();
    const seq   = count + 1;
    const code  = generateCodeActeur('CC', seq);

    // ── Réutilisation d'un compte existant (1 personne = 1 compte) ──
    const existingUser = await prisma.user.findUnique({ where: { telephone } });
    const userParEmail = !existingUser && email ? await prisma.user.findUnique({ where: { email } }) : null;
    const user = existingUser || userParEmail;

    if (user) {
      const dejaConseiller = await prisma.conseiller.findFirst({ where: { userId: user.id } });
      if (dejaConseiller)
        return res.status(409).json({ error: `${user.prenom || ''} ${user.nom} est déjà conseiller (${dejaConseiller.code})` });

      await prisma.user.update({
        where: { id: user.id },
        data: { role: upgradeRole(user.role, Role.CONSEILLER) as Role, permissions: mergePermissions(user.permissions as string[], PERMISSIONS_CONSEILLER) as any }
      });
      await prisma.conseiller.create({
        data: { code, type: type as any, region, departement, commune, codeStand, distributeurId, caution: caution ? parseFloat(caution) : null, userId: user.id }
      });
      const hasCompte = await prisma.compte.findFirst({ where: { userId: user.id } });
      if (!hasCompte)
        await prisma.compte.create({ data: { numeroCompte: `${code}-CPT`, rib: `RI-${code}-CPT`, type: 'ORDINAIRE', statut: 'ACTIF', userId: user.id } });

      await prisma.auditLog.create({ data: { action: 'CREATION_CONSEILLER', entite: 'Conseiller', entiteId: user.id, actorId: req.user!.userId, details: { code, compteReutilise: true } } });
      return res.status(201).json({ success: true, message: 'Conseiller ajouté au compte existant', data: { code, email: user.email, telephone: user.telephone } });
    }

    // ── Nouveau compte ──────────────────────────────────────────────
    if (email) {
      const ex = await prisma.user.findUnique({ where: { email } });
      if (ex) return res.status(409).json({ error: `L'email ${email} est déjà utilisé` });
    }

    const emailFinal = email || `${telephone.replace(/\D/g, '')}@semence-noemail.ci`;

    const newUser = await prisma.user.create({
      data: {
        email: emailFinal, telephone,
        passwordHash: await bcrypt.hash(password, 12),
        nom: nom.toUpperCase().trim(),
        prenom: (prenom || '-').trim(),
        role: Role.CONSEILLER, actif: true,
        permissions: PERMISSIONS_CONSEILLER as any,
      }
    });

    await prisma.compte.create({ data: { numeroCompte: `${code}-CPT`, rib: `RI-${code}-CPT`, type: 'ORDINAIRE', statut: 'ACTIF', userId: newUser.id } });
    await prisma.conseiller.create({
      data: { code, type: type as any, region, departement, commune, codeStand, distributeurId, caution: caution ? parseFloat(caution) : null, userId: newUser.id }
    });

    await prisma.auditLog.create({
      data: { action: 'CREATION_CONSEILLER', entite: 'Conseiller', entiteId: newUser.id, actorId: req.user!.userId, details: { code } }
    });

    return res.status(201).json({ success: true, message: 'Conseiller créé avec succès', data: { code, email: emailFinal, telephone } });

  } catch (err: any) {
    console.error('[creerConseiller]', err);
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'champ';
      return res.status(409).json({ error: `Ce ${field} est déjà utilisé` });
    }
    return res.status(500).json({ error: `Erreur serveur : ${err.message}` });
  }
}

export async function listerConseillers(req: Request, res: Response) {
  const page  = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '20');

  const where: any = {};
  if (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findFirst({ where: { userId: req.user!.userId } });
    if (d) where.distributeurId = d.id;
  }

  const [total, conseillers] = await Promise.all([
    prisma.conseiller.count({ where }),
    prisma.conseiller.findMany({
      where, skip: (page-1)*limit, take: limit,
      include: {
        user: { select: { nom: true, prenom: true, email: true, telephone: true, actif: true } },
        distributeur: { select: { nomEntreprise: true, code: true } },
        _count: { select: { clients: true, cartesVendues: true } }
      }
    })
  ]);
  return res.json({ data: conseillers, pagination: { total, page, limit, pages: Math.ceil(total/limit) } });
}

export async function getConseiller(req: Request, res: Response) {
  const c = await prisma.conseiller.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { nom: true, prenom: true, email: true, telephone: true } },
      distributeur: { select: { nomEntreprise: true, code: true } },
      clients: { include: { user: { select: { nom: true, prenom: true, telephone: true } } }, take: 20 }
    }
  });
  if (!c) return res.status(404).json({ error: 'Conseiller introuvable' });
  return res.json({ data: c });
}
