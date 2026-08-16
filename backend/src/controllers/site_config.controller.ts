// backend/src/controllers/site_config.controller.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/upload';

// Valeurs par défaut du site public
const CONFIGS_DEFAUT = [
  { cle:'SITE_NOM',          valeur:'Semence Epargne',           type:'TEXT',    label:'Nom de l\'application' },
  { cle:'SITE_SLOGAN',       valeur:'Epargner aujourd\'hui pour un avenir meilleur', type:'TEXT', label:'Slogan' },
  { cle:'SITE_DESCRIPTION',  valeur:'Plateforme de microfinance du Credit Panafricain. Activez vos cartes, epargnez et recevez vos bonus.', type:'TEXT', label:'Description publique' },
  { cle:'SITE_TEL',          valeur:'+225 27 35 96 05 99',       type:'TEXT',    label:'Telephone affiché' },
  { cle:'SITE_EMAIL',        valeur:'infos@semenceep.ci',        type:'TEXT',    label:'Email affiché' },
  { cle:'SITE_WHATSAPP',     valeur:'+2250708249583',            type:'TEXT',    label:'WhatsApp contact' },
  { cle:'SITE_ADRESSE',      valeur:'COCODY les OSCARS Bd Latrille, Abidjan, Côte d\'Ivoire', type:'TEXT', label:'Adresse' },
  { cle:'SITE_LOGO_URL',     valeur:'/logo.png',                 type:'IMAGE',   label:'Logo principal' },
  { cle:'SITE_HERO_IMAGE',   valeur:'',                          type:'IMAGE',   label:'Image bannière principale' },
  { cle:'SITE_COULEUR_PRIMAIRE',  valeur:'#F65A04',             type:'TEXT',    label:'Couleur orange (logo)' },
  { cle:'SITE_COULEUR_SECONDAIRE',valeur:'#1C5B9B',             type:'TEXT',    label:'Couleur bleue (logo)' },
  { cle:'FRAIS_TAUX',        valeur:'0.01',                      type:'TEXT',    label:'Taux de frais (1%)' },
  { cle:'PART_LCP',          valeur:'0.006',                     type:'TEXT',    label:'Part LCP (0.6%)' },
  { cle:'BONUS_3M_TAUX',     valeur:'0.035',                     type:'TEXT',    label:'Taux bonus 3 mois' },
  { cle:'BONUS_6M_TAUX',     valeur:'0.08',                      type:'TEXT',    label:'Taux bonus 6 mois' },
  { cle:'BONUS_12M_TAUX',    valeur:'0.17',                      type:'TEXT',    label:'Taux bonus 12 mois' },
  { cle:'NOTIF_WHATSAPP_ACTIVE', valeur:'true',                  type:'BOOLEAN', label:'Notifications WhatsApp actives' },
  { cle:'NOTIF_EMAIL_ACTIVE',    valeur:'true',                  type:'BOOLEAN', label:'Notifications Email actives' },
  { cle:'MAINTENANCE_MODE',      valeur:'false',                 type:'BOOLEAN', label:'Mode maintenance' },
  { cle:'NUMERO_SMS_LCP',   valeur:'',      type:'TEXT',    label:'Numero SMS zone rurale (ex: 0712345678)' },
  { cle:'ALERTE_RECHARGE_TEL', valeur:'',   type:'TEXT',    label:'Numero alerte recharges SMS/WhatsApp (ex: 0708249583)' },
  { cle:'GALERIE_ACTIVE',   valeur:'false', type:'BOOLEAN', label:'Activer la galerie sur le site' },
  { cle:'SMS_TPL_ADHESION', valeur:'',      type:'TEXTAREA', label:'Template SMS adhésion UNARCI ({nom},{prenom},{numeroCompte},{tel},{pwd},{montant},{numeroPaie},{url})' },
  { cle:'SMS_TPL_COMPTE_OUVERT', valeur:'', type:'TEXTAREA', label:'Template SMS compte ouvert ({nom},{numero},{tel},{pwd},{url})' },
  { cle:'SMS_TPL_COMPTE_ACTIF', valeur:'',  type:'TEXTAREA', label:'Template SMS compte activé ({nom})' },
  { cle:'SMS_TPL_DEPOT_OK',  valeur:'',      type:'TEXTAREA', label:'Template SMS dépôt réussi ({montant},{frais},{solde})' },
  { cle:'SMS_TPL_BONUS',     valeur:'',      type:'TEXTAREA', label:'Template SMS bonus versé ({nom},{taux},{bonus},{solde})' },
  { cle:'SMS_TPL_PLAN',      valeur:'',      type:'TEXTAREA', label:'Template SMS plan activé ({nom},{palier},{taux},{echeance},{nbVers})' },
];

