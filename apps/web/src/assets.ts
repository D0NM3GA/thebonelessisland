export const LOGO_BG_URL = "/boneless-island-logo.png";

export const GAME_NIGHTS_TILE_BG_URL =
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/header.jpg";

export const BONELESS_TOOLS_TILE_BG_URL =
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg";

export const GAME_NIGHT_BANNER_IMAGES = [
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1085660/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/582010/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/236390/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/252490/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172470/header.jpg",
  "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg"
] as const;

export function getGameNightBanner(gameNightId: number): string {
  return GAME_NIGHT_BANNER_IMAGES[gameNightId % GAME_NIGHT_BANNER_IMAGES.length];
}
