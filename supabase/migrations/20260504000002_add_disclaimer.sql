-- Add disclaimer acknowledgement columns to quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS disclaimer_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disclaimer_acknowledged_at TIMESTAMPTZ;
