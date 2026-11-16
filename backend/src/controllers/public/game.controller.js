/**
 * Public game controllers.
 *
 * Purpose: parse validated requests, call the game service, and shape the
 *          standard response envelope.
 * Inputs:  Express req/res
 * Outputs: JSON responses
 * Deps:    services/game, utils/{apiResponse,asyncHandler}
 *
 * No legacy counterpart — see services/game.service.js.
 */
import {
  listGames,
  getGame,
  registerGameClick,
  listGameGenres,
} from '../../services/game.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import asyncHandler from '../../utils/asyncHandler.js';

/** GET /api/games — listing, search, genre filter and the "popular" tab. */
export const getGames = asyncHandler(async (req, res) => {
  const { items, meta } = await listGames(req.query);
  return sendSuccess(res, items, { meta });
});

/** GET /api/games/genres — the filter row. */
export const getGameGenres = asyncHandler(async (_req, res) =>
  sendSuccess(res, await listGameGenres()),
);

/** GET /api/games/:id — one game, for the play screen. */
export const getGameById = asyncHandler(async (req, res) =>
  sendSuccess(res, await getGame(req.params.id)),
);

/** POST /api/games/:id/click — counts one opening. */
export const postGameClick = asyncHandler(async (req, res) =>
  sendSuccess(res, await registerGameClick(req.params.id), { message: 'Counted' }),
);

export default { getGames, getGameGenres, getGameById, postGameClick };
