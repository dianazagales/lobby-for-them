-- Add pre-generated advocacy email body column to featured_bills.
-- The greeting and sign-off are added dynamically in the UI;
-- this field stores only the body paragraphs.
ALTER TABLE featured_bills ADD COLUMN IF NOT EXISTS email_template text;
