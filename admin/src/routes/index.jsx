/**
 * Route table.
 *
 * Purpose: map every URL to a screen, behind the session and permission guards.
 * Inputs:  none
 * Outputs: a route element tree
 * Deps:    react-router-dom, layouts, pages, components/auth/Guards
 *
 * Legacy view -> route. The legacy panel was a directory of PHP files under
 * `admin/3P1z05m4n4Gm3nt/views/`, addressed as `../movies/` (list) and
 * `../movies/form.php?id=` (create and edit). The mapping is:
 *
 *   views/<x>/index.php        /<x>
 *   views/<x>/form.php         /<x>/new  and  /<x>/:id
 *   views/categories/content   /categories/:id/movies
 *   views/pages/content        /pages/:id/blocks
 *   views/users/login.php      /login
 *   views/users/panel.php      /users
 *
 * Every screen is lazy: an operator with one permission should not download the
 * eleven sections they cannot open. `RequirePermission` wraps each route so a
 * hand-typed URL is refused the same way a hidden menu item would be — and the
 * server refuses it independently, which is the boundary that counts.
 */
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import { RequireAuth, RequirePermission } from '../components/auth/Guards.jsx';
import { Loader } from '../components/ui/Feedback.jsx';
import Login from '../pages/Login.jsx';

const Dashboard = lazy(() => import('../pages/Dashboard.jsx'));
const Profile = lazy(() => import('../pages/Profile.jsx'));
const NotFound = lazy(() => import('../pages/NotFound.jsx'));
const NoAccess = lazy(() =>
  import('../pages/NotFound.jsx').then((module) => ({ default: module.NoAccess })),
);

const ResourceListPage = lazy(() => import('../pages/resource/ResourceListPage.jsx'));
const ResourceFormPage = lazy(() => import('../pages/resource/ResourceFormPage.jsx'));

// Screens that do more than CRUD get their own modules.
const MovieList = lazy(() => import('../pages/movies/MovieList.jsx'));
const MovieForm = lazy(() => import('../pages/movies/MovieForm.jsx'));
const CastList = lazy(() => import('../pages/casts/CastList.jsx'));
const CastForm = lazy(() => import('../pages/casts/CastForm.jsx'));
const MusicList = lazy(() => import('../pages/musics/MusicList.jsx'));
const MusicForm = lazy(() => import('../pages/musics/MusicForm.jsx'));
const GameList = lazy(() => import('../pages/games/GameList.jsx'));
const GameForm = lazy(() => import('../pages/games/GameForm.jsx'));
const CategoryContent = lazy(() => import('../pages/categories/CategoryContent.jsx'));
const MusicCategoryContent = lazy(() => import('../pages/categories/MusicCategoryContent.jsx'));
const BannerList = lazy(() => import('../pages/banners/BannerList.jsx'));
const BannerForm = lazy(() => import('../pages/banners/BannerForm.jsx'));
const BannerCategoryContent = lazy(() => import('../pages/banners/BannerCategoryContent.jsx'));
const VideoAdList = lazy(() => import('../pages/ads/VideoAdList.jsx'));
const VideoAdForm = lazy(() => import('../pages/ads/VideoAdForm.jsx'));
const PlacementAdList = lazy(() => import('../pages/ads/PlacementAdList.jsx'));
const PlacementAdForm = lazy(() => import('../pages/ads/PlacementAdForm.jsx'));
const PageList = lazy(() => import('../pages/pages/PageList.jsx'));
const PageForm = lazy(() => import('../pages/pages/PageForm.jsx'));
const PageComposer = lazy(() => import('../pages/pages/PageComposer.jsx'));
const PollImport = lazy(() => import('../pages/polls/PollImport.jsx'));
const PlaceholderManager = lazy(() => import('../pages/placeholders/PlaceholderManager.jsx'));
const BrandingManager = lazy(() => import('../pages/branding/BrandingManager.jsx'));
const VideoSettings = lazy(() => import('../pages/settings/VideoSettings.jsx'));
const UserList = lazy(() => import('../pages/users/UserList.jsx'));
const UserForm = lazy(() => import('../pages/users/UserForm.jsx'));
const PermissionGroupList = lazy(() => import('../pages/permissions/PermissionGroupList.jsx'));
const PermissionGroupForm = lazy(() => import('../pages/permissions/PermissionGroupForm.jsx'));
const AccessPermissionForm = lazy(() => import('../pages/permissions/AccessPermissionForm.jsx'));

