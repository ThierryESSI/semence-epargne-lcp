// backend/prisma/seed.ts — Production clean
import { PrismaClient, Role, TypeCompte, StatutCompte, Permission } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { ensureUnarciInfra, unarciConfig } from '../src/utils/unarci';
import { uploadToCloudinary } from '../src/utils/upload';
const prisma = new PrismaClient();

// Config site public par defaut
const SITE_CONFIGS_DEFAUT = [
  { cle:'SITE_NOM',          valeur:'Semence Epargne',           type:'TEXT',    label:'Nom de l\'application' },
  { cle:'SITE_SLOGAN',       valeur:'Epargner aujourd\'hui pour un avenir meilleur', type:'TEXT', label:'Slogan' },
  { cle:'SITE_TEL',          valeur:'+225 27 35 96 05 99',       type:'TEXT',    label:'Telephone affiche' },
  { cle:'SITE_EMAIL',        valeur:'infos@semenceep.ci',        type:'TEXT',    label:'Email affiche' },
  { cle:'SITE_WHATSAPP',     valeur:'+2250708249583',            type:'TEXT',    label:'WhatsApp contact' },
  { cle:'SITE_ADRESSE',      valeur:'COCODY les OSCARS Bd Latrille, Abidjan', type:'TEXT', label:'Adresse' },
  { cle:'SITE_LOGO_URL',     valeur:'/logo.png',                 type:'IMAGE',   label:'Logo principal' },
  { cle:'FRAIS_TAUX',        valeur:'0.01',                      type:'TEXT',    label:'Taux de frais (1%)' },
  { cle:'BONUS_3M_TAUX',     valeur:'0.035',                     type:'TEXT',    label:'Taux bonus 3 mois' },
  { cle:'BONUS_6M_TAUX',     valeur:'0.08',                      type:'TEXT',    label:'Taux bonus 6 mois' },
  { cle:'BONUS_12M_TAUX',    valeur:'0.17',                      type:'TEXT',    label:'Taux bonus 12 mois' },
  { cle:'NOTIF_WHATSAPP_ACTIVE', valeur:'true',                  type:'BOOLEAN', label:'Notifications WhatsApp' },
  { cle:'NOTIF_EMAIL_ACTIVE',    valeur:'true',                  type:'BOOLEAN', label:'Notifications Email' },
  { cle:'SITE_COULEUR_PRIMAIRE',  valeur:'#F65A04',              type:'TEXT',    label:'Couleur orange' },
  { cle:'SITE_COULEUR_SECONDAIRE',valeur:'#1C5B9B',              type:'TEXT',    label:'Couleur bleue' },
  { cle:'MAINTENANCE_MODE',      valeur:'false',                 type:'BOOLEAN', label:'Mode maintenance' },
];

function generateRIB(suffix: string): string {
  return `LCP-CI-${suffix.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8).padEnd(8,'0')}`;
}

// Évite les collisions sur la contrainte unique `telephone`
async function findFreeTelephone(base: string): Promise<string> {
  let tel = base;
  let i = 1;
  while (await prisma.user.findUnique({ where: { telephone: tel } })) {
    tel = `${base.slice(0, Math.max(1, 10 - String(i).length))}${i}`;
    i++;
  }
  return tel;
}

