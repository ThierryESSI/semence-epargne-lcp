-- Migration V6 → V7 : nouveau systeme de permissions par module
-- A executer si vous avez deja une DB v6 en production

-- 1. Creer l'enum avec les nouvelles valeurs granulaires
DO $$ BEGIN
  CREATE TYPE "Permission_new" AS ENUM (
    'CLIENTS_VOIR','CLIENTS_DETAILS','CLIENTS_AJOUTER','CLIENTS_MODIFIER','CLIENTS_SUPPRIMER',
    'DISTRIBUTEURS_VOIR','DISTRIBUTEURS_DETAILS','DISTRIBUTEURS_AJOUTER','DISTRIBUTEURS_MODIFIER','DISTRIBUTEURS_SUPPRIMER',
    'CONSEILLERS_VOIR','CONSEILLERS_DETAILS','CONSEILLERS_AJOUTER','CONSEILLERS_MODIFIER','CONSEILLERS_SUPPRIMER',
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

-- 2. Transferer les valeurs existantes valides vers le nouveau type
-- Seules les valeurs communes entre ancien et nouveau sont transferees
DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN permissions TYPE "Permission_new"[]
    USING (
      SELECT ARRAY(
        SELECT val::text::"Permission_new"
        FROM unnest(permissions) AS val
        WHERE val::text IN (
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
        )
      )
    );
EXCEPTION WHEN OTHERS THEN
  -- Si le transfert echoue, vider les permissions (reset obligatoire)
  UPDATE users SET permissions = '{}' WHERE role NOT IN ('SUPER_ADMIN', 'CLIENT');
END $$;

-- 3. Supprimer l'ancien enum et renommer le nouveau
DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN permissions TYPE "Permission_new"[]
    USING permissions::text[]::"Permission_new"[];
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  DROP TYPE "Permission";
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TYPE "Permission_new" RENAME TO "Permission";

-- 4. Vider les permissions des users non-admin (reset apres migration)
UPDATE users SET permissions = '{}' WHERE role NOT IN ('SUPER_ADMIN', 'CLIENT');

-- NOTE : apres cette migration, re-assigner les permissions via l'interface SuperAdmin
