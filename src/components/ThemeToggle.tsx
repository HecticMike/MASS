import styles from './ThemeToggle.module.css'
import { useTheme } from '../context/ThemeContext'

const Sun = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
    <circle cx="12" cy="12" r="5" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="1.5" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22.5" />
      <line x1="4" y1="12" x2="1.5" y2="12" />
      <line x1="22.5" y1="12" x2="20" y2="12" />
      <line x1="5.6" y1="5.6" x2="3.9" y2="3.9" />
      <line x1="20.1" y1="20.1" x2="18.4" y2="18.4" />
      <line x1="5.6" y1="18.4" x2="3.9" y2="20.1" />
      <line x1="20.1" y1="3.9" x2="18.4" y2="5.6" />
    </g>
  </svg>
)

const Moon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
    <path
      d="M20.5 14.5a8.5 8.5 0 01-10.3-10.3 0.5 0.5 0 00-.7-0.6 9.5 9.5 0 1011.6 11.6 0.5 0.5 0 00-.6-0.7z"
      fill="currentColor"
    />
  </svg>
)

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <span className={styles.icons}>
        <Sun className={`${styles.icon} ${isDark ? styles.iconInactive : ''}`} />
        <Moon className={`${styles.icon} ${isDark ? '' : styles.iconInactive}`} />
      </span>
      <span className={`${styles.track} ${isDark ? styles.trackDark : ''}`}>
        <span className={`${styles.thumb} ${isDark ? styles.thumbDark : ''}`} />
      </span>
      <span className={styles.text}>{isDark ? 'Dark' : 'Light'} mode</span>
    </button>
  )
}

export default ThemeToggle
