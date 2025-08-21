import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserStatusProvider } from '@/contexts/UserStatusContext';
import { EditorProvider } from '@/contexts/EditorContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SocketErrorBoundary } from '@/components/ErrorBoundary/SocketErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import Index from './pages/Index';
import Login from './pages/Login';
import Register from './pages/Register';
import Room from './components/Room';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketErrorBoundary maxRetries={5}>
          <UserStatusProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/room/:roomId"
                    element={
                      <ProtectedRoute>
                        <Room />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </UserStatusProvider>
        </SocketErrorBoundary>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
