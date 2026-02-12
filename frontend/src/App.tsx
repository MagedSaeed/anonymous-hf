import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Navbar from './components/Navbar/Navbar'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import HomePage from './pages/Home/HomePage'
import LoginPage from './pages/Login/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import CreateRepoPage from './pages/CreateRepo/CreateRepoPage'
import RepoDetailsPage from './pages/RepoDetails/RepoDetailsPage'
import GuidelinesPage from './pages/Guidelines/GuidelinesPage'
import SettingsPage from './pages/Settings/SettingsPage'
import PublicViewerPage from './pages/PublicViewer/PublicViewerPage'

function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Public anonymous viewer - no navbar, no auth */}
            <Route path="/a/:anonymousId/*" element={<PublicViewerPage />} />

            {/* App routes with navbar */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/app" element={<HomePage />} />
              <Route path="/app/login" element={<LoginPage />} />
              <Route path="/app/guidelines" element={<GuidelinesPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/app/dashboard" element={<DashboardPage />} />
                <Route path="/app/create" element={<CreateRepoPage />} />
                <Route path="/app/repos/:id" element={<RepoDetailsPage />} />
                <Route path="/app/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
