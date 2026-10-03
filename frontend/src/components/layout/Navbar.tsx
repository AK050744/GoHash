import { Link } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import styles from './Navbar.module.css'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.inner}`}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandIcon}>⬡</span>
          <span className={styles.brandName}>GoHash</span>
        </Link>

        <div className={styles.links}>
          <Link to="/verify" className={styles.navLink}>Verify</Link>

          {user ? (
            <>
              <Link to="/notarize" className={styles.navLink}>Notarize</Link>
              <Link to="/dashboard" className={styles.navLink}>Dashboard</Link>
              <button onClick={logout} className={`btn btn-secondary ${styles.logoutBtn}`}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login"    className={`btn btn-secondary`}>Login</Link>
              <Link to="/register" className={`btn btn-primary`}>Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
