// backend/src/controllers/comptes.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateCodeActeur, generateTempPassword } from '../utils/crypto';
import { sendSms, tpl } from '../utils/sms';
import { notifier, emailTpl } from '../utils/notifications';
import { clientAppartientA, ROLES_STAFF } from '../utils/acces';
import { Role } from '@prisma/client';

function generateRIB(userId: string): string {
  const ts  = Date.now().toString(36).toUpperCase().slice(-4);
  const uid = userId.slice(-6).toUpperCase();
  return `LCP-CI-${ts}${uid}`;
}

export async function ouvrirCompte(req: Request, res: Response) {
  try {
    const {
      nom, prenom, email, telephone,
      whatsapp,                           // [NEW] optionnel
      dateNaissance,                      // [NEW] date de naissance du client
      notifWhatsapp = false,              // [NEW] préférence
      notifEmail    = false,              // [NEW] préférence
      region, ville, departement, commune,
      typeCompte = 'ORDINAIRE',
      conseillerId: conseillerIdBody
    } = req.body;

    const manquants: string[] = [];
    if (!nom)       manquants.push('nom');
    if (!prenom)    manquants.push('prenom');
    if (!telephone) manquants.push('telephone');
    if (!region)    manquants.push('region');
    if (!commune)   manquants.push('commune');
    if (manquants.length > 0)
      return res.status(400).json({ error:`Champs obligatoires manquants : ${manquants.join(', ')}` });

    // Validation numéro CI
    const tel10   = telephone.replace(/\D/g,'');
    const local10 = tel10.startsWith('225') ? '0' + tel10.slice(3) : tel10;
    const prefixes = ['07','05','01','25','27'];
    if (local10.length !== 10 || !prefixes.some(p => local10.startsWith(p)))
      return res.status(400).json({ error:'Numéro invalide. Format CI : 07XXXXXXXX (Orange), 05XXXXXXXX (MTN), 01XXXXXXXX (Moov), 25XXXXXXXX / 27XXXXXXXX (fixe). 10 chiffres obligatoires.' });

    // Validation WhatsApp (optionnel mais si fourni, doit être valide CI)
    if (whatsapp) {
      const wa10    = whatsapp.replace(/\D/g,'');
      const waLocal = wa10.startsWith('225') ? '0' + wa10.slice(3) : wa10;
      if (waLocal.length !== 10 || !prefixes.some(p => waLocal.startsWith(p)))
        return res.status(400).json({ error:'Numéro WhatsApp invalide. Même format CI requis.' });
    }

    let conseillerId = conseillerIdBody;
    if (!conseillerId && req.user!.role === 'CONSEILLER') {
      const c = await prisma.conseiller.findFirst({ where:{ userId:req.user!.userId } });
      conseillerId = c?.id;
    }
    if (!conseillerId) {
      const premier = await prisma.conseiller.findFirst({ orderBy:{ createdAt:'asc' } });
      conseillerId  = premier?.id;
    }
    if (!conseillerId)
      return res.status(400).json({ error:'Aucun conseiller disponible. Créez d\'abord un conseiller.' });

    // ── Réutilisation d'un compte existant (1 personne = 1 compte) ──
    const existingUser = await prisma.user.findUnique({ where:{ telephone } });
    const userParEmail = !existingUser && email ? await prisma.user.findUnique({ where:{ email } }) : null;
    const user         = existingUser || userParEmail;

    if (user) {
      const dejaClient = await prisma.client.findFirst({ where:{ userId:user.id } });
      if (dejaClient)
        return res.status(409).json({ error:`${user.prenom || ''} ${user.nom} est déjà client (${dejaClient.code})` });

      const hasCompte = await prisma.compte.findFirst({ where:{ userId:user.id } });
      let numeroCompte = hasCompte?.numeroCompte;
      let rib          = hasCompte?.rib;
      if (!hasCompte) {
        numeroCompte = `SE-${user.id.slice(-8).toUpperCase()}`;
        rib          = generateRIB(user.id);
        await prisma.compte.create({ data:{ numeroCompte, rib, type:typeCompte as any, statut:'ACTIF', userId:user.id } });
      }

      const codeClient = generateCodeActeur('CLI');
      const villeFinal = ville || departement || region;
      await prisma.client.create({ data:{ code:codeClient, region, ville:villeFinal, commune, conseillerId, userId:user.id } });

      if (whatsapp)
        await prisma.user.update({ where:{ id:user.id }, data:{ whatsapp, notifWhatsapp: notifWhatsapp && !!whatsapp } });

      await prisma.auditLog.create({ data:{ action:'OUVERTURE_COMPTE', entite:'User', entiteId:user.id, actorId:req.user!.userId, details:{ codeClient, numeroCompte, rib, telephone, compteReutilise:true } } });

      notifier({
        userId:         user.id,
        telephone:      user.telephone,
        whatsapp:       user.whatsapp,
        email:          user.email,
        notifWhatsapp:  user.notifWhatsapp,
        notifEmail:     user.notifEmail,
        messageSms:     tpl.compteClientAjoute(`${user.prenom} ${user.nom}`, codeClient, numeroCompte!),
      }).catch(() => {});

      return res.status(201).json({
        success: true,
        message: 'Client ajouté au compte existant.',
        data:    { userId:user.id, codeClient, numeroCompte, rib, telephone, whatsapp: whatsapp || user.whatsapp || null, compteReutilise:true }
      });
    }

    // ── Nouveau compte ──────────────────────────────────────────────
    const emailFinal     = email || `${telephone.replace(/\D/g,'')}@semence-noemail.ci`;
    const tempPassword   = generateTempPassword();
    const passwordHash   = await bcrypt.hash(tempPassword, 12);

    const newUser = await prisma.user.create({
      data: {
        email:         emailFinal,
        telephone,
        whatsapp:      whatsapp || null,
        dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
        notifWhatsapp: notifWhatsapp && !!whatsapp,
        notifEmail:    notifEmail && !!email,
        passwordHash,
        nom:           nom.toUpperCase().trim(),
        prenom:        prenom.trim(),
        role:          Role.CLIENT,
        actif:         true,
      }
    });

    const codeClient   = generateCodeActeur('CLI');
    const numeroCompte = `SE-${newUser.id.slice(-8).toUpperCase()}`;
    const rib          = generateRIB(newUser.id);
    const villeFinal   = ville || departement || region;

    await prisma.client.create({ data:{ code:codeClient, region, ville:villeFinal, commune, conseillerId, userId:newUser.id } });
    await prisma.compte.create({ data:{ numeroCompte, rib, type:typeCompte as any, statut:'ACTIF', userId:newUser.id } });
    await prisma.auditLog.create({ data:{ action:'OUVERTURE_COMPTE', entite:'User', entiteId:newUser.id, actorId:req.user!.userId, details:{ codeClient, numeroCompte, rib, telephone } } });

    // Notification multi-canal à l'inscription
    const appUrl  = process.env.FRONTEND_URL || 'https://app.semenceep.ci';
    const tplEmail = emailTpl.compteOuvert(`${prenom} ${nom}`, numeroCompte, rib, telephone, tempPassword);
    await notifier({
      userId:        newUser.id,
      telephone,
      whatsapp:      whatsapp || null,
      email:         email || null,
      notifWhatsapp: notifWhatsapp && !!whatsapp,
      notifEmail:    notifEmail && !!email,
      messageSms:    tpl.compteOuvert(`${prenom} ${nom}`, numeroCompte, telephone, tempPassword, `${appUrl}/client`),
      sujetEmail:    tplEmail.sujet,
      htmlEmail:     tplEmail.html,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Compte créé avec succès.',
      data:    { userId:newUser.id, codeClient, numeroCompte, rib, telephone, whatsapp:whatsapp||null, dateNaissance:dateNaissance||null, tempPassword }
    });
  } catch (err: any) {
    if (err.code === 'P2002') { const field = err.meta?.target?.[0]||'champ'; return res.status(409).json({ error:`Ce ${field} est déjà utilisé` }); }
    console.error('[ouvrirCompte]', err);
    return res.status(500).json({ error:'Erreur serveur interne' });
  }
}