// Galerie : photo de la signature de partenariat UNARTCI / Le Crédit Panafricain.
// Idempotent : ne re-upload pas à chaque déploiement.
const GALERIE_PHOTO_TITRE = 'Signature de partenariat UNARTCI & Le Crédit Panafricain';
const GALERIE_PHOTO_DESCRIPTIF = `Le lundi 3 août 2026, au siège de l'Union Nationale des Artistes de Côte d'Ivoire sis à Cocody 2 Plateaux Mobil, il y a eu la signature de partenariat entre l'UNARTCI et Le Crédit Panafricain relativement à l'identification et à l'adhésion des artistes de Côte d'Ivoire.
En effet, le Président Aimond Williams et le PDG Ahipo Georges ont scellé un partenariat entre les deux Organisations, en présence de responsables de l'UNARTCI, notamment le SG Diallo Ticouaï Vincent, le Directeur Exécutif Basile Blé, le Directeur de l'administration Boudou Célestin. Il revient donc à l'opérateur technique de procéder à l'identification des artistes issus de tous les corps de métier liés à l'art, d'organiser les adhésions et de confectionner les cartes de membres de l'UNARTCI, donnant droit à de nombreux avantages.
Remerciant le Président Aimond Williams pour la confiance placée en sa structure, le PDG du Crédit Panafricain a tenu à le rassurer quant à son expérience acquise sur le terrain, et qui lui donne de disposer actuellement d'une base de données de 15 mille artistes, tout en escomptant atteindre plus de 150 milles artistes, d'ici la fin de l'année 2026.
Poursuivant sur sa lancée, M. Ahipo a expliqué que relativement à l'opération d'adhésion, les créateurs vivant en Côte d'Ivoire et ceux de la diaspora n'auront pas besoin de se déplacer, d'autant plus qu'à partir de leurs smartphones, ils pourront s'inscrire en temps réel et payer leurs droits d'adhésion, en toute transparence.
Il faut dire que le PDG du Crédit Panafricain était accompagné d'une délégation comprenant Mme Dogba Odette, responsable de la communication et M. Danou Djedoua, responsable financier.
La cérémonie de signature de partenariat entre l'UNARTCI et Le Crédit Panafricain s'est achevée par la remise d'une imprimante HP Laser couleur à grand tirage et des polos et casquettes par le partenaire au SG Diallo Ticouaï Vincent qui, à son tour, les a confiés au Directeur de l'administration de l'UNARTCI, Boudou Célestin, ayant promis en faire bon usage.
C'est assurément un partenariat fructueux qui augure des lendemains meilleurs pour les artistes de Côte d'Ivoire, sous le leadership du Président Aimond Williams, qui ne cesse de poser des actes concrets dans le sens du repositionnement de l'Union Nationale des Artistes de Côte d'Ivoire.`;

async function seedGaleriePartenariat() {
  const PUBLIC_ID = 'partenariat-unarci-lcp';
  const existants = await prisma.siteConfig.findMany({
    where: { cle: { startsWith: 'GALERIE_PHOTO_' } },
    select: { cle: true, valeur: true },
  });
  const dejaAjoute = existants.some(c => {
    try { return JSON.parse(c.valeur).publicId === `semenceep/galerie/${PUBLIC_ID}`; }
    catch { return false; }
  });

  if (dejaAjoute) return;

  const chemins = [
    path.resolve(__dirname, '..', 'assets', 'galerie', `${PUBLIC_ID}.jpeg`),
    path.resolve(__dirname, '..', '..', 'Ping.jpeg'),
  ];
  const fichier = chemins.find(f => fs.existsSync(f));
  const credsCloud = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

  if (!fichier) return console.warn('⚠️ Galerie : image du partenariat introuvable (assets/galerie)');
  if (!credsCloud) return console.warn('⚠️ Galerie : creds Cloudinary manquants, photo non ajoutée');

  const { url, publicId } = await uploadToCloudinary(fs.readFileSync(fichier), { folder: 'galerie', publicId: PUBLIC_ID });

  let maxOrdre = 0;
  for (const c of existants) {
    const n = parseInt(c.cle.replace('GALERIE_PHOTO_', ''), 10);
    if (!Number.isNaN(n) && n > maxOrdre) maxOrdre = n;
  }
  const ordre = maxOrdre + 1;
  const cle = `GALERIE_PHOTO_${String(ordre).padStart(3, '0')}`;
  await prisma.siteConfig.upsert({
    where: { cle },
    update: {},
    create: {
      cle,
      valeur: JSON.stringify({ url, publicId, titre: GALERIE_PHOTO_TITRE, descriptif: GALERIE_PHOTO_DESCRIPTIF, date: '3 août 2026', ordre }),
      type: 'IMAGE',
      label: `Photo galerie ${ordre}`,
    },
  });
  // Active la galerie sur le site public
  await prisma.siteConfig.upsert({
    where: { cle: 'GALERIE_ACTIVE' },
    update: { valeur: 'true' },
    create: { cle: 'GALERIE_ACTIVE', valeur: 'true', type: 'BOOLEAN', label: 'Activer la galerie sur le site' },
  });
  console.log('✅ Galerie : photo du partenariat UNARTCI ajoutée et galerie activée');
}

