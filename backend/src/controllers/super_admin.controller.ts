// backend/src/controllers/super_admin.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import prisma from '../utils/prisma';
import { Role, Permission } from '@prisma/client';

// Définition des modules et leurs propriétés
export const MODULES_PERMISSIONS: Record<string, { label: string; permissions: { code: Permission; label: string }[] }> = {
  CLIENTS: {
    label: 'Clients',
    permissions: [
      { code: 'CLIENTS_VOIR',      label: 'Voir les clients' },
      { code: 'CLIENTS_DETAILS',   label: 'Voir la fiche détaillée d\'un client' },
      { code: 'CLIENTS_AJOUTER',   label: 'Ajouter un client' },
      { code: 'CLIENTS_MODIFIER',  label: 'Modifier un client' },
      { code: 'CLIENTS_SUPPRIMER', label: 'Supprimer un client' },
    ]
  },
  DISTRIBUTEURS: {
    label: 'Distributeurs',
    permissions: [
      { code: 'DISTRIBUTEURS_VOIR',      label: 'Voir les distributeurs' },
      { code: 'DISTRIBUTEURS_DETAILS',   label: 'Voir la fiche détaillée d\'un distributeur' },
      { code: 'DISTRIBUTEURS_AJOUTER',   label: 'Ajouter un distributeur' },
      { code: 'DISTRIBUTEURS_MODIFIER',  label: 'Modifier un distributeur' },
      { code: 'DISTRIBUTEURS_SUPPRIMER', label: 'Supprimer un distributeur' },
    ]
  },
  CONSEILLERS: {
    label: 'Conseillers Clientèle',
    permissions: [
      { code: 'CONSEILLERS_VOIR',      label: 'Voir les conseillers' },
      { code: 'CONSEILLERS_DETAILS',   label: 'Voir la fiche détaillée d\'un conseiller' },
      { code: 'CONSEILLERS_AJOUTER',   label: 'Ajouter un conseiller' },
      { code: 'CONSEILLERS_MODIFIER',  label: 'Modifier un conseiller' },
      { code: 'CONSEILLERS_SUPPRIMER', label: 'Supprimer un conseiller' },
    ]
  },
  CARTES: {
    label: 'Cartes Semence',
    permissions: [
      { code: 'CARTES_VOIR',      label: 'Voir les cartes' },
      { code: 'CARTES_EMETTRE',   label: 'Emettre des cartes' },
      { code: 'CARTES_ATTRIBUER', label: 'Attribuer des cartes' },
      { code: 'CARTES_ANNULER',   label: 'Annuler une carte' },
    ]
  },
  TRANSACTIONS: {
    label: 'Transactions',
    permissions: [
      { code: 'TRANSACTIONS_VOIR',        label: 'Voir les transactions' },
      { code: 'TRANSACTIONS_REMBOURSER',  label: 'Effectuer un remboursement' },
    ]
  },
  EPARGNE: {
    label: 'Epargne',
    permissions: [
      { code: 'EPARGNE_VOIR',         label: 'Voir les plans epargne' },
      { code: 'EPARGNE_GERER',        label: 'Creer et modifier les plans' },
      { code: 'EPARGNE_BONUS_VERSER', label: 'Verser les bonus' },
    ]
  },
  VIREMENTS: {
    label: 'Virements',
    permissions: [
      { code: 'VIREMENTS_VOIR',    label: 'Voir les virements' },
      { code: 'VIREMENTS_VALIDER', label: 'Valider un virement' },
      { code: 'VIREMENTS_REJETER', label: 'Rejeter un virement' },
    ]
  },
  RAPPORTS: {
    label: 'Rapports',
    permissions: [
      { code: 'RAPPORTS_VOIR',     label: 'Voir les rapports' },
      { code: 'RAPPORTS_EXPORTER', label: 'Exporter les rapports' },
    ]
  },
  CONFIG: {
    label: 'Configuration',
    permissions: [
      { code: 'CONFIG_VOIR',     label: 'Voir la configuration' },
      { code: 'CONFIG_MODIFIER', label: 'Modifier la configuration' },
    ]
  },
  ADMINS: {
    label: 'Administration',
    permissions: [
      { code: 'ADMINS_VOIR',      label: 'Voir les comptes admin' },
      { code: 'ADMINS_AJOUTER',   label: 'Creer un compte admin' },
      { code: 'ADMINS_MODIFIER',  label: 'Modifier un compte admin' },
      { code: 'ADMINS_SUPPRIMER', label: 'Supprimer un compte admin' },
    ]
  },
  AUDIT: {
    label: 'Audit',
    permissions: [
      { code: 'AUDIT_VOIR', label: 'Voir les logs d\'audit' },
    ]
  },
};

