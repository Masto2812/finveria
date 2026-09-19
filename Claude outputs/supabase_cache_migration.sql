-- ─────────────────────────────────────────────────────────────────────────────
-- Migration : Cache persistant pour les prix et données historiques
-- À exécuter dans Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table 1 : Cache des prix (API /api/prices) ────────────────────────────────
CREATE TABLE IF NOT EXISTS price_cache (
  cache_key   TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ           -- NULL = n'expire jamais (prix historiques)
);

-- Index pour le nettoyage automatique des entrées expirées
CREATE INDEX IF NOT EXISTS idx_price_cache_expires
  ON price_cache (expires_at)
  WHERE expires_at IS NOT NULL;

-- ── Table 2 : Cache des séries historiques (API /api/history) ─────────────────
CREATE TABLE IF NOT EXISTS hist_cache (
  cache_key   TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hist_cache_expires
  ON hist_cache (expires_at);

-- ── RLS : accès uniquement via service role (depuis les API routes) ───────────
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE hist_cache  ENABLE ROW LEVEL SECURITY;

-- Pas de policy nécessaire : le service role bypass RLS automatiquement.
-- Si tu utilises la clé anon depuis les routes, décommente ces policies :
-- CREATE POLICY "service_full_access" ON price_cache FOR ALL USING (true);
-- CREATE POLICY "service_full_access" ON hist_cache  FOR ALL USING (true);

-- ── Fonction de nettoyage des entrées expirées (optionnel) ────────────────────
-- Appeler via pg_cron ou manuellement : SELECT cleanup_expired_cache();
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM price_cache WHERE expires_at IS NOT NULL AND expires_at < NOW();
  DELETE FROM hist_cache  WHERE expires_at < NOW();
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VARIABLE D'ENVIRONNEMENT À AJOUTER dans .env.local :
--   SUPABASE_SERVICE_ROLE_KEY=sk_...   (Settings → API → service_role key)
-- ─────────────────────────────────────────────────────────────────────────────
