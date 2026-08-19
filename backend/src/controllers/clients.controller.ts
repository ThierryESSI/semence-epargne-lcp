// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/clients.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { clientAppartientA } from '../utils/acces';
import { parsePage, parseLimit } from '../utils/format';

export async function listerClients(req: Request, res: Response) {
  const page   = parsePage(req.query.page as string);
  const limit  = parseLimit(req.query.limit as string);
  const search = req.query.search as string | undefined;
  const role   = req.user!.role;

  const where: any = {};

  if (role === 'CONSEILLER') {
    const c = await prisma.conseiller.findFirst({ where: { userId: req.user!.userId } });
    if (!c) return res.status(403).json({ error: 'Profil conseiller introuvable' });
    where.conseillerId = c.id;
  } else if (role === 'DISTRIBUTEUR_INTERNE' || role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findFirst({ where: { userId: req.user!.userId } });
    if (!d) return res.status(403).json({ error: 'Profil distributeur introuvable' });
    const conseillers = await prisma.conseiller.findMany({ where: { distributeurId: d.id }, select: { id: true } });
    where.conseillerId = { in: conseillers.map(c => c.id) };
  }

  if (search) {
    where.user = { OR: [
      { nom: { contains: search, mode: 'insensitive' } },
      { prenom: { contains: search, mode: 'insensitive' } },
      { telephone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ]};
  }

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true, telephone: true, dateNaissance: true, actif: true, createdAt: true, compte: { select: { numeroCompte: true, solde: true, statut: true } } } },
        conseiller: { select: { code: true, user: { select: { nom: true } } } }
      }
    })
  ]);
  return res.json({ data: clients, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
}

export async function getClient(req: Request, res: Response) {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, nom: true, prenom: true, email: true, telephone: true, dateNaissance: true, actif: true, createdAt: true, compte: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10, include: { carte: { select: { reference: true } } } } } } } },
      conseiller: { include: { user: { select: { nom: true, prenom: true } }, distributeur: { select: { nomEntreprise: true } } } }
    }
  });
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  // [SÉCURITÉ] Un conseiller/distributeur ne consulte que les clients de son réseau
  if (!['MASTER','SUPER_ADMIN'].includes(req.user!.role) &&
      !(await clientAppartientA(client.userId, req.user!.role, req.user!.userId)))
    return res.status(403).json({ error: 'Accès refusé : ce client ne fait pas partie de votre réseau' });
  return res.json({ data: client });
}

// ─── MODIFIER UN CLIENT ──────────────────────────────────────────────────────
export async function modifierClient(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const {
      nom, prenom, telephone, email, dateNaissance,
      whatsapp, region, departement, commune, ville,
    } = req.body;

    const client = await prisma.client.findUnique({
      where: { id },
      include: { user: { select: { id: true, telephone: true, email: true } } }
    });
    if (!client) return res.status(404).json({ error: 'Client introuvable' });

    // [SÉCURITÉ] Scoping : un conseiller/distributeur ne modifie que ses clients
    const role = req.user!.role;
    if (!['MASTER', 'SUPER_ADMIN'].includes(role)) {
      if (!(await clientAppartientA(client.userId, role, req.user!.userId)))
        return res.status(403).json({ error: 'Accès refusé : ce client ne fait pas partie de votre réseau' });
    }

    // [SÉCURITÉ] Champs modifiables par rôle
    const isExpert = ['MASTER', 'SUPER_ADMIN'].includes(role);
    const userPayload: any = {};
    const clientPayload: any = {};

    // Tous les rôles staff peuvent modifier ces champs user
    if (nom !== undefined) userPayload.nom = nom.toUpperCase().trim();
    if (prenom !== undefined) userPayload.prenom = prenom.trim();
    if (whatsapp !== undefined) userPayload.whatsapp = whatsapp || null;

    // Seul MASTER/SUPER_ADMIN peut modifier telephone, email, dateNaissance
    if (isExpert) {
      if (telephone !== undefined && telephone !== client.user.telephone) {
        // Vérifier unicité du téléphone
        const existing = await prisma.user.findFirst({ where: { telephone, NOT: { id: client.userId } } });
        if (existing) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé' });
        userPayload.telephone = telephone;
      }
      if (email !== undefined && email !== client.user.email) {
        const existing = await prisma.user.findFirst({ where: { email, NOT: { id: client.userId } } });
        if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        userPayload.email = email;
      }
      if (dateNaissance !== undefined) userPayload.dateNaissance = dateNaissance ? new Date(dateNaissance) : null;
    }

    // Champs client (localisation)
    if (region !== undefined) clientPayload.region = region;
    if (commune !== undefined) clientPayload.commune = commune;
    if (ville !== undefined) clientPayload.ville = ville || departement || region;
    else if (departement !== undefined) clientPayload.ville = departement;

    // [SÉCURITÉ] Vérifier qu'il y a bien quelque chose à modifier
    if (Object.keys(userPayload).length === 0 && Object.keys(clientPayload).length === 0) {
      return res.status(400).json({ error: 'Aucune donnée à modifier' });
    }

    // Transaction atomique
    await prisma.$transaction(async (tx) => {
      if (Object.keys(userPayload).length > 0) {
        await tx.user.update({ where: { id: client.userId }, data: userPayload });
      }
      if (Object.keys(clientPayload).length > 0) {
        await tx.client.update({ where: { id: client.id }, data: clientPayload });
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'MODIFICATION_CLIENT',
        entite: 'Client',
        entiteId: client.id,
        actorId: req.user!.userId,
        details: { userChanges: userPayload, clientChanges: clientPayload }
      }
    });

    // Re-fetch pour retourner les données à jour
    const updated = await prisma.client.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true, telephone: true, dateNaissance: true, whatsapp: true, actif: true } },
      }
    });

    return res.json({ success: true, message: 'Client modifié avec succès', data: updated });
  } catch (err: any) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'champ';
      return res.status(409).json({ error: `Ce ${field} est déjà utilisé` });
    }
    console.error('[modifierClient]', err);
    return res.status(500).json({ error: 'Erreur lors de la modification du client' });
  }
}
