// backend/prisma/seed.ts — Production clean
import { PrismaClient, Role, TypeCompte, StatutCompte, Permission } from '@prisma/client';
import bcrypt from 'bcryptjs';
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
    create:{ email:SA_EMAIL, telephone:SA_TEL, passwordHash:await bcrypt.hash(SA_PWD,12), nom:'SUPER ADMIN', prenom:'LCP', role:Role.SUPER_ADMIN, actif:true, permissions:[] }
  });
  await prisma.compte.upsert({ where:{ userId:sa.id }, update:{}, create:{ numeroCompte:'LCP-SA-0001', rib:generateRIB('SA000001'), type:TypeCompte.ORDINAIRE, statut:StatutCompte.ACTIF, userId:sa.id } });
  console.log(`✅ SuperAdmin   : ${SA_EMAIL} / ${SA_PWD}`);

  // Master LCP
  const MASTER_EMAIL = process.env.MASTER_EMAIL || 'master@semenceep.ci';
  const MASTER_TEL   = process.env.MASTER_TEL   || '2735960599';
  const MASTER_PWD   = process.env.MASTER_PWD   || 'Master@LCP2026!ChangeMe!';
  const master = await prisma.user.upsert({
    where:{ email:MASTER_EMAIL }, update:{},
    create:{ email:MASTER_EMAIL, telephone:MASTER_TEL, passwordHash:await bcrypt.hash(MASTER_PWD,12), nom:'CREDIT PANAFRICAIN', prenom:'LE', role:Role.MASTER, actif:true, permissions:[] }
  });
  await prisma.compte.upsert({ where:{ userId:master.id }, update:{}, create:{ numeroCompte:'LCP-MASTER-0001', rib:generateRIB('MASTER001'), type:TypeCompte.ORDINAIRE, statut:StatutCompte.ACTIF, userId:master.id } });
  console.log(`✅ Master LCP   : ${MASTER_EMAIL} / ${MASTER_PWD}`);

  // SiteConfig
  for (const cfg of SITE_CONFIGS_DEFAUT) {
    await prisma.siteConfig.upsert({ where:{ cle:cfg.cle }, update:{}, create:cfg }).catch(()=>{});
  }
  console.log('OK SiteConfig initialise');

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
