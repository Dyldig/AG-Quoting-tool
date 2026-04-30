-- Add quote_name column to quotes table
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_name TEXT,
  ADD CONSTRAINT quotes_quote_name_length CHECK (quote_name IS NULL OR char_length(quote_name) <= 120);

-- Update schema.sql is not required — this migration is the source of truth for the new column
