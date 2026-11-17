/**
 * Player layout — chromeless.
 *
 * Purpose: give the video player the whole viewport, as `player2.php` did.
 * Inputs:  route children via <Outlet>
 * Outputs: JSX
 * Deps:    react-router-dom
 *
 * The legacy player page had no header, footer or menu; it went fullscreen on
 * load and offered a single back link to the movie. That is preserved — the
 * back control belongs to the player itself, over the video.
 *
 * The viewport is claimed exactly, not merely filled to a minimum: `h-dvh` with
 * the overflow hidden means the film is the whole screen and the page never
 * scrolls behind the chrome. `dvh` rather than `vh` so a mobile browser's
 * retracting address bar does not leave a strip of the film off-screen.
 */
import { Outlet } from 'react-router-dom';

export function PlayerLayout() {
  return (
    <div className="h-dvh w-full overflow-hidden bg-black">
      <Outlet />
    </div>
  );
}

export default PlayerLayout;