const WatchHistory = lazy(() => import('../pages/reports/WatchHistory.jsx'));
const ListenHistory = lazy(() => import('../pages/reports/ListenHistory.jsx'));
const AdsHistory = lazy(() => import('../pages/reports/AdsHistory.jsx'));
const WatchTrends = lazy(() => import('../pages/reports/WatchTrends.jsx'));
const PollHistory = lazy(() => import('../pages/reports/PollHistory.jsx'));
const PollSummary = lazy(() => import('../pages/reports/PollSummary.jsx'));
const UserLogs = lazy(() => import('../pages/reports/UserLogs.jsx'));

/**
 * A descriptor-driven resource's three routes.
 * Returned as an array so it can be spread into <Routes>, which only accepts
 * <Route> children — a component wrapper would break that.
 */
function resourceRoutes(key, permission) {
  return [
    <Route
      key={`${key}-list`}
      path={key}
      element={
        <RequirePermission page={permission}>
          <ResourceListPage descriptorKey={key} />
        </RequirePermission>
      }
    />,
    <Route
      key={`${key}-new`}
      path={`${key}/new`}
      element={
        <RequirePermission page={permission} action="edit">
          <ResourceFormPage descriptorKey={key} />
        </RequirePermission>
      }
    />,
    <Route
      key={`${key}-edit`}
      path={`${key}/:id`}
      element={
        <RequirePermission page={permission} action="edit">
          <ResourceFormPage descriptorKey={key} />
        </RequirePermission>
      }
    />,
  ];
}

/** Wraps an element in the permission it requires. */
const guard = (page, element, action = 'view') => (
  <RequirePermission page={page} action={action}>
    {element}
  </RequirePermission>
);

