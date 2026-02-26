import React from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  return (
    <nav style={styles.nav}>
      <div style={styles.container}>
        <Link to="/" style={styles.logo}>
          Kalarang
        </Link>
        <div style={styles.links}>
          <Link to="/upload" style={styles.link}>
            Upload
          </Link>
          <Link to="/login" style={styles.link}>
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    backgroundColor: 'var(--color-bg-dark)',
    padding: '1rem 2rem',
    borderBottom: '2px solid var(--color-bg-dark-surface)',
  },
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  logo: {
    color: 'var(--color-text-primary-dark)',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textDecoration: 'none',
    transition: 'color var(--transition-base)',
  },
  links: {
    display: 'flex',
    gap: '1.5rem',
  },
  link: {
    color: 'var(--color-text-primary-dark)',
    textDecoration: 'none',
    fontSize: '1rem',
    transition: 'color var(--transition-base)',
  },
};

export default Navbar;