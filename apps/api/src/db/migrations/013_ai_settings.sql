-- Add is_secret flag so getPublicSettings() can mask sensitive values
ALTER TABLE server_settings
ADD COLUMN IF NOT EXISTS is_secret BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed AI configuration rows
INSERT INTO server_settings (key, value, label, description, is_secret) VALUES
  (
    'ai_enabled',
    'false',
    'AI Features Enabled',
    'Master switch for all AI-powered features on the island. Requires a valid provider and API key to be set.',
    FALSE
  ),
  (
    'ai_provider',
    '',
    'AI Provider',
    'The LLM provider to use for AI features. Supported values: anthropic, openai.',
    FALSE
  ),
  (
    'ai_model',
    '',
    'AI Model',
    'Model name for the selected provider. Leave blank to use the provider default (claude-haiku-3-5 for Anthropic, gpt-4o-mini for OpenAI).',
    FALSE
  ),
  (
    'ai_api_key',
    '',
    'AI API Key',
    'API key for the selected provider. Stored securely and never exposed after saving. Leave blank to fall back to the ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable.',
    TRUE
  )
ON CONFLICT (key) DO NOTHING;