export function AppRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="no-access" element={<NoAccess />} />

          {/* -------------------------------------------------- content --- */}
          <Route path="movies" element={guard('movies', <MovieList />)} />
          <Route path="movies/new" element={guard('movies', <MovieForm />, 'edit')} />
          <Route path="movies/:id" element={guard('movies', <MovieForm />, 'edit')} />

          <Route path="casts" element={guard('casts', <CastList />)} />
          <Route path="casts/new" element={guard('casts', <CastForm />, 'edit')} />
          <Route path="casts/:id" element={guard('casts', <CastForm />, 'edit')} />

          <Route path="musics" element={guard('musics', <MusicList />)} />
          <Route path="musics/new" element={guard('musics', <MusicForm />, 'edit')} />
          <Route path="musics/:id" element={guard('musics', <MusicForm />, 'edit')} />

          {/* New section: the legacy application had no games. Its own pages
              rather than a descriptor, because creating a game is an upload. */}
          <Route path="games" element={guard('games', <GameList />)} />
          <Route path="games/new" element={guard('games', <GameForm />, 'edit')} />
          <Route path="games/:id" element={guard('games', <GameForm />, 'edit')} />

          {/* ------------------------------------------------ taxonomies --- */}
          {resourceRoutes('categories', 'categories')}
          <Route
            path="categories/:id/movies"
            element={guard('categories', <CategoryContent />)}
          />

          {resourceRoutes('music-categories', 'categories')}
          <Route
            path="music-categories/:id/musics"
            element={guard('categories', <MusicCategoryContent />)}
          />

          {resourceRoutes('genres', 'genres')}
          {/* The music taxonomy. Its own collection, but guarded by the same
              permission as film genres — no installation has to re-seed. */}
          {resourceRoutes('music-genres', 'genres')}
          {/* The game taxonomy — guarded by `games`, so the one grant covers
              both of the section's screens. */}
          {resourceRoutes('game-genres', 'games')}
          {resourceRoutes('age-ranges', 'age-ranges')}
          {resourceRoutes('countries', 'age-ranges')}

          {/* --------------------------------------------------- banners --- */}
          <Route path="banners" element={guard('banners', <BannerList />)} />
          <Route path="banners/new" element={guard('banners', <BannerForm />, 'edit')} />
          <Route path="banners/:id" element={guard('banners', <BannerForm />, 'edit')} />

          {resourceRoutes('banner-categories', 'banners')}
          <Route
            path="banner-categories/:id/banners"
            element={guard('banners', <BannerCategoryContent />)}
          />

          {/* ---------------------------------------------- advertising --- */}
          {/* New section: the legacy panel managed no ads. Pre-roll creatives
              were VAST files on disk and the two landing-page slots were
              hardcoded markup. */}
          <Route path="video-ads" element={guard('ads', <VideoAdList />)} />
          <Route path="video-ads/new" element={guard('ads', <VideoAdForm />, 'edit')} />
          <Route path="video-ads/:id" element={guard('ads', <VideoAdForm />, 'edit')} />

          <Route path="placement-ads" element={guard('ads', <PlacementAdList />)} />
          <Route path="placement-ads/new" element={guard('ads', <PlacementAdForm />, 'edit')} />
          <Route path="placement-ads/:id" element={guard('ads', <PlacementAdForm />, 'edit')} />

          {/* New section: one screen, not a list/form pair — the slots are a
              fixed set defined by the backend. The legacy fallbacks were theme
              files changed over FTP. */}
          <Route path="placeholders" element={guard('placeholders', <PlaceholderManager />)} />

          {/* New section, same shape as the placeholders screen: one page, no
              list/form split, because there is exactly one branding record per
              installation. The legacy footer logo was a theme file and the
              landing-page copy was a literal in index.php. */}
          <Route path="branding" element={guard('branding', <BrandingManager />)} />

          {/* New: installation-wide switches. One screen per group of settings;
              today only video — whether uploads are transcoded to HLS. */}
          <Route path="settings/video" element={guard('settings', <VideoSettings />)} />

          {/* ------------------------------------------ pages and blocks --- */}
          <Route path="pages" element={guard('pages', <PageList />)} />
          <Route path="pages/new" element={guard('pages', <PageForm />, 'edit')} />
          <Route path="pages/:id" element={guard('pages', <PageForm />, 'edit')} />
          <Route path="pages/:id/blocks" element={guard('pages', <PageComposer />)} />

          {resourceRoutes('polls', 'pages')}
          {/* Static segment, so it outranks `polls/:id` whatever the order. */}
          <Route path="polls/import" element={guard('pages', <PollImport />, 'edit')} />

          {/* ----------------------------------------- users and access --- */}
          <Route path="users" element={guard('users', <UserList />)} />
          <Route path="users/new" element={guard('users', <UserForm />, 'edit')} />
          <Route path="users/:id" element={guard('users', <UserForm />, 'edit')} />

          {resourceRoutes('user-categories', 'users')}

          <Route path="permission-groups" element={guard('groups', <PermissionGroupList />)} />
          <Route
            path="permission-groups/new"
            element={guard('groups', <PermissionGroupForm />, 'edit')}
          />
          <Route
            path="permission-groups/:id"
            element={guard('groups', <PermissionGroupForm />, 'edit')}
          />

          <Route
            path="access-permissions"
            element={guard('groups', <ResourceListPage descriptorKey="access-permissions" />)}
          />
          <Route
            path="access-permissions/new"
            element={guard('groups', <AccessPermissionForm />, 'edit')}
          />
          <Route
            path="access-permissions/:id"
            element={guard('groups', <AccessPermissionForm />, 'edit')}
          />

          {/* --------------------------------------------------- reports --- */}
          <Route path="watch-history" element={guard('watch-history', <WatchHistory />)} />
          <Route path="listen-history" element={guard('watch-history', <ListenHistory />)} />
          <Route path="ads-history" element={guard('watch-history', <AdsHistory />)} />
          <Route path="watch-trends" element={guard('watch-history', <WatchTrends />)} />
          <Route path="poll-history" element={guard('pages', <PollHistory />)} />
          <Route path="poll-summary" element={guard('pages', <PollSummary />)} />
          <Route path="user-logs" element={guard('user-logs', <UserLogs />)} />

          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
