// backend/src/controllers/distributeurs.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateCodeActeur } from '../utils/crypto';
import { Role, TypeDistributeur } from '@prisma/client';

const PERMISSIONS_DEFAUT = [
  'DISTRIBUTEURS_VOIR',
  'CONSEILLERS_VOIR',
  'CONSEILLERS_AJOUTER',
  'CARTES_VOIR',
  'CARTES_ATTRIBUER',
  'CLIENTS_VOIR',
  'CLIENTS_AJOUTER',
  'TRANSACTIONS_VOIR',
  'VIREMENTS_VOIR',
  'VIREMENTS_VALIDER',
];

export async function creerDistributeur(req: Request, res: Response) {
  try {
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

    if (telephone) {
      const ex = await prisma.user.findUnique({ where: { telephone } });
      if (ex) return res.status(409).json({ error: `Le téléphone ${telephone} est déjà utilisé` });
    }
    if (email) {
      const ex = await prisma.user.findUnique({ where: { email } });
      if (ex) return res.status(409).json({ error: `L'email ${email} est déjà utilisé` });
    }

    // Un distributeur (non MASTER) ne crée que ses propres agences
    let parentId = parentDistributeurId || null;
    if (!parentId && (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE')) {
      const d = await prisma.distributeur.findUnique({ where: { userId: req.user!.userId } });
      parentId = d?.id || null;
    }

    const emailFinal = email || `${telephone.replace(/\D/g, '')}@semence-noemail.ci`;

    const count = await prisma.distributeur.count();
    const seq   = count + 1;
    const code  = generateCodeActeur(type === 'INTERNE' ? 'DI' : 'DA', seq);

    const role: Role = type === 'INTERNE' ? Role.DISTRIBUTEUR_INTERNE : Role.DISTRIBUTEUR_AGREE;

    const user = await prisma.user.create({
      data: {
        email: emailFinal, telephone,
        passwordHash: await bcrypt.hash(password, 12),
        nom: nom.toUpperCase().trim(),
        prenom: (prenom || '-').trim(),
        role, actif: true,
        permissions: PERMISSIONS_DEFAUT as any,
      }
    });

    await prisma.compte.create({ data: { numeroCompte: `${code}-CPT`, rib: `RI-${code}-CPT`, type: 'ORDINAIRE', statut: 'ACTIF', userId: user.id } });
    await prisma.distributeur.create({
      data: {
        code, type: type as TypeDistributeur, nomEntreprise: nomEntreprise.trim(),
        pays: pays || 'CI', ville: ville.trim(),
        caution: caution ? parseFloat(caution) : null,
        parentDistributeurId: parentId, userId: user.id,
      }
    });

    await prisma.auditLog.create({
      data: { action: 'CREATION_DISTRIBUTEUR', entite: 'Distributeur', entiteId: user.id, actorId: req.user!.userId, details: { code, type } }
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
  const page   = parseInt(req.query.page as string || '1');
  const limit  = parseInt(req.query.limit as string || '20');
  const search = (req.query.search as string || '').trim();

  const where: any = {};
  if (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findUnique({ where: { userId: req.user!.userId } });
    where.parentDistributeurId = d?.id || '__AUCUN__';
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
  return res.json({ data: d });
}
