-- Local site accounts are distinct from imported public Codeforces profiles.
BEGIN;
CREATE TABLE IF NOT EXISTS site_account (
 account_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 username TEXT NOT NULL CHECK(username ~ '^[a-z0-9_]{3,30}$') UNIQUE,
 display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 60),
 password_hash TEXT NOT NULL CHECK(password_hash LIKE '$argon2id$%'),
 role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 preferred_cf_handle TEXT CHECK(preferred_cf_handle IS NULL OR preferred_cf_handle ~ '^[a-zA-Z0-9_.-]{1,40}$'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_session (
 token_hash TEXT PRIMARY KEY CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 account_id BIGINT NOT NULL REFERENCES site_account(account_id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS auth_session_account_idx ON auth_session(account_id);
CREATE INDEX IF NOT EXISTS auth_session_expiry_idx ON auth_session(expires_at);
CREATE TABLE IF NOT EXISTS auth_throttle (
 key_hash TEXT PRIMARY KEY CHECK(key_hash ~ '^[0-9a-f]{64}$'),
 attempts INTEGER NOT NULL CHECK(attempts>0),
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_throttle_expiry_idx ON auth_throttle(expires_at);
CREATE TABLE IF NOT EXISTS problem_list (
 list_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 account_id BIGINT NOT NULL REFERENCES site_account(account_id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=500),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS problem_list_account_updated_idx ON problem_list(account_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS problem_list_item (
 list_id BIGINT NOT NULL REFERENCES problem_list(list_id) ON DELETE CASCADE,
 problem_id BIGINT NOT NULL REFERENCES problem(problem_id) ON DELETE RESTRICT,
 added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(list_id,problem_id)
);
COMMIT;
