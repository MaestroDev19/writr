import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/query-client"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { SettingsProvider } from "@/contexts/settings-context"
import { CorpusProvider } from "@/contexts/corpus-context"
import { ProtectedRoute, PublicOnlyRoute } from "@/components/protected-route"
import { NavigationHeader } from "@/components/app-nav"

import LoginPage from "@/pages/LoginPage"
import SignupPage from "@/pages/SignupPage"
import ForgotPasswordPage from "@/pages/ForgotPasswordPage"
import DashboardPage from "@/pages/DashboardPage"
import GeneratePage from "@/pages/GeneratePage"
import CritiquePage from "@/pages/CritiquePage"
import SettingsPage from "@/pages/SettingsPage"
import NotFoundPage from "@/pages/NotFoundPage"

function AppContent() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {isAuthenticated ? <NavigationHeader /> : null}
      <main className="pb-[env(safe-area-inset-bottom)]">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/generate"
            element={
              <ProtectedRoute>
                <GeneratePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/critique"
            element={
              <ProtectedRoute>
                <CritiquePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ingestion"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard#notes" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <CorpusProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </CorpusProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
