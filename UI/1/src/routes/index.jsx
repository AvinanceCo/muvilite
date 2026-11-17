/**
 * Route table.
 *
 * Purpose: map every URL to a page, lazily so a passenger downloads only the
 *          screen they opened.
 * Inputs:  none
 * Outputs: a route element tree
 * Deps:    react-router-dom, layouts, pages
 *
 * Legacy page -> route (MIGRATION.md §4 for the endpoints behind each):
 *   index.php          /
 *   page.php?id=       /page/:idOrSlug
 *   category.php?id=   /category/:id
 *   music_category.php /music-category/:id
 *   movie.php?id=      /movie/:id
 *   player2.php?id=    /player/:id
 *   sound.php?id=      /music/:id
 *   search.php         /search
 *   music.php          /musics
 *   poll.php           /poll
 *
 * Two routes have no legacy page behind them — the legacy portal had no games
 * (MIGRATION.md §9):
 *   (new)              /games       the games list
 *   (new)              /game/:id    one game, in the chromeless player layout
 *
 * The legacy `?id=` query parameter becomes a path parameter. Pages accept a
 * slug as well as an id because `GET /api/pages/:idOrSlug` resolves both.
 */
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout.jsx';
import PlayerLayout from '../layouts/PlayerLayout.jsx';
import { Loader } from '../components/ui/Feedback.jsx';

const Watchlist = lazy(() => import('../pages/Watchlist.jsx'));
const Home = lazy(() => import('../pages/Home.jsx'));
const PageView = lazy(() => import('../pages/PageView.jsx'));
const Category = lazy(() => import('../pages/Category.jsx'));
const MusicCategory = lazy(() => import('../pages/MusicCategory.jsx'));
const MovieDetail = lazy(() => import('../pages/MovieDetail.jsx'));
const MusicDetail = lazy(() => import('../pages/MusicDetail.jsx'));
const Player = lazy(() => import('../pages/Player.jsx'));
const Search = lazy(() => import('../pages/Search.jsx'));
const MusicSearch = lazy(() => import('../pages/MusicSearch.jsx'));
const Games = lazy(() => import('../pages/Games.jsx'));
const GamePlay = lazy(() => import('../pages/GamePlay.jsx'));
const Poll = lazy(() => import('../pages/Poll.jsx'));
const NotFound = lazy(() => import('../pages/NotFound.jsx'));

export function AppRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/page/:idOrSlug" element={<PageView />} />
          <Route path="/category/:id" element={<Category />} />
          <Route path="/music-category/:id" element={<MusicCategory />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="/music/:id" element={<MusicDetail />} />
          <Route path="/search" element={<Search />} />
          <Route path="/musics" element={<MusicSearch />} />
          <Route path="/games" element={<Games />} />
          <Route path="/poll" element={<Poll />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Fullscreen, no site chrome — as player2.php was. */}
        <Route element={<PlayerLayout />}>
          <Route path="/player/:id" element={<Player />} />
          {/* A game gets the same treatment as a film: the whole viewport. */}
          <Route path="/game/:id" element={<GamePlay />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
