import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import styles from './App.module.css'
import { MassProvider } from './context/MassContext'
import Dashboard from './pages/Dashboard'
import LogEntry from './pages/LogEntry'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'

const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/log': 'New log',
  '/onboarding': 'Onboarding',
  '/settings': 'Settings',
}

const Layout = () => {
  const location = useLocation()
  const title = routeTitles[location.pathname] ?? 'Dashboard'

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.brandGroup}>
          <span className={styles.brand}>MASS</span>
          <span className={styles.routeTitle}>{title}</span>
        </div>
        <Link to="/settings" className={styles.settingsLink}>
          Settings
        </Link>
      </header>

      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>

      <nav className={styles.nav} aria-label="Primary navigation">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            [
              styles.navLink,
              styles.navLinkDashboard,
              isActive ? styles.navLinkActive : '',
            ]
              .join(' ')
              .trim()
          }
        >
          <span className={styles.navLabel}>Dashboard</span>
        </NavLink>
        <NavLink
          to="/log"
          className={({ isActive }) =>
            [styles.navLink, styles.navLinkLog, isActive ? styles.navLinkActive : '']
              .join(' ')
              .trim()
          }
        >
          <span className={styles.navLabel}>Log</span>
        </NavLink>
        <NavLink
          to="/onboarding"
          className={({ isActive }) =>
            [
              styles.navLink,
              styles.navLinkProfile,
              isActive ? styles.navLinkActive : '',
            ]
              .join(' ')
              .trim()
          }
        >
          <span className={styles.navLabel}>Profile</span>
        </NavLink>
      </nav>
    </div>
  )
}

function App() {
  return (
    <MassProvider>
      <div className={styles.appShell}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/log" element={<LogEntry />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </MassProvider>
  )
}

export default App
