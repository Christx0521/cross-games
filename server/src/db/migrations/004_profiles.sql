ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS description  VARCHAR(280);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code CHAR(2);

CREATE TABLE IF NOT EXISTS user_languages (
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  language_code CHAR(2) NOT NULL,
  PRIMARY KEY (user_id, language_code)
);
