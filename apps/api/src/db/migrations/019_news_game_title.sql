-- Add primary game title extracted by AI curation, used for game-specific filtering
ALTER TABLE general_news ADD COLUMN IF NOT EXISTS ai_game_title TEXT;
