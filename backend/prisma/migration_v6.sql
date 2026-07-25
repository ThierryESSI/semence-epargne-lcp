-- Migration V5 → V6 : ajout RIB + table Virements
-- À exécuter si vous avez déjà une DB v5 en production

-- 1. Ajouter le champ RIB sur la table comptes (si inexistant)
ALTER TABLE comptes ADD COLUMN IF NOT EXISTS rib VARCHAR(20) UNIQUE;

-- 2. Générer des RIB pour les comptes existants (format LCP-CI-XXXXXXXXXX)
UPDATE comptes SET rib = 'LCP-CI-' || UPPER(SUBSTRING(MD5(id::text), 1, 10))
WHERE rib IS NULL;

-- 3. Rendre le champ NOT NULL après population
ALTER TABLE comptes ALTER COLUMN rib SET NOT NULL;

-- 4. Ajouter VIREMENT_LCP dans l'enum TypeTransaction
ALTER TYPE "TypeTransaction" ADD VALUE IF NOT EXISTS 'VIREMENT_LCP';

-- 5. Créer l'enum StatutVirement
DO $$ BEGIN
  CREATE TYPE "StatutVirement" AS ENUM ('EN_ATTENTE','VALIDE','REJETE','ANNULE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Créer la table virements
CREATE TABLE IF NOT EXISTS virements (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reference        TEXT UNIQUE NOT NULL,
  "compteSourceId" TEXT NOT NULL REFERENCES comptes(id),
  "compteDestId"   TEXT NOT NULL REFERENCES comptes(id),
  montant          DECIMAL(15,2) NOT NULL,
  motif            TEXT,
  statut           "StatutVirement" DEFAULT 'EN_ATTENTE',
  "codeConfirm"    TEXT,
  "codeExpireAt"   TIMESTAMP,
  "traiteLe"       TIMESTAMP,
  "createdAt"      TIMESTAMP DEFAULT NOW(),
  "updatedAt"      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_virements_source ON virements("compteSourceId");
CREATE INDEX IF NOT EXISTS idx_virements_dest   ON virements("compteDestId");
CREATE INDEX IF NOT EXISTS idx_virements_statut ON virements(statut);

-- 7. Index sur rib
CREATE INDEX IF NOT EXISTS idx_comptes_rib ON comptes(rib);
