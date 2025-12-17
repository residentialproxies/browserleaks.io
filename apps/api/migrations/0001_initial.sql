-- BrowserLeaks.io D1 Database Migration
-- Initial schema for Cloudflare D1 (SQLite-based)
-- Generated: 2024-12-09

-- ============================================
-- SCANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  ip TEXT,
  country TEXT,
  city TEXT,
  total_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'HIGH',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scans_visitor_id ON scans(visitor_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at);

-- ============================================
-- FINGERPRINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS fingerprints (
  id TEXT PRIMARY KEY,
  scan_id TEXT UNIQUE NOT NULL,
  canvas_hash TEXT,
  canvas_winding INTEGER,
  webgl_hash TEXT,
  webgl_vendor TEXT,
  webgl_renderer TEXT,
  audio_hash TEXT,
  audio_value REAL,
  font_hash TEXT,
  font_count INTEGER,
  fonts TEXT DEFAULT '[]',
  timezone TEXT,
  timezone_offset INTEGER,
  screen_width INTEGER,
  screen_height INTEGER,
  color_depth INTEGER,
  device_pixel_ratio REAL,
  platform TEXT,
  language TEXT,
  languages TEXT DEFAULT '[]',
  hardware_concurrency INTEGER,
  device_memory REAL,
  max_touch_points INTEGER,
  browser_engine TEXT,
  is_mobile INTEGER,
  is_chromium INTEGER,
  is_gecko INTEGER,
  is_webkit INTEGER,
  combined_hash TEXT,
  uniqueness_score REAL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fingerprints_combined_hash ON fingerprints(combined_hash);
CREATE INDEX IF NOT EXISTS idx_fingerprints_canvas_hash ON fingerprints(canvas_hash);
CREATE INDEX IF NOT EXISTS idx_fingerprints_webgl_hash ON fingerprints(webgl_hash);

-- ============================================
-- IP LEAKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ip_leaks (
  id TEXT PRIMARY KEY,
  scan_id TEXT UNIQUE NOT NULL,
  ip TEXT NOT NULL,
  version TEXT,
  country TEXT,
  country_code TEXT,
  city TEXT,
  region TEXT,
  timezone TEXT,
  latitude REAL,
  longitude REAL,
  asn_number INTEGER,
  asn_name TEXT,
  asn_organization TEXT,
  is_proxy INTEGER,
  is_vpn INTEGER,
  is_tor INTEGER,
  is_datacenter INTEGER,
  is_relay INTEGER,
  reputation_score INTEGER,
  is_blacklisted INTEGER,
  data_source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ip_leaks_ip ON ip_leaks(ip);

-- ============================================
-- DNS LEAKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dns_leaks (
  id TEXT PRIMARY KEY,
  scan_id TEXT UNIQUE NOT NULL,
  test_id TEXT NOT NULL,
  is_leak INTEGER NOT NULL,
  leak_type TEXT NOT NULL,
  servers TEXT DEFAULT '[]',
  server_count INTEGER DEFAULT 0,
  doh_enabled INTEGER,
  dot_enabled INTEGER,
  using_isp_dns INTEGER,
  risks TEXT DEFAULT '[]',
  recommendations TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

-- ============================================
-- WEBRTC LEAKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS webrtc_leaks (
  id TEXT PRIMARY KEY,
  scan_id TEXT UNIQUE NOT NULL,
  is_leak INTEGER NOT NULL,
  local_ips TEXT DEFAULT '[]',
  public_ip TEXT,
  ipv6 TEXT,
  local_ip_leak INTEGER,
  public_ip_leak INTEGER,
  mdns_leak INTEGER,
  ipv6_leak INTEGER,
  nat_type TEXT,
  risks TEXT DEFAULT '[]',
  recommendations TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

-- ============================================
-- PRIVACY SCORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS privacy_scores (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  total_score INTEGER NOT NULL,
  max_score INTEGER DEFAULT 100,
  risk_level TEXT NOT NULL,
  ip_privacy INTEGER DEFAULT 0,
  dns_privacy INTEGER DEFAULT 0,
  webrtc_privacy INTEGER DEFAULT 0,
  fingerprint_resistance INTEGER DEFAULT 0,
  browser_config INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_privacy_scores_visitor_id ON privacy_scores(visitor_id);
CREATE INDEX IF NOT EXISTS idx_privacy_scores_created_at ON privacy_scores(created_at);

-- ============================================
-- TELEMETRY EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS telemetry_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  visitor_id TEXT,
  session_id TEXT,
  data TEXT DEFAULT '{}',
  user_agent TEXT,
  ip TEXT,
  country TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_visitor_id ON telemetry_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at ON telemetry_events(created_at);

-- ============================================
-- SHARED FINGERPRINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shared_fingerprints (
  id TEXT PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  canvas_hash TEXT,
  webgl_hash TEXT,
  audio_hash TEXT,
  font_hash TEXT,
  seen_count INTEGER DEFAULT 1,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shared_fingerprints_hash ON shared_fingerprints(hash);
CREATE INDEX IF NOT EXISTS idx_shared_fingerprints_canvas_hash ON shared_fingerprints(canvas_hash);
CREATE INDEX IF NOT EXISTS idx_shared_fingerprints_webgl_hash ON shared_fingerprints(webgl_hash);

-- ============================================
-- SHARE LINKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  scan_data TEXT NOT NULL,
  expires_at TEXT,
  view_count INTEGER DEFAULT 0,
  max_views INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_links_code ON share_links(code);

-- ============================================
-- SCAN HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scan_history (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  scan_data TEXT NOT NULL,
  privacy_score INTEGER,
  risk_level TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_history_visitor_id ON scan_history(visitor_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at);