const ALL_PERMISSIONS = Object.values(MODULES_PERMISSIONS)
  .flatMap(m => m.permissions.map(p => p.code));

export async function listerAdmins(req: Request, res: Response) {
  try {
    const admins = await prisma.user.findMany({
      where:   { role: { in: ['MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER'] } },
      select:  { id:true, nom:true, prenom:true, email:true, telephone:true, role:true, actif:true, permissions:true, creePar:true, createdAt:true, lastLoginAt:true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ data: admins });
  } catch(err:any) { return res.status(500).json({ error: err.message }); }
}

export async function creerAdmin(req: Request, res: Response) {
  try {
    const { nom, prenom, email, telephone, role, permissions = [], motDePasse } = req.body;
    if (!nom || !prenom || !email || !telephone || !role)
      return res.status(400).json({ error: 'Champs requis : nom, prenom, email, telephone, role' });
    const rolesAdmin: Role[] = ['MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER'];
    if (!rolesAdmin.includes(role as Role))
      return res.status(400).json({ error: `Role invalide. Valeurs : ${rolesAdmin.join(', ')}` });
    // [SÉCURITÉ] La création d'un compte MASTER est réservée aux SUPER_ADMIN
    if (role === 'MASTER' && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Seul le SuperAdmin peut créer un compte MASTER' });
    const permsInvalides = permissions.filter((p:string) => !ALL_PERMISSIONS.includes(p as Permission));
    if (permsInvalides.length > 0)
      return res.status(400).json({ error: `Permissions invalides : ${permsInvalides.join(', ')}` });
    const [exEmail, exTel] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { telephone } }),
    ]);
    if (exEmail) return res.status(409).json({ error: 'Cet email est deja utilise' });
    if (exTel)   return res.status(409).json({ error: 'Ce telephone est deja utilise' });
    const pwd  = motDePasse || `LCP-Admin-${randomInt(100000, 1000000)}`;
    const hash = await bcrypt.hash(pwd, 12);
    const user = await prisma.user.create({
      data: { email, telephone, passwordHash:hash, nom:nom.toUpperCase().trim(), prenom:prenom.trim(), role:role as Role, actif:true, permissions:permissions as Permission[], creePar:req.user!.userId }
    });
    await prisma.auditLog.create({ data: { action:'CREATION_ADMIN', entite:'User', entiteId:user.id, actorId:req.user!.userId, details:{ role, permissions, email } } });
    return res.status(201).json({ success:true, message:`Compte ${role} cree`, data:{ userId:user.id, email, telephone, role, permissions, motDePasseTemporaire:pwd } });
  } catch(err:any) { return res.status(500).json({ error: err.message }); }
}

export async function modifierPermissions(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions doit etre un tableau' });
    const permsInvalides = permissions.filter((p:string) => !ALL_PERMISSIONS.includes(p as Permission));
    if (permsInvalides.length > 0) return res.status(400).json({ error: `Permissions invalides : ${permsInvalides.join(', ')}` });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'Permissions du SuperAdmin non modifiables' });
    if (user.role === 'CLIENT')      return res.status(403).json({ error: 'Les clients n\'ont pas de permissions admin' });
    // [SÉCURITÉ] Seul le SuperAdmin gère les comptes MASTER
    if (user.role === 'MASTER' && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Seul le SuperAdmin peut modifier un compte MASTER' });
    await prisma.user.update({ where: { id: userId }, data: { permissions: permissions as Permission[] } });
    await prisma.auditLog.create({ data: { action:'MAJ_PERMISSIONS', entite:'User', entiteId:userId, actorId:req.user!.userId, details:{ permissions } } });
    return res.json({ success:true, message:'Permissions mises a jour', data:{ userId, permissions } });
  } catch(err:any) { return res.status(500).json({ error: err.message }); }
}

