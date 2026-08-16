// backend/src/controllers/distributeurs.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateCodeActeur } from '../utils/crypto';
import { Role, TypeDistributeur } from '@prisma/client';
import { upgradeRole, mergePermissions, PERMISSIONS_DISTRIBUTEUR } from '../utils/roles';
import { parsePage, parseLimit } from '../utils/format';

export async function creerDistributeur(req: Request, res: Response) {
  try {
    // [RÈGLE MÉTIER] Seul le MASTER crée les distributeurs
    const role = req.user!.role;
    if (role !== 'MASTER' && role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Seul le MASTER peut créer des distributeurs' });

    const { nom, prenom, email, telephone, password, nomEntreprise, ville, pays, type = 'INTERNE', caution, parentDistributeurId } = req.body;

    const manquants: string[] = [];
    if (!nom)           manquants.push('nom');
    if (!telephone)     manquants.push('telephone');
    if (!password)      manquants.push('password');
    if (!nomEntreprise) manquants.push('nomEntreprise');
    if (!ville)         manquants.push('ville');
    if (manquants.length > 0) return res.status(400).json({ error: `Champs manquants : ${manquants.join(', ')}` });

    if (type !== 'INTERNE' && type !== 'AGREE')
      return res.status(400).json({ error: "Type invalide. Valeurs : INTERNE, AGREE" });

    const distRole: Role = type === 'INTERNE' ? Role.DISTRIBUTEUR_INTERNE : Role.DISTRIBUTEUR_AGREE;

    // Un distributeur (non MASTER) ne crée que ses propres agences.
    // [SÉCURITÉ] On ignore totalement le parentDistributeurId fourni par le
    // corps de requête pour un distributeur : il ne peut créer que des filiales.
    let parentId = null;
    if (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE') {
      const d = await prisma.distributeur.findFirst({ where: { userId: req.user!.userId } });
      parentId = d?.id || null;
    } else if (parentDistributeurId) {
      parentId = parentDistributeurId;
    }

    const code  = generateCodeActeur(type === 'INTERNE' ? 'DI' : 'DA');

    // [SÉCURITÉ] Caution strictement numérique
    const cautionNum = caution === undefined || caution === null || caution === '' ? null : Number(caution);
    if (cautionNum !== null && !Number.isFinite(cautionNum))
      return res.status(400).json({ error: 'Caution invalide (montant numérique requis)' });

    // ── Réutilisation d'un compte existant (1 personne = 1 compte) ──
    const existingUser = telephone
      ? await prisma.user.findUnique({ where: { telephone } })
      : null;
    const userParEmail = !existingUser && email
      ? await prisma.user.findUnique({ where: { email } })
      : null;
    const user = existingUser || userParEmail;

    if (user) {
      const dejaDistrib = await prisma.distributeur.findFirst({ where: { userId: user.id } });
      if (dejaDistrib)
        return res.status(409).json({ error: `${user.prenom || ''} ${user.nom} est déjà distributeur (${dejaDistrib.code})` });

      await prisma.user.update({
        where: { id: user.id },
        data: { role: upgradeRole(user.role, distRole) as Role, permissions: mergePermissions(user.permissions as string[], PERMISSIONS_DISTRIBUTEUR) as any }
      });
      await prisma.distributeur.create({
        data: { code, type: type as TypeDistributeur, nomEntreprise: nomEntreprise.trim(), pays: pays || 'CI', ville: ville.trim(), caution: cautionNum, parentDistributeurId: parentId, userId: user.id }
      });
      const hasCompte = await prisma.compte.findFirst({ where: { userId: user.id } });
      if (!hasCompte)
        await prisma.compte.create({ data: { numeroCompte: `${code}-CPT`, rib: `RI-${code}-CPT`, type: 'ORDINAIRE', statut: 'ACTIF', userId: user.id } });

      await prisma.auditLog.create({ data: { action: 'CREATION_DISTRIBUTEUR', entite: 'Distributeur', entiteId: user.id, actorId: req.user!.userId, details: { code, type, compteReutilise: true } } });
      return res.status(201).json({ success: true, message: 'Distributeur ajouté au compte existant', data: { code, email: user.email, telephone: user.telephone } });
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
        role: distRole, actif: true,
        permissions: PERMISSIONS_DISTRIBUTEUR as any,
      }
    });

    await prisma.compte.create({ data: { numeroCompte: `${code}-CPT`, rib: `RI-${code}-CPT`, type: 'ORDINAIRE', statut: 'ACTIF', userId: newUser.id } });
    await prisma.distributeur.create({
      data: {
        code, type: type as TypeDistributeur, nomEntreprise: nomEntreprise.trim(),
        pays: pays || 'CI', ville: ville.trim(),
        caution: cautionNum,
        parentDistributeurId: parentId, userId: newUser.id,
      }
    });

    await prisma.auditLog.create({
      data: { action: 'CREATION_DISTRIBUTEUR', entite: 'Distributeur', entiteId: newUser.id, actorId: req.user!.userId, details: { code, type } }
    });

    return res.status(201).json({ success: true, message: 'Distributeur créé avec succès', data: { code, email: emailFinal, telephone } });

  } catch (err: any) {
    console.error('[creerDistributeur]', err);
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'champ';
      return res.status(409).json({ error: `Ce ${field} est déjà utilisé` });
    }
    return res.status(500).json({ error: `Erreur serveur : ${err.message}` });
  }
}

