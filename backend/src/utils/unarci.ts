// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// ============================================================
// backend/src/utils/unarci.ts
// Infrastructure UNARCI auto-créée (idempotente) :
//  - Distributeur AGREE "UNARCI"
//  - Conseiller rattaché à ce distributeur
//  - Compte login de l'agence (identifiants stockés en SiteConfig)
//  - Paramètres SiteConfig (montant adhésion, numéro de paie)
import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { Role, TypeDistributeur, TypeConseiller, TypeCompte, StatutCompte, Permission } from '@prisma/client';
import { generateCodeActeur, generateTempPassword } from './crypto';

export const UNARCI_CONST = {
  NOM_ENTREPRISE: 'UNARCI',
  EMAIL: 'unarci@semenceep.ci',
  TEL: '0705873039',
  VILLE: 'ABIDJAN',
  MONTANT_DEFAUT: '10000',
  PAIE_NUMERO_DEFAUT: '+2250705873039',
};

export const PERMISSIONS_UNARCI: Permission[] = [
  'CLIENTS_VOIR',
  'CLIENTS_MODIFIER',
  'CARTES_VOIR',
  'TRANSACTIONS_VOIR',
  'EPARGNE_VOIR',
];

async function findFreeTelephone(base: string): Promise<string> {
  let tel = base;
  let i = 1;
  while (await prisma.user.findUnique({ where: { telephone: tel } })) {
    tel = `${base.slice(0, Math.max(1, 10 - String(i).length))}${i}`;
    i++;
  }
  return tel;
}

// Ancien generatePassword supprimé — utiliser generateTempPassword depuis crypto.ts

// ─── Config / identifiants UNARCI ─────────────────────────────────────
export async function unarciConfig() {
  const rows = await prisma.siteConfig.findMany({
    where: { cle: { in: ['UNARCI_ACTIF','UNARCI_ADHESION_MONTANT','UNARCI_PAIE_NUMERO','UNARCI_DIST_LOGIN','UNARCI_DIST_PWD','UNARCI_DIST_ID','UNARCI_CONS_ID'] } },
  });
  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.cle] = r.valeur;
  return cfg;
}

// ─── Création idempotente de l'infrastructure UNARCI ──────────────────
export async function ensureUnarciInfra() {
  const defaults = [
    { cle:'UNARCI_ACTIF',           valeur:'true',                       label:'Activer le module UNARCI' },
    { cle:'UNARCI_ADHESION_MONTANT', valeur:UNARCI_CONST.MONTANT_DEFAUT, label:'Montant adhésion UNARCI (FCFA)' },
    { cle:'UNARCI_PAIE_NUMERO',     valeur:UNARCI_CONST.PAIE_NUMERO_DEFAUT, label:'Numéro de paie LCP (mobile money)' },
  ];
  for (const c of defaults)
    await prisma.siteConfig.upsert({ where:{ cle:c.cle }, update:{}, create:{ cle:c.cle, valeur:c.valeur, label:c.label } }).catch(() => {});

  const cfg = await unarciConfig();
  if (cfg.UNARCI_DIST_ID && cfg.UNARCI_CONS_ID)
    return { distributeurId: cfg.UNARCI_DIST_ID, conseillerId: cfg.UNARCI_CONS_ID, login: cfg.UNARCI_DIST_LOGIN };

  // Distributeur
  let dist = await prisma.distributeur.findFirst({ where:{ nomEntreprise: UNARCI_CONST.NOM_ENTREPRISE } });
  if (!dist) {
    let user = await prisma.user.findUnique({ where:{ email: UNARCI_CONST.EMAIL } });
    let pwd = '';
    if (!user) {
      pwd = generateTempPassword();
      user = await prisma.user.create({
        data: {
          email: UNARCI_CONST.EMAIL,
          telephone: await findFreeTelephone(UNARCI_CONST.TEL),
          passwordHash: await bcrypt.hash(pwd, 12),
          nom: 'UNARCI', prenom: 'AGENCE',
          role: Role.DISTRIBUTEUR_AGREE, actif: true,
          permissions: PERMISSIONS_UNARCI,
        },
      });
      await prisma.siteConfig.upsert({ where:{ cle:'UNARCI_DIST_PWD' }, update:{ valeur:pwd }, create:{ cle:'UNARCI_DIST_PWD', valeur:pwd, label:'Mot de passe agence UNARCI' } });
    }
    await prisma.compte.upsert({
      where:{ userId:user.id }, update:{},
      create:{ numeroCompte:'UNARCI-0001', rib:'RI-UNARCI-0001', type:TypeCompte.ORDINAIRE, statut:StatutCompte.ACTIF, userId:user.id },
    });
    dist = await prisma.distributeur.create({
      data: { code: generateCodeActeur('DA'), type: TypeDistributeur.AGREE, nomEntreprise: UNARCI_CONST.NOM_ENTREPRISE, ville: UNARCI_CONST.VILLE, pays:'CI', userId:user.id },
    });
    await prisma.siteConfig.upsert({ where:{ cle:'UNARCI_DIST_ID' }, update:{ valeur:dist.id }, create:{ cle:'UNARCI_DIST_ID', valeur:dist.id, label:'Id distributeur UNARCI' } });
    await prisma.siteConfig.upsert({ where:{ cle:'UNARCI_DIST_LOGIN' }, update:{ valeur:user.email }, create:{ cle:'UNARCI_DIST_LOGIN', valeur:user.email, label:'Login agence UNARCI' } });
  } else {
    await prisma.siteConfig.upsert({ where:{ cle:'UNARCI_DIST_ID' }, update:{ valeur:dist.id }, create:{ cle:'UNARCI_DIST_ID', valeur:dist.id, label:'Id distributeur UNARCI' } });
  }

  // Conseiller
  let cons = await prisma.conseiller.findFirst({ where:{ distributeurId: dist.id } });
  if (!cons) {
    cons = await prisma.conseiller.create({
      data: { code:'UNARCI-CONS', type:TypeConseiller.STAND, region:UNARCI_CONST.VILLE, distributeurId:dist.id, userId:dist.userId },
    });
    await prisma.siteConfig.upsert({ where:{ cle:'UNARCI_CONS_ID' }, update:{ valeur:cons.id }, create:{ cle:'UNARCI_CONS_ID', valeur:cons.id, label:'Id conseiller UNARCI' } });
  }

  const cfg2 = await unarciConfig();
  return { distributeurId: dist.id, conseillerId: cons.id, login: cfg2.UNARCI_DIST_LOGIN };
}
