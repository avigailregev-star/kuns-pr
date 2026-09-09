-- Additive migration only: preserves all registrations and existing fields.
BEGIN;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS ensemble_not_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS theory_not_required boolean NOT NULL DEFAULT false;
COMMIT;