export async function toggleAdmin(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'Impossible de desactiver le SuperAdmin' });
    if (user.role === 'CLIENT')      return res.status(403).json({ error: 'Utilisez le module clients' });
    // [SÉCURITÉ] Seul le SuperAdmin gère les comptes MASTER
    if (user.role === 'MASTER' && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Seul le SuperAdmin peut activer/désactiver un compte MASTER' });
    const nouvelEtat = !user.actif;
    await prisma.user.update({ where: { id: userId }, data: { actif: nouvelEtat } });
    await prisma.auditLog.create({ data: { action: nouvelEtat?'ACTIVATION_ADMIN':'DESACTIVATION_ADMIN', entite:'User', entiteId:userId, actorId:req.user!.userId } });
    return res.json({ success:true, message:`Compte ${nouvelEtat ? 'active' : 'desactive'}`, actif:nouvelEtat });
  } catch(err:any) { return res.status(500).json({ error: err.message }); }
}

export async function resetPasswordAdmin(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'SUPER_ADMIN' && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Seul le SuperAdmin peut reinitialiser son mot de passe' });
    if (user.role === 'MASTER' && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Seul le SuperAdmin peut reinitialiser le mot de passe d\'un MASTER' });
    const newPwd  = `LCP-${randomInt(100000, 1000000)}`;
    const newHash = await bcrypt.hash(newPwd, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash:newHash, refreshToken:null } });
    await prisma.auditLog.create({ data: { action:'RESET_PASSWORD_ADMIN', entite:'User', entiteId:userId, actorId:req.user!.userId } });
    return res.json({ success:true, message:'Mot de passe reinitialise', motDePasseTemporaire:newPwd });
  } catch(err:any) { return res.status(500).json({ error: err.message }); }
}

export async function supprimerAdmin(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'Impossible de supprimer le SuperAdmin' });
    if (user.role === 'CLIENT')      return res.status(403).json({ error: 'Utilisez le module clients' });
    // [SÉCURITÉ] Seul le SuperAdmin peut supprimer un compte MASTER
    if (user.role === 'MASTER' && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Seul le SuperAdmin peut supprimer un compte MASTER' });
    const [hasDistrib, hasConseiller] = await Promise.all([
      prisma.distributeur.count({ where: { userId } }),
      prisma.conseiller.count({ where: { userId } }),
    ]);
    if (hasDistrib || hasConseiller)
      return res.status(409).json({ error: 'Cet utilisateur a des donnees liees. Desactivez-le plutot.' });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.auditLog.create({ data: { action:'SUPPRESSION_ADMIN', entite:'User', entiteId:userId, actorId:req.user!.userId, details:{ email:user.email, role:user.role } } });
    return res.json({ success:true, message:'Compte admin supprime' });
  } catch(err:any) { return res.status(500).json({ error: err.message }); }
}

// Retourne la structure complète modules → permissions
export async function listePermissions(_req: Request, res: Response) {
  return res.json({ data: MODULES_PERMISSIONS });
}

// ════════════════════════════════════════════════════════════════════
// SUPPRESSIONS EXPERT — SuperAdmin / Master
// Cascade complète : compte, transactions, plans, virements, cartes,
// fiches (client/conseiller/distributeur), notifications, documents.
// ════════════════════════════════════════════════════════════════════

