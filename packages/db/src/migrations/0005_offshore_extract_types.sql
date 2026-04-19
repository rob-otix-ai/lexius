-- Offshore CIMA Wave 2 (PRD-012 / ARD-016 / DDD-015)
-- Adds extract types for Cayman Islands dollar fines and imprisonment terms.

ALTER TYPE extract_type ADD VALUE IF NOT EXISTS 'fine_amount_kyd';
--> statement-breakpoint
ALTER TYPE extract_type ADD VALUE IF NOT EXISTS 'imprisonment_term';
