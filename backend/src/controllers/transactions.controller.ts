// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/transactions.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Retourne la liste des comptesId visibles par l'utilisateur, ou null si tous
async function comptesAutorises(role: string, userId: string): Promise<string[] | null> {
  if (role === 'CLIENT') {
    const compte = await prisma.compte.findUnique({ where: { userId }, select: { id: true } });
    return compte ? [compte.id] : [];
  }
  if (role === 'CONSEILLER') {
    const c = await prisma.conseiller.findFirst({ where: { userId }, select: { id: true } });
    if (!c) return [];
    const clients = await prisma.client.findMany({ where: { conseillerId: c.id }, select: { userId: true } });
    const comptes = await prisma.compte.findMany({ where: { userId: { in: clients.map(x => x.userId) } }, select: { id: true } });
    return comptes.map(x => x.id);
  }
  if (role === 'DISTRIBUTEUR_INTERNE' || role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findFirst({ where: { userId }, select: { id: true } });
    if (!d) return [];
    const conseillers = await prisma.conseiller.findMany({ where: { distributeurId: d.id }, select: { id: true } });
    const clients = await prisma.client.findMany({ where: { conseillerId: { in: conseillers.map(x => x.id) } }, select: { userId: true } });
    const comptes = await prisma.compte.findMany({ where: { userId: { in: clients.map(x => x.userId) } }, select: { id: true } });
    return comptes.map(x => x.id);
  }
  // MASTER / SUPER_ADMIN : tous
  return null;
}

export async function listerTransactions(req: Request, res: Response) {
  const page      = parseInt(req.query.page as string || '1');
  const limit     = parseInt(req.query.limit as string || '20');
  const type      = req.query.type as string | undefined;
  const statut    = req.query.statut as string | undefined;
  const dateDebut = req.query.dateDebut as string | undefined;
  const dateFin   = req.query.dateFin as string | undefined;

  const where: any = {};
  if (type)   where.type   = type;
  if (statut) where.statut = statut;
  if (dateDebut || dateFin) {
    where.createdAt = {};
    if (dateDebut) where.createdAt.gte = new Date(dateDebut);
    if (dateFin)   where.createdAt.lte = new Date(dateFin);
  }

  const ids = await comptesAutorises(req.user!.role, req.user!.userId);
  if (ids !== null) where.compteId = { in: ids };

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        compte: { select: { numeroCompte: true, user: { select: { nom: true, prenom: true } } } },
        carte:  { select: { reference: true, montant: true } }
      }
    })
  ]);

  return res.json({ data: transactions, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
}

export async function getTransaction(req: Request, res: Response) {
  const tx = await prisma.transaction.findUnique({
    where: { id: req.params.id },
    include: {
      compte: { include: { user: { select: { nom: true, prenom: true, telephone: true } } } },
      carte:  true
    }
  });
  if (!tx) return res.status(404).json({ error: 'Transaction introuvable' });

  // [SÉCURITÉ] IDOR — vérifier que l'utilisateur a le droit de voir ce compte
  const ids = await comptesAutorises(req.user!.role, req.user!.userId);
  if (ids !== null && !ids.includes(tx.compteId))
    return res.status(403).json({ error: 'Accès refusé à cette transaction' });

  return res.json({ data: tx });
}
