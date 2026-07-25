-- Migration V6 → V7 : nouveau systeme de permissions par module
-- A executer si vous avez deja une DB v6 en production

-- 1. Supprimer l'ancien enum Permission (si existant)
-- ATTENTION : sauvegardez les permissions existantes avant

-- 2. Recreer l'enum avec les nouvelles valeurs granulaires
DO $$ BEGIN
  -- Tentative de creation (ignore si existe)
  CREATE TYPE "Permission_new" AS ENUM (
    'CLIENTS_VOIR','CLIENTS_AJOUTER','CLIENTS_MODIFIER','CLIENTS_SUPPRIMER',
    'DISTRIBUTEURS_VOIR','DISTRIBUTEURS_AJOUTER','DISTRIBUTEURS_MODIFIER','DISTRIBUTEURS_SUPPRIMER',
    'CONSEILLERS_VOIR','CONSEILLERS_AJOUTER','CONSEILLERS_MODIFIER','CONSEILLERS_SUPPRIMER',
    'CARTES_VOIR','CARTES_EMETTRE','CARTES_ATTRIBUER','CARTES_ANNULER',
    'TRANSACTIONS_VOIR','TRANSACTIONS_REMBOURSER',
    'EPARGNE_VOIR','EPARGNE_GERER','EPARGNE_BONUS_VERSER',
    'VIREMENTS_VOIR','VIREMENTS_VALIDER','VIREMENTS_REJETER',
    'RAPPORTS_VOIR','RAPPORTS_EXPORTER',
    'CONFIG_VOIR','CONFIG_MODIFIER',
    'ADMINS_VOIR','ADMINS_AJOUTER','ADMINS_MODIFIER','ADMINS_SUPPRIMER',
    'AUDIT_VOIR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Vider les permissions des users existants (reset obligatoire apres migration)
UPDATE users SET permissions = '{}' WHERE role NOT IN ('SUPER_ADMIN', 'CLIENT');

-- NOTE : apres cette migration, re-assigner les permissions via l'interface SuperAdmin
