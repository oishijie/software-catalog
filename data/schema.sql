PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS category (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS software (
  id                 TEXT PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  summary            TEXT NOT NULL DEFAULT '',
  description        TEXT NOT NULL DEFAULT '',
  release_notes      TEXT NOT NULL DEFAULT '',
  usage_instructions TEXT NOT NULL DEFAULT '',
  faq                TEXT NOT NULL DEFAULT '',
  github_url         TEXT NOT NULL DEFAULT '',
  website_url        TEXT NOT NULL DEFAULT '',
  documentation_url  TEXT NOT NULL DEFAULT '',
  icon_url           TEXT NOT NULL DEFAULT '',
  icon_asset_id      TEXT NOT NULL DEFAULT '',
  category_id        TEXT REFERENCES category(id) ON DELETE SET NULL,
  platforms          TEXT NOT NULL DEFAULT '[]',
  recommended        INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'active',
  download_count     INTEGER NOT NULL DEFAULT 0,
  revision           INTEGER NOT NULL DEFAULT 1,
  source             TEXT NOT NULL DEFAULT 'manual',
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_software_category  ON software(category_id);
CREATE INDEX IF NOT EXISTS idx_software_updated   ON software(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_software_downloads ON software(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_software_status    ON software(status);

CREATE TABLE IF NOT EXISTS release (
  id                  TEXT PRIMARY KEY,
  software_id         TEXT NOT NULL REFERENCES software(id) ON DELETE CASCADE,
  version             TEXT NOT NULL DEFAULT '',
  channel             TEXT NOT NULL DEFAULT 'stable',
  platform            TEXT NOT NULL DEFAULT '',
  architecture        TEXT NOT NULL DEFAULT '',
  file_name           TEXT NOT NULL DEFAULT '',
  download_url        TEXT NOT NULL DEFAULT '',
  asset_id            TEXT NOT NULL DEFAULT '',
  size_bytes          INTEGER NOT NULL DEFAULT 0,
  sha256              TEXT NOT NULL DEFAULT '',
  mime                TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'active',
  revision            INTEGER NOT NULL DEFAULT 1,
  published_at        TEXT,
  created_at          TEXT NOT NULL,
  price_cents         INTEGER NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'CNY',
  sources             TEXT NOT NULL DEFAULT '[]',
  download_config_url TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_release_software ON release(software_id);
CREATE INDEX IF NOT EXISTS idx_release_platform ON release(software_id, platform);

CREATE TABLE IF NOT EXISTS site_profile (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  document       TEXT NOT NULL,
  revision       INTEGER NOT NULL DEFAULT 1,
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crawl_log (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
