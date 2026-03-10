-- Backbone v2: durable rooms, sessions, events, fraud controls.

CREATE TYPE room_status AS ENUM ('LOBBY', 'ACTIVE', 'ENDED', 'EXPIRED');
CREATE TYPE claim_type AS ENUM ('TOP_ROW', 'MIDDLE_ROW', 'BOTTOM_ROW', 'EARLY_FIVE', 'FULL_HOUSE');
CREATE TYPE claim_status AS ENUM ('PENDING', 'VALID', 'INVALID', 'DUPLICATE', 'REJECTED');
CREATE TYPE session_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE game_session_status AS ENUM ('RUNNING', 'PAUSED', 'ENDED');
CREATE TYPE fraud_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE enforcement_status AS ENUM ('OPEN', 'APPLIED', 'CLEARED', 'DISMISSED');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  display_name VARCHAR(60) NOT NULL,
  avatar_url TEXT,
  password_hash TEXT,
  provider VARCHAR(20) NOT NULL DEFAULT 'local',
  provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(128) NOT NULL UNIQUE,
  access_jti VARCHAR(64) NOT NULL UNIQUE,
  device_id VARCHAR(128) NOT NULL,
  ip_address VARCHAR(64),
  user_agent TEXT,
  status session_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  rotated_from_id UUID REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY,
  room_code CHAR(6) NOT NULL UNIQUE,
  host_id UUID NOT NULL REFERENCES users(id),
  status room_status NOT NULL DEFAULT 'LOBBY',
  max_players SMALLINT NOT NULL DEFAULT 50,
  call_interval SMALLINT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_rooms_status_created ON rooms(status, created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_host ON rooms(host_id);

CREATE TABLE IF NOT EXISTS room_players (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_room_players_room_active ON room_players(room_id, is_active);
CREATE INDEX IF NOT EXISTS idx_room_players_user ON room_players(user_id);

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  status game_session_status NOT NULL DEFAULT 'RUNNING',
  rng_seed VARCHAR(64) NOT NULL,
  call_interval SMALLINT NOT NULL,
  current_offset INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_status ON game_sessions(room_id, status);

CREATE TABLE IF NOT EXISTS game_events (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  game_session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  event_offset INTEGER NOT NULL,
  event_id VARCHAR(64) NOT NULL UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  UNIQUE (room_id, event_offset)
);
CREATE INDEX IF NOT EXISTS idx_game_events_room_time ON game_events(room_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_game_events_session_offset ON game_events(game_session_id, event_offset);

CREATE TABLE IF NOT EXISTS game_snapshots (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  game_session_id UUID REFERENCES game_sessions(id) ON DELETE SET NULL,
  event_offset INTEGER NOT NULL,
  game_state JSONB NOT NULL,
  called_numbers INTEGER[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_snapshots_room_offset ON game_snapshots(room_id, event_offset);

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_type claim_type NOT NULL,
  status claim_status NOT NULL DEFAULT 'PENDING',
  reason TEXT,
  event_offset INTEGER,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_nums_snapshot INTEGER[] NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_claims_room_claimtype ON claims(room_id, claim_type);
CREATE INDEX IF NOT EXISTS idx_claims_user_time ON claims(user_id, validated_at);

CREATE TABLE IF NOT EXISTS winners (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  claim_type claim_type NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  announced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, claim_type)
);
CREATE INDEX IF NOT EXISTS idx_winners_user_time ON winners(user_id, announced_at);

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  fingerprint_hash VARCHAR(128) NOT NULL,
  platform VARCHAR(32),
  app_version VARCHAR(32),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ip_address VARCHAR(64),
  UNIQUE (user_id, fingerprint_hash)
);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_hash ON device_fingerprints(fingerprint_hash);

CREATE TABLE IF NOT EXISTS fraud_events (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  severity fraud_severity NOT NULL DEFAULT 'LOW',
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fraud_events_room_time ON fraud_events(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fraud_events_user_time ON fraud_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS risk_scores (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  model_version VARCHAR(32) NOT NULL,
  reasons JSONB NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_scores_user_time ON risk_scores(user_id, measured_at);

CREATE TABLE IF NOT EXISTS enforcement_actions (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(64) NOT NULL,
  status enforcement_status NOT NULL DEFAULT 'OPEN',
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enforcement_actions_user_status ON enforcement_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_enforcement_actions_room_status ON enforcement_actions(room_id, status);