async function supprimerCompteEtFinances(compteIds: string[]) {
  if (compteIds.length === 0) return;
  await prisma.virement.deleteMany({
    where: { OR: [{ compteSourceId: { in: compteIds } }, { compteDestId: { in: compteIds } }] },
  });
  const plans = await prisma.planEpargne.findMany({ where: { compteId: { in: compteIds } }, select: { id: true } });
  if (plans.length > 0) {
    await prisma.versementEpargne.deleteMany({ where: { planId: { in: plans.map(p => p.id) } } });
    await prisma.planEpargne.deleteMany({ where: { compteId: { in: compteIds } } });
  }
  await prisma.transaction.deleteMany({ where: { compteId: { in: compteIds } } });
  await prisma.compte.deleteMany({ where: { id: { in: compteIds } } });
}

// Supprime un user UNIQUEMENT s'il n'a plus aucune fiche (client/conseiller/distributeur)
async function supprimerUserSiOrphelin(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { _count: { select: { clients: true, conseillers: true, distributeurs: true } } },
  });
  if (u && u._count.clients + u._count.conseillers + u._count.distributeurs === 0)
    await supprimerUserComplet(userId);
}

// Suppression TOTALE d'un user et de tout son arbre de données
async function supprimerUserComplet(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Fiches client directes
  await prisma.client.deleteMany({ where: { userId } });

  // Fiches conseiller → leurs clients + cartes
  const conseillers = await prisma.conseiller.findMany({ where: { userId }, select: { id: true } });
  for (const c of conseillers) {
    const childClients = await prisma.client.findMany({ where: { conseillerId: c.id }, select: { userId: true } });
    await prisma.carte.updateMany({ where: { conseillerId: c.id }, data: { conseillerId: null } });
    await prisma.client.deleteMany({ where: { conseillerId: c.id } });
    for (const cc of childClients) await supprimerUserSiOrphelin(cc.userId);
  }
  await prisma.conseiller.deleteMany({ where: { userId } });

  // Fiches distributeur → agences + cartes + conseillers (et leurs clients)
  const distributeurs = await prisma.distributeur.findMany({ where: { userId }, select: { id: true } });
  for (const d of distributeurs) {
    await prisma.distributeur.updateMany({ where: { parentDistributeurId: d.id }, data: { parentDistributeurId: null } });
    await prisma.carte.updateMany({ where: { distributeurId: d.id }, data: { distributeurId: null } });
    const dCons = await prisma.conseiller.findMany({ where: { distributeurId: d.id }, select: { id: true, userId: true } });
    for (const dc of dCons) {
      const childClients = await prisma.client.findMany({ where: { conseillerId: dc.id }, select: { userId: true } });
      await prisma.carte.updateMany({ where: { conseillerId: dc.id }, data: { conseillerId: null } });
      await prisma.client.deleteMany({ where: { conseillerId: dc.id } });
      for (const cc of childClients) await supprimerUserSiOrphelin(cc.userId);
      await prisma.conseiller.delete({ where: { id: dc.id } });
      await supprimerUserSiOrphelin(dc.userId);
    }
  }
  await prisma.distributeur.deleteMany({ where: { userId } });

  // Comptes + finances
  const comptes = await prisma.compte.findMany({ where: { userId }, select: { id: true } });
  await supprimerCompteEtFinances(comptes.map(c => c.id));

  // Divers
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.document.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { actorId: userId } });
  await prisma.user.delete({ where: { id: userId } });
}

async function traceAudit(action: string, entite: string, entiteId: string, actorId: string, details?: any) {
  await prisma.auditLog.create({ data: { action, entite, entiteId, actorId, details } });
}

export async function supprimerClient(req: Request, res: Response) {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: 'Client introuvable' });
    if (client.userId === req.user!.userId)
      return res.status(403).json({ error: 'Impossible de supprimer votre propre compte' });
    await prisma.client.delete({ where: { id: client.id } });
    await supprimerUserSiOrphelin(client.userId);
    await traceAudit('SUPPRESSION_CLIENT', 'Client', client.id, req.user!.userId, { code: client.code });
    return res.json({ success: true, message: 'Client supprimé' });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
}