async function main() {

  console.log('🌱 Initialisation LCP Semence Épargne v6...\n');

  // Config système
  const configs = [
    { cle:'FRAIS_TAUX',               valeur:'0.01'   },
    { cle:'PART_LCP',                 valeur:'0.006'  },
    { cle:'PART_DISTRIBUTEUR',        valeur:'0.004'  },
    { cle:'MONTANT_MIN_CARTE',        valeur:'200'    },
    { cle:'MONTANT_MAX_CARTE',        valeur:'500000' },
    { cle:'BONUS_TROIS_MOIS_TAUX',    valeur:'0.035'  },
    { cle:'BONUS_SIX_MOIS_TAUX',      valeur:'0.08'   },
    { cle:'BONUS_DOUZE_MOIS_TAUX',    valeur:'0.17'   },
    { cle:'OFFLINE_SYNC_RETRY_MAX',   valeur:'5'      },
    { cle:'OFFLINE_SYNC_INTERVAL_MS', valeur:'30000'  },
    { cle:'VERSION',                  valeur:'6.0.0'  },
  ];
  for (const c of configs)
    await prisma.config.upsert({ where:{ cle:c.cle }, update:{ valeur:c.valeur }, create:c });
  console.log(`✅ ${configs.length} paramètres configurés`);

  // SuperAdmin — accès total, au-dessus du Master
  const SA_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@semenceep.ci';
  const SA_TEL   = process.env.SUPER_ADMIN_TEL   || '2700000001';
  const SA_PWD   = process.env.SUPER_ADMIN_PWD   || 'SuperAdmin@LCP2026!ChangeMe!';
  const sa = await prisma.user.upsert({
    where:{ email:SA_EMAIL }, update:{},
    create:{ email:SA_EMAIL, telephone:await findFreeTelephone(SA_TEL), passwordHash:await bcrypt.hash(SA_PWD,12), nom:'SUPER ADMIN', prenom:'LCP', role:Role.SUPER_ADMIN, actif:true, permissions:[] }
  });
  await prisma.compte.upsert({ where:{ userId:sa.id }, update:{}, create:{ numeroCompte:'LCP-SA-0001', rib:generateRIB('SA000001'), type:TypeCompte.ORDINAIRE, statut:StatutCompte.ACTIF, userId:sa.id } });
  console.log(`✅ SuperAdmin   : ${SA_EMAIL} / ${SA_PWD}`);

  // Master LCP
  const MASTER_EMAIL = process.env.MASTER_EMAIL || 'master@semenceep.ci';
  const MASTER_TEL   = process.env.MASTER_TEL   || '2735960599';
  const MASTER_PWD   = process.env.MASTER_PWD   || 'Master@LCP2026!ChangeMe!';
  const master = await prisma.user.upsert({
    where:{ email:MASTER_EMAIL }, update:{},
    create:{ email:MASTER_EMAIL, telephone:await findFreeTelephone(MASTER_TEL), passwordHash:await bcrypt.hash(MASTER_PWD,12), nom:'CREDIT PANAFRICAIN', prenom:'LE', role:Role.MASTER, actif:true, permissions:[] }
  });
  await prisma.compte.upsert({ where:{ userId:master.id }, update:{}, create:{ numeroCompte:'LCP-MASTER-0001', rib:generateRIB('MASTER001'), type:TypeCompte.ORDINAIRE, statut:StatutCompte.ACTIF, userId:master.id } });
  console.log(`✅ Master LCP   : ${MASTER_EMAIL} / ${MASTER_PWD}`);

  // SiteConfig
  for (const cfg of SITE_CONFIGS_DEFAUT) {
    await prisma.siteConfig.upsert({ where:{ cle:cfg.cle }, update:{}, create:cfg }).catch(()=>{});
  }
  console.log('OK SiteConfig initialise');

  // Galerie — photo du partenariat UNARTCI / Le Crédit Panafricain
  await seedGaleriePartenariat();

  // Agence UNARCI (distributeur + conseiller + compte login)
  try {
    const infra = await ensureUnarciInfra();
    const cfgU = await unarciConfig();
    console.log('✅ Agence UNARCI :', cfgU.UNARCI_DIST_LOGIN || infra.login, '/', cfgU.UNARCI_DIST_PWD || '(voir Paramètres)');
  } catch (e: any) {
    console.warn('⚠️ UNARCI non initialisé :', e.message);
  }

  console.log('\n⚠️  IMPORTANT : Changez TOUS les mots de passe ci-dessus immédiatement !');
  console.log('\n📋 Hiérarchie des rôles :');
  console.log('   SUPER_ADMIN > MASTER > DISTRIBUTEUR > CONSEILLER > CLIENT');
  console.log('\n🔐 Permissions disponibles via /api/super-admin/permissions');
  console.log('📱 WhatsApp : configurer WHATSAPP_API_KEY dans .env');
  console.log('📧 Email    : configurer SMTP_URL dans .env');
  console.log('📡 SMS zone rurale : configurer SMS_WEBHOOK_SECRET dans .env');
  console.log('\n🌱 Plans épargne : 3 mois(3,5%) · 6 mois(8%) · 12 mois(17%)');
  console.log('🔒 Cartes : verrou anti-double-activation intégré\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
