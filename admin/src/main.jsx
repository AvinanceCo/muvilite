/**
 * Application entry point.
 *
 * Purpose: mount React with the providers every screen depends on.
 * Inputs:  none
 * Outputs: renders into #root
 * Deps:    react-dom, react-router-dom, @tanstack/react-query
 *
 * Provider order matters: AuthProvider calls `useQueryClient()` to clear cached
 * data on sign-out, so it must sit inside QueryClientProvider. The router wraps
 * both, because AuthProvider's redirect on 401 is a routing concern.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Admin data is edited by other administrators while a tab is open, so
      // a short staleness window keeps grids honest without a request per
      // render. Refetching on window focus is deliberate for the same reason.
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Retrying a 4xx just repeats a rejection. Only transient faults are
        // worth a second attempt.
        const status = error?.status ?? 0;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
