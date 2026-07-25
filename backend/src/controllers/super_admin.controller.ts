// backend/src/controllers/super_admin.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { Role, Permission } from '@prisma/client';

// Définition des modules et leurs propriétés
export const MODULES_PERMISSIONS: Record<string, { label: string; permissions: { code: Permission; label: string }[] }> = {
  CLIENTS: {
    label: 'Clients',
    permissions: [
      { code: 'CLIENTS_VOIR',      label: 'Voir les clients' },
      { code: 'CLIENTS_AJOUTER',   label: 'Ajouter un client' },
      { code: 'CLIENTS_MODIFIER',  label: 'Modifier un client' },
      { code: 'CLIENTS_SUPPRIMER', label: 'Supprimer un client' },
    ]
  },
  DISTRIBUTEURS: {
    label: 'Distributeurs',
    permissions: [
      { code: 'DISTRIBUTEURS_VOIR',      label: 'Voir les distributeurs' },
      { code: 'DISTRIBUTEURS_AJOUTER',   label: 'Ajouter un distributeur' },
      { code: 'DISTRIBUTEURS_MODIFIER',  label: 'Modifier un distributeur' },
      { code: 'DISTRIBUTEURS_SUPPRIMER', label: 'Supprimer un distributeur' },
    ]
  },
  CONSEILLERS: {
    label: 'Conseillers',
    permissions: [
      { code: 'CONSEILLERS_VOIR',      label: 'Voir les conseillers' },
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
    const permsInvalides = permissions.filter((p:string) => !ALL_PERMISSIONS.includes(p as Permission));
    if (permsInvalides.length > 0)
      return res.status(400).json({ error: `Permissions invalides : ${permsInvalides.join(', ')}` });
    const [exEmail, exTel] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { telephone } }),
    ]);
    if (exEmail) return res.status(409).json({ error: 'Cet email est deja utilise' });
    if (exTel)   return res.status(409).json({ error: 'Ce telephone est deja utilise' });
    const pwd  = motDePasse || `LCP-Admin-${Math.random().toString(36).slice(2,8).toUpperCase()}!`;
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
    const newPwd  = `LCP-${Math.random().toString(36).slice(2,6).toUpperCase()}-${Math.floor(1000+Math.random()*9000)}!`;
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
