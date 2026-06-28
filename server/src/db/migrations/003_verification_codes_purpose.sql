ALTER TABLE IF EXISTS email_verification_codes RENAME TO verification_codes;

ALTER TABLE verification_codes
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'email_verify';
