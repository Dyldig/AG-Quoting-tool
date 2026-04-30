-- Add valid_until column: auto-set to created_at + 60 days via trigger

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ;

-- Backfill existing rows
UPDATE quotes
  SET valid_until = created_at + INTERVAL '60 days'
  WHERE valid_until IS NULL;

-- Trigger function: set valid_until on INSERT if not provided
CREATE OR REPLACE FUNCTION set_quote_valid_until()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.valid_until IS NULL THEN
    NEW.valid_until := NEW.created_at + INTERVAL '60 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_set_valid_until
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_valid_until();