export async function listerDistributeurs(req: Request, res: Response) {
  const page   = parsePage(req.query.page as string);
  const limit  = parseLimit(req.query.limit as string);
  const search = (req.query.search as string || '').trim();

  const where: any = {};
  if (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findFirst({ where: { userId: req.user!.userId } });
    where.parentDistributeurId = d?.id || '__AUCUN__';
  } else if (req.user!.role === 'CONSEILLER') {
    // [VUE CONSEILLER] Un conseiller ne voit que son propre distributeur.
    const c = await prisma.conseiller.findFirst({ where: { userId: req.user!.userId } });
    where.id = c?.distributeurId || '__AUCUN__';
  }
  if (search) {
    where.OR = [
      { nomEntreprise: { contains: search, mode: 'insensitive' } },
      { code:         { contains: search, mode: 'insensitive' } },
      { ville:        { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, distributeurs] = await Promise.all([
    prisma.distributeur.count({ where }),
    prisma.distributeur.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { nom: true, prenom: true, email: true, telephone: true, actif: true } },
        _count: { select: { conseillers: true, cartes: true, agences: true } },
      }
    })
  ]);
  return res.json({ data: distributeurs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
}

export async function getDistributeur(req: Request, res: Response) {
  const d = await prisma.distributeur.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { nom: true, prenom: true, email: true, telephone: true, actif: true } },
      _count: { select: { conseillers: true, cartes: true, agences: true } },
      agences: { select: { id: true, code: true, nomEntreprise: true, ville: true } },
    }
  });
  if (!d) return res.status(404).json({ error: 'Distributeur introuvable' });
  // [SÉCURITÉ] Un distributeur ne consulte que lui-même ou ses filiales directes ;
  // un conseiller ne consulte que son propre distributeur.
  if (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE') {
    const acteur = await prisma.distributeur.findFirst({ where: { userId: req.user!.userId }, select: { id: true } });
    if (d.id !== acteur?.id && d.parentDistributeurId !== acteur?.id)
      return res.status(403).json({ error: 'Accès refusé : ce distributeur ne fait pas partie de votre réseau' });
  } else if (req.user!.role === 'CONSEILLER') {
    const c = await prisma.conseiller.findFirst({ where: { userId: req.user!.userId }, select: { distributeurId: true } });
    if (d.id !== c?.distributeurId)
      return res.status(403).json({ error: 'Accès refusé : ce distributeur ne fait pas partie de votre réseau' });
  }
  return res.json({ data: d });
}