export async function supprimerConseiller(req: Request, res: Response) {
  try {
    const conseiller = await prisma.conseiller.findUnique({ where: { id: req.params.id } });
    if (!conseiller) return res.status(404).json({ error: 'Conseiller introuvable' });
    if (conseiller.userId === req.user!.userId)
      return res.status(403).json({ error: 'Impossible de supprimer votre propre compte' });

    const childClients = await prisma.client.findMany({ where: { conseillerId: conseiller.id }, select: { userId: true } });
    await prisma.carte.updateMany({ where: { conseillerId: conseiller.id }, data: { conseillerId: null } });
    await prisma.client.deleteMany({ where: { conseillerId: conseiller.id } });
    for (const cc of childClients) await supprimerUserSiOrphelin(cc.userId);
    await prisma.conseiller.delete({ where: { id: conseiller.id } });
    await supprimerUserSiOrphelin(conseiller.userId);

    await traceAudit('SUPPRESSION_CONSEILLER', 'Conseiller', conseiller.id, req.user!.userId, { code: conseiller.code });
    return res.json({ success: true, message: 'Conseiller supprimé' });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
}

export async function supprimerDistributeur(req: Request, res: Response) {
  try {
    const d = await prisma.distributeur.findUnique({ where: { id: req.params.id } });
    if (!d) return res.status(404).json({ error: 'Distributeur introuvable' });
    if (d.userId === req.user!.userId)
      return res.status(403).json({ error: 'Impossible de supprimer votre propre compte' });

    await prisma.distributeur.updateMany({ where: { parentDistributeurId: d.id }, data: { parentDistributeurId: null } });
    await prisma.carte.updateMany({ where: { distributeurId: d.id }, data: { distributeurId: null } });
    const dCons = await prisma.conseiller.findMany({ where: { distributeurId: d.id }, select: { id: true, userId: true } });
    for (const dc of dCons) {
      const childClients = await prisma.client.findMany({ where: { conseillerId: dc.id }, select: { userId: true } });
      await prisma.carte.updateMany({ where: { conseillerId: dc.id }, data: { conseillerId: null } });
      await prisma.client.deleteMany({ where: { conseillerId: dc.id } });
      for (const cc of childClients) await supprimerUserSiOrphelin(cc.userId);
      await prisma.conseiller.delete({ where: { id: dc.id } });
      await supprimerUserSiOrphelin(dc.userId);
    }
    await prisma.distributeur.delete({ where: { id: d.id } });
    await supprimerUserSiOrphelin(d.userId);

    await traceAudit('SUPPRESSION_DISTRIBUTEUR', 'Distributeur', d.id, req.user!.userId, { code: d.code });
    return res.json({ success: true, message: 'Distributeur supprimé' });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
}

// Suppression TOTALE d'un utilisateur (master, distributeur, conseiller, client)
export async function supprimerUserExpert(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.id === req.user!.userId)
      return res.status(403).json({ error: 'Impossible de supprimer votre propre compte' });
    if (user.role === 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Le compte SuperAdmin ne peut pas être supprimé' });
    // [SÉCURITÉ] Seul le SuperAdmin peut supprimer un compte MASTER
    if (user.role === 'MASTER' && req.user!.role !== 'SUPER_ADMIN')
      return res.status(403).json({ error: 'Seul le SuperAdmin peut supprimer un compte MASTER' });

    await supprimerUserComplet(userId);
    await traceAudit('SUPPRESSION_USER', 'User', userId, req.user!.userId, { email: user.email, role: user.role });
    return res.json({ success: true, message: `Compte ${user.role} et toutes ses données supprimés` });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
}

// Vide TOUS les clients (fiches + comptes utilisateurs orphelins de rôle CLIENT)
export async function viderClients(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({ where: { role: 'CLIENT' }, select: { id: true, email: true } });
    let supprimes = 0;
    for (const u of users) {
      if (u.id === req.user!.userId) continue;
      await prisma.client.deleteMany({ where: { userId: u.id } });
      await supprimerUserSiOrphelin(u.id);
      supprimes++;
    }
    await traceAudit('VIDAGE_CLIENTS', 'Client', 'ALL', req.user!.userId, { comptesTraites: supprimes });
    return res.json({ success: true, message: `${supprimes} compte(s) client nettoyé(s)` });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
}
