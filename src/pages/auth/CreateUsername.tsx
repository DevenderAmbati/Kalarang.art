import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { MdPerson } from 'react-icons/md';
import './login.css';

const CreateUsername: React.FC = () => {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { appUser, firebaseUser, refreshUserProfile } = useAuth();
  const navigate = useNavigate();

  // Instagram username rules:
  // - Only lowercase letters, numbers, underscores, and periods
  // - Must be 6-18 characters
  // - Cannot start or end with a period
  // - Cannot have consecutive periods
  const validateUsername = (value: string): string | null => {
    if (value.length < 6) {
      return 'Username must be at least 6 characters';
    }
    if (value.length > 18) {
      return 'Username must be 18 characters or less';
    }
    if (!/^[a-z0-9._]+$/.test(value)) {
      return 'Username can only contain lowercase letters, numbers, periods, and underscores';
    }
    if (value.startsWith('.') || value.endsWith('.')) {
      return 'Username cannot start or end with a period';
    }
    if (value.includes('..')) {
      return 'Username cannot contain consecutive periods';
    }
    return null;
  };

  // Lightweight availability check used for auto-suggestions (no state side effects).
  const isUsernameAvailable = async (value: string): Promise<boolean> => {
    if (validateUsername(value)) return false;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', value.toLowerCase()));
    const snap = await getDocs(q);
    return snap.empty;
  };

  // Build candidate usernames from the user's display name.
  const buildCandidates = (rawName: string): string[] => {
    const base = rawName
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '');

    const clamp = (v: string) => v.slice(0, 18);
    const candidates = new Set<string>();

    if (base) {
      candidates.add(clamp(base));
      candidates.add(clamp(`${base}.art`));
      candidates.add(clamp(`${base}${Math.floor(10 + Math.random() * 89)}`));
      candidates.add(clamp(`${base}${Math.floor(100 + Math.random() * 899)}`));
    }
    // Always include a couple of generic fallbacks so we can show something.
    candidates.add(`artist${Math.floor(1000 + Math.random() * 8999)}`);
    candidates.add(`creator${Math.floor(1000 + Math.random() * 8999)}`);

    return Array.from(candidates).filter((c) => validateUsername(c) === null);
  };

  // Auto-suggest available usernames based on the display name.
  useEffect(() => {
    const rawName = appUser?.name || firebaseUser?.displayName || '';
    const candidates = buildCandidates(rawName);
    let cancelled = false;

    (async () => {
      const available: string[] = [];
      for (const candidate of candidates) {
        if (available.length >= 3) break;
        try {
          if (await isUsernameAvailable(candidate)) {
            available.push(candidate);
          }
        } catch {
          // Ignore individual lookup failures for suggestions.
        }
      }
      if (!cancelled) setSuggestions(available);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.name, firebaseUser?.displayName]);

  const applySuggestion = (value: string) => {
    setUsername(value);
    setError('');
    setIsAvailable(null);
    checkUsernameAvailability(value);
  };

  const checkUsernameAvailability = async (value: string) => {
    if (!value) {
      setIsAvailable(null);
      return;
    }

    const validationError = validateUsername(value);
    if (validationError) {
      setError(validationError);
      setIsAvailable(false);
      return;
    }

    setIsChecking(true);
    setError('');

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', value.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setIsAvailable(true);
        setError('');
      } else {
        setIsAvailable(false);
        setError('This username is already taken');
      }
    } catch (err) {
      setError('Failed to check username availability');
      setIsAvailable(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setUsername(value);
    
    // Reset availability check
    setIsAvailable(null);
    setError('');

    // If empty, don't validate or check availability
    if (!value || value.trim() === '') {
      return;
    }

    // Immediate validation
    const validationError = validateUsername(value);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Debounce the availability check
    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appUser) {
      toast.error('User not authenticated');
      return;
    }

    if (!username.trim() || !isAvailable) {
      toast.error('Please choose an available username');
      return;
    }

    setIsSubmitting(true);

    try {
      // Update user document with username
      const userRef = doc(db, 'users', appUser.uid);
      await updateDoc(userRef, {
        username: username.toLowerCase(),
        updatedAt: serverTimestamp(),
      });
      
      // Refresh user profile to get updated data
      await refreshUserProfile();
      
      setIsSubmitting(false);
      navigate('/home', { replace: true });
    } catch (err) {
      toast.error('Failed to create username. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-right-section" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', position: 'relative' }}>
      {/* Decorative geometric background shapes */}
      <div className="login-bg-shape-1"></div>
      <div className="login-bg-shape-2"></div>
      <div className="login-bg-shape-3"></div>
      <div className="login-bg-shape-4"></div>
      <div className="login-bg-shape-5"></div>
      <div className="login-bg-circle-1"></div>
      <div className="login-bg-circle-2"></div>
      <div className="login-bg-dot-pattern"></div>
      
      {/* Username Creation Form Section */}
      <div style={{ maxWidth: '500px', width: '100%', zIndex: 10 }}>
        
        {/* Mobile Header - visible only on mobile */}
        <div className="login-mobile-header">
          <div className="login-brand-stack login-mobile-logo">
            <img src="/logobong.png" alt="BrushOwl Logo" className="login-brand-icon" />
            <div className="login-brand-text-stack">
              <img src="/text logo.png" alt="BrushOwl" className="login-brand-text" />
            </div>
          </div>
          <h1 className="login-mobile-headline">Get your paintings customized</h1>
          <p className="login-mobile-subtext">Discover and share original art with the world.</p>
        </div>

        <div className="login-form-container">
          <div className="login-header">
            <div className="login-welcome-back">One last step</div>
            <h2 className="login-title">Choose your artist username</h2>
            <p className="login-subtitle">
              Your username is your public identity on BrushOwl and will be used in your profile URL
              (e.g. <strong>@johnart</strong>). You can change it later in Profile Settings.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-input-group">
              <div className="login-input-wrapper">
                {MdPerson({ className: "login-input-svg-icon", size: 20 })}
                <input
                  type="text"
                  value={username}
                  onChange={handleUsernameChange}
                  className="login-input"
                  disabled={isSubmitting}
                  autoFocus
                  required
                  style={{
                    borderColor: 
                      isAvailable === true ? '#10b981' : 
                      isAvailable === false || error ? '#ef4444' : 
                      undefined,
                  }}
                />
                <label className={`login-floating-label ${username ? 'login-floating-label-active' : ''}`}>
                  Username
                </label>
                {isChecking && (
                  <span style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#666',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}>
                    Checking...
                  </span>
                )}
                {isAvailable === true && !isChecking && (
                  <span style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#10b981',
                    fontSize: '1.2rem',
                  }}>
                    ✓
                  </span>
                )}
                {isAvailable === false && !isChecking && (
                  <span style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#ef4444',
                    fontSize: '1.2rem',
                  }}>
                    ✗
                  </span>
                )}
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="username-suggestions">
                <span className="username-suggestions-label">Suggestions</span>
                <div className="username-suggestions-list">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="username-suggestion-chip"
                      onClick={() => applySuggestion(s)}
                      disabled={isSubmitting}
                    >
                      @{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                animation: 'slideIn 0.3s ease-out'
              }}>
                {error}
              </div>
            )}

            {isAvailable && !error && (
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                color: '#059669',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                animation: 'slideIn 0.3s ease-out'
              }}>
                ✓ Username is available!
              </div>
            )}

            <style>{`
              @keyframes slideIn {
                from {
                  opacity: 0;
                  transform: translateY(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
            `}</style>

            <div style={{ 
              fontSize: '0.875rem', 
              color: 'var(--color-text-secondary)', 
              background: 'rgba(0, 0, 0, 0.02)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '1px solid rgba(0, 0, 0, 0.05)'
            }}>
              <p style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--color-text)' }}>
                Username Requirements:
              </p>
              <ul style={{ 
                marginLeft: '1.25rem', 
                lineHeight: '1.8',
                listStyleType: 'disc'
              }}>
                <li>6-18 characters long</li>
                <li>Only lowercase letters, numbers, periods (.), and underscores (_)</li>
                <li>Cannot start or end with a period</li>
                <li>No consecutive periods</li>
              </ul>
            </div>

            <button 
              type="submit" 
              className="login-button primary-cta" 
              disabled={!isAvailable || isSubmitting || isChecking || !username.trim()}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                {isSubmitting ? 'Creating Username...' : 'Continue to BrushOwl'} 
                {isSubmitting ? (
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}
                  >
                    <circle cx="12" cy="12" r="10" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
                  </svg>
                ) : '→'}
              </span>
            </button>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </form>
        </div>

        {/* Decorative corner elements */}
        <div className="login-corner-decor-1"></div>
        <div className="login-corner-decor-2"></div>
      </div>
    </div>
  );
};

export default CreateUsername;
