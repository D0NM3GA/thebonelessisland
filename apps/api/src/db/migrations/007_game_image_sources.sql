ALTER TABLE games
ADD COLUMN IF NOT EXISTS header_image_provider TEXT;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS header_image_checked_at TIMESTAMPTZ;