export async function activerCompte(req: Request, res: Response) {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error:'userId requis' });

  // [SÉCURITÉ] Un client ne peut activer que SON compte ; les rôles staff activent
  // uniquement les clients de leur réseau (conseiller/distributeur).
  const role = req.user!.role;
  if (role === 'CLIENT') {
    if (userId !== req.user!.userId) return res.status(403).json({ error:'Accès refusé' });
  } else if (ROLES_STAFF.includes(role as any)) {
    if (role !== 'MASTER' && role !== 'SUPER_ADMIN' && !(await clientAppartientA(userId, role, req.user!.userId)))
      return res.status(403).json({ error:'Accès refusé : ce client ne dépend pas de votre réseau' });
  } else {
    return res.status(403).json({ error:'Accès refusé' });
  }

  const user = await prisma.user.findUnique({ where:{ id:userId } });
  if (!user) return res.status(404).json({ error:'Utilisateur introuvable' });
  if (user.actif) return res.json({ message:'Compte déjà actif' });
  await prisma.$transaction([
    prisma.user.update({ where:{ id:userId }, data:{ actif:true } }),
    prisma.compte.update({ where:{ userId }, data:{ statut:'ACTIF' } }),
  ]);
  sendSms({ to:user.telephone, message:tpl.compteActive(`${user.prenom} ${user.nom}`), userId:user.id }).catch(() => {});
  return res.json({ success:true, message:'Compte activé avec succès' });
}

export async function getSolde(req: Request, res: Response) {
  const compte = await prisma.compte.findUnique({
    where:  { userId:req.user!.userId },
    select: { numeroCompte:true, rib:true, solde:true, statut:true, type:true, updatedAt:true }
  });
  if (!compte) return res.status(404).json({ error:'Compte introuvable' });
  return res.json({ data:{ ...compte, solde:Number(compte.solde) } });
}

export async function getCompteById(req: Request, res: Response) {
  const compte = await prisma.compte.findUnique({
    where:   { id:req.params.id },
    include: { user:{ select:{ nom:true, prenom:true, email:true, telephone:true, whatsapp:true, role:true } }, transactions:{ orderBy:{ createdAt:'desc' }, take:10 } }
  });
  if (!compte) return res.status(404).json({ error:'Compte introuvable' });

  // [SÉCURITÉ] Scoping : un distributeur ne voit que les comptes de ses clients.
  if (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE') {
    if (!(await clientAppartientA(compte.userId, req.user!.role, req.user!.userId)))
      return res.status(403).json({ error:'Accès refusé : ce compte ne dépend pas de votre réseau' });
  }
  return res.json({ data:compte });
}
