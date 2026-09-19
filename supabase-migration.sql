-- ─── Portfolio positions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_positions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom             TEXT        NOT NULL DEFAULT '',
  ticker          TEXT        NOT NULL DEFAULT '',
  categorie       TEXT        NOT NULL DEFAULT 'Actions',
  devise          TEXT        NOT NULL DEFAULT 'CHF',
  quantite        NUMERIC     NOT NULL DEFAULT 0,
  prix_achat      NUMERIC     NOT NULL DEFAULT 0,
  taux_achat_chf  NUMERIC     NOT NULL DEFAULT 1,
  date_achat      DATE        NOT NULL DEFAULT CURRENT_DATE,
  prix_actuel     NUMERIC     NOT NULL DEFAULT 0,
  taux_actuel_chf NUMERIC     NOT NULL DEFAULT 1,
  courtier        TEXT,
  derniere_maj    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE portfolio_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_positions" ON portfolio_positions;
CREATE POLICY "own_positions" ON portfolio_positions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Simulateur preferences ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simulateur_preferences (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode             TEXT DEFAULT 'prive',
  canton           TEXT DEFAULT 'ZH',
  situation        TEXT DEFAULT 'seul',
  revenu           TEXT DEFAULT '',
  dividendes_ch    TEXT DEFAULT '',
  dividendes_etr   TEXT DEFAULT '',
  transactions_ch  TEXT DEFAULT '',
  transactions_etr TEXT DEFAULT '',
  revenu_pro       TEXT DEFAULT '',
  gains_capitaux   TEXT DEFAULT '',
  pertes           TEXT DEFAULT '',
  frais            TEXT DEFAULT '',
  dividendes_ch_pro  TEXT DEFAULT '',
  dividendes_etr_pro TEXT DEFAULT '',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE simulateur_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_simulateur" ON simulateur_preferences;
CREATE POLICY "own_simulateur" ON simulateur_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Investor profile ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investor_profile (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  horizon    INTEGER     NOT NULL DEFAULT 10,
  loss       INTEGER     NOT NULL DEFAULT 25,
  liquidity  TEXT        NOT NULL DEFAULT 'moyenne',
  objective  TEXT        NOT NULL DEFAULT 'modéré',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE investor_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_profile" ON investor_profile;
CREATE POLICY "own_profile" ON investor_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
