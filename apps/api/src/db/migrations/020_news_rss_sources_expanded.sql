-- Expand default RSS sources and update description to list all available options
UPDATE server_settings
SET
  value = 'pcgamer,rockpapershotgun,eurogamer,kotaku,ign,polygon,vg247,pcgamesn,theverge,gamesradar',
  description = 'Comma-separated list of enabled RSS sources. Options: pcgamer, rockpapershotgun, eurogamer, kotaku, ign, polygon, vg247, pcgamesn, theverge, gamesradar.'
WHERE key = 'news_rss_sources' AND value = 'pcgamer,rockpapershotgun,eurogamer,kotaku';
