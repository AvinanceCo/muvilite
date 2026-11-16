/**
 * Application root.
 *
 * Purpose: install the router, the server-state client, and a scroll reset.
 * Inputs:  none
 * Outputs: JSX
 * Deps:    react-router-dom, @tanstack/react-query, routes
 *
 * There is no auth context: the running legacy application has no end-user
 * login — no session_start() outside the admin folder, and the only public
 * write paths are the poll and the playback heartbeats (MIGRATION.md §7.1).
 * Server state is therefore the only shared state, and TanStack Query owns it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import AppRoutes from './routes/index.jsx';
import { PlaceholderProvider } from './context/PlaceholderContext.jsx';
import { BrandingProvider } from './context/BrandingContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The catalog changes when an administrator publishes, not minute to
      // minute, and the aircraft link is slow — so cache generously and do not
      // refetch merely because the passenger switched tabs.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      // A 404 is an answer, not a failure: retrying it wastes a slow link.
      retry: (failureCount, error) => !error?.isNotFound && failureCount < 2,
    },
  },
});

/** Sends the viewport back to the top on navigation, as a page load would. */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Inside the query client, since it reads the placeholder map through
          it; outside the router, since the map is the same on every page. */}
      <PlaceholderProvider>
        {/* Same placement and the same reasoning: read through the query client,
            and identical on every page, so it sits outside the router. */}
        <BrandingProvider>
          {/* Outside the router so a notice raised by a page survives the
              navigation that page may trigger, and above ScrollToTop so it is
              not moved by the scroll reset. */}
          <ToastProvider>
            <BrowserRouter>
              <ScrollToTop />
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </BrandingProvider>
      </PlaceholderProvider>
    </QueryClientProvider>
  );
}

export default App;
