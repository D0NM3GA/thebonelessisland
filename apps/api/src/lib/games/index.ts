// Register all Nuggies game handlers in the engine's registry.
//
// Adding a new game later: write `<name>.ts` exporting a `GameHandler`,
// then add one `registerGame(handler)` line below.

import { registerGame } from "../nuggiesGames.js";
import { coinflipHandler } from "./coinflip.js";
import { guessNumberHandler } from "./guessnumber.js";
import { blackjackHandler } from "./blackjack.js";

let registered = false;

export function registerAllGames() {
  if (registered) return;
  registerGame(coinflipHandler as never);
  registerGame(guessNumberHandler as never);
  registerGame(blackjackHandler as never);
  registered = true;
}
