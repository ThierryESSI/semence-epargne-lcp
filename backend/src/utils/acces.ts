// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// ============================================================
// backend/src/utils/acces.ts
// Vérifications de périmètre (scoping) : un acteur ne peut agir
// que sur les ressources de son réseau hiérarchique.
import prisma from './prisma';

export const ROLES_STAFF = ['MASTER', 'SUPER_ADMIN', 'DISTRIBUTEUR_INTERNE', 'DISTRIBUTEUR_AGREE', 'CONSEILLER'] as const;

// Récupère les identifiants hiérarchiques de l'acteur
export async function idsActeur(role: string, actorUserId: string): Promise<{ conseillerId?: string; distributeurId?: string }> {
  if (role === 'CONSEILLER') {
    const c = await prisma.conseiller.findFirst({ where: { userId: actorUserId }, select: { id: true } });
    return c ? { conseillerId: c.id } : {};
  }
  if (role === 'DISTRIBUTEUR_INTERNE' || role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findFirst({ where: { userId: actorUserId }, select: { id: true } });
    return d ? { distributeurId: d.id } : {};
  }
  return {};
}

// Le client cible (targetUserId) dépend-il de l'acteur (conseiller/distributeur) ?
export async function clientAppartientA(targetUserId: string, role: string, actorUserId: string): Promise<boolean> {
  if (role === 'MASTER' || role === 'SUPER_ADMIN') return true;
  if (role === 'CLIENT') return targetUserId === actorUserId;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      role: true,
      clients: { select: { conseillerId: true } },
      conseillers: { select: { id: true, distributeurId: true } },
    },
  });
  if (!target) return false;

  if (role === 'CONSEILLER') {
    const acteur = await prisma.conseiller.findFirst({ where: { userId: actorUserId }, select: { id: true } });
    return !!acteur && target.clients.some(c => c.conseillerId === acteur.id);
  }
  if (role === 'DISTRIBUTEUR_INTERNE' || role === 'DISTRIBUTEUR_AGREE') {
    const acteur = await prisma.distributeur.findFirst({ where: { userId: actorUserId }, select: { id: true } });
    if (!acteur) return false;
    const client = target.clients[0];
    if (!client) return false;
    const conseiller = await prisma.conseiller.findUnique({
      where: { id: client.conseillerId },
      select: { distributeurId: true },
    });
    return !!conseiller && conseiller.distributeurId === acteur.id;
  }
  return false;
}

// L'acteur a-t-il le droit d'utiliser ce conseillerId (création client) ?
export async function conseillerAutorise(conseillerId: string, role: string, actorUserId: string): Promise<boolean> {
  if (role === 'MASTER' || role === 'SUPER_ADMIN') return true;
  const c = await prisma.conseiller.findUnique({
    where: { id: conseillerId },
    select: { userId: true, distributeurId: true },
  });
  if (!c) return false;
  if (role === 'CONSEILLER') return c.userId === actorUserId;
  if (role === 'DISTRIBUTEUR_INTERNE' || role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findFirst({ where: { userId: actorUserId }, select: { id: true } });
    return !!d && c.distributeurId === d.id;
  }
  return false;
}

// L'acteur a-t-il le droit de manipuler cette carte (dépôt/activation) ?
export async function carteAppartientA(carteId: string, role: string, actorUserId: string): Promise<boolean> {
  if (role === 'MASTER' || role === 'SUPER_ADMIN') return true;
  const carte = await prisma.carte.findUnique({
    where: { id: carteId },
    select: { conseillerId: true, distributeurId: true },
  });
  if (!carte) return false;

  if (role === 'CONSEILLER') {
    const c = await prisma.conseiller.findFirst({ where: { userId: actorUserId }, select: { id: true } });
    return !!c && carte.conseillerId === c.id;
  }
  if (role === 'DISTRIBUTEUR_INTERNE' || role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findFirst({ where: { userId: actorUserId }, select: { id: true } });
    if (!d) return false;
    if (carte.distributeurId === d.id) return true;
    if (carte.conseillerId) {
      const conseiller = await prisma.conseiller.findUnique({
        where: { id: carte.conseillerId },
        select: { distributeurId: true },
      });
      return !!conseiller && conseiller.distributeurId === d.id;
    }
    return false;
  }
  return false;
}