// [SÉCURITÉ] Whitelist des clés exposées publiquement (page d'accueil).
// Les paramètres financiers internes (frais, parts, taux bonus, numéros
// d'alerte) ne doivent JAMAIS fuiter côté public.
const CLES_PUBLIQUES = new Set([
  'SITE_NOM','SITE_SLOGAN','SITE_DESCRIPTION','SITE_TEL','SITE_EMAIL',
  'SITE_WHATSAPP','SITE_ADRESSE','SITE_LOGO_URL','SITE_HERO_IMAGE',
  'SITE_COULEUR_PRIMAIRE','SITE_COULEUR_SECONDAIRE','MAINTENANCE_MODE',
  'GALERIE_ACTIVE',
]);

// Initialiser les configs par défaut (à appeler au démarrage)
export async function initSiteConfig() {
  for (const cfg of CONFIGS_DEFAUT) {
    await prisma.siteConfig.upsert({
      where:  { cle: cfg.cle },
      update: {},
      create: cfg,
    }).catch(() => {});
  }
  console.log('SiteConfig initialisé');
}

// Lire les configs publiques (page d'accueil — sans auth)
// [SÉCURITÉ] Seules les clés de la whitelist CLES_PUBLIQUES sont renvoyées.
export async function getConfigsPubliques(_req: Request, res: Response) {
  try {
    const configs = await prisma.siteConfig.findMany({ orderBy:{ cle:'asc' } });
    const map = Object.fromEntries(configs.filter(c => CLES_PUBLIQUES.has(c.cle)).map(c => [c.cle, c.valeur]));
    return res.json({ data: map });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

// Lire toutes les configs avec métadonnées (admin)
export async function getConfigsAdmin(req: Request, res: Response) {
  try {
    const configs = await prisma.siteConfig.findMany({ orderBy:{ cle:'asc' } });
    return res.json({ data: configs });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

// Modifier une config texte
export async function updateConfig(req: Request, res: Response) {
  try {
    const { cle } = req.params;
    const { valeur } = req.body;
    if (valeur === undefined) return res.status(400).json({ error: 'valeur requis' });
    const cfg = await prisma.siteConfig.upsert({
      where:  { cle },
      update: { valeur, updatedBy: req.user!.userId },
      create: { cle, valeur, type:'TEXT', label:cle, updatedBy:req.user!.userId },
    });
    await prisma.auditLog.create({ data:{ action:'UPDATE_SITE_CONFIG', entite:'SiteConfig', entiteId:cle, actorId:req.user!.userId, details:{ cle, valeur } } });
    return res.json({ success:true, data:cfg });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}

// Upload une image (logo, bannière) vers Cloudinary
export async function uploadConfigImage(req: Request, res: Response) {
  try {
    const { cle } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Image requise' });

    // Supprimer l'ancienne image si elle existe
    const ancien = await prisma.siteConfig.findUnique({ where:{ cle } });
    if (ancien?.valeur && ancien.valeur.includes('cloudinary')) {
      const oldPublicId = `semenceep/site/${cle.toLowerCase()}`;
      await deleteFromCloudinary(oldPublicId).catch(() => {});
    }

    const { url, publicId } = await uploadToCloudinary(req.file.buffer, {
      folder:   'site',
      publicId: cle.toLowerCase(),
    });

    await prisma.siteConfig.upsert({
      where:  { cle },
      update: { valeur:url, type:'IMAGE', updatedBy:req.user!.userId },
      create: { cle, valeur:url, type:'IMAGE', label:cle, updatedBy:req.user!.userId },
    });

    await prisma.auditLog.create({ data:{ action:'UPLOAD_SITE_IMAGE', entite:'SiteConfig', entiteId:cle, actorId:req.user!.userId, details:{ url } } });
    return res.json({ success:true, data:{ url } });
  } catch(err: any) { return res.status(500).json({ error: err.message }); }
}
