-- Extensions nécessaires à la recherche de cartes (phase 1) :
-- pg_trgm pour la recherche floue, unaccent pour ignorer les accents.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;
