import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import { useNavigate } from 'react-router-dom';
import { logout, deleteAccount } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getUserStats, getFollowersList, getFollowingList } from '../../services/userService';
import { unfollowArtist } from '../../services/interactionService';
import FollowersModal from '../../components/Modals/FollowersModal';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import ReauthModal from '../../components/Modals/ReauthModal';
import FullScreenLoader from '../../components/Common/FullScreenLoader';
import { toast } from 'react-toastify';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthProvider, setReauthProvider] = useState<'password' | 'google'>('password');
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, artworks: 0 });
  const [followersModal, setFollowersModal] = useState<{
    isOpen: boolean;
    type: 'followers' | 'following';
    users: Array<{ uid: string; name: string; username?: string; avatar?: string }>;
    isLoading: boolean;
  }>({ isOpen: false, type: 'followers', users: [], isLoading: false });

  // Load user stats
  useEffect(() => {
    const loadStats = async () => {
      if (!appUser?.uid) return;
      try {
        const userStats = await getUserStats(appUser.uid);
        setStats(userStats);
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };
    loadStats();
  }, [appUser?.uid]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSendMessage = async () => {
    if (!supportMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setIsSendingMessage(true);
    try {
      // Call Firebase Cloud Function to send email
      const sendSupportEmail = httpsCallable(functions, 'sendSupportEmail');
      
      const emailData = {
        message: supportMessage,
        userName: appUser?.name || 'Anonymous User',
        userEmail: appUser?.email || 'anonymous@example.com',
        subject: `Support/Suggestion from ${appUser?.name || 'User'}`
      };

      console.log('Sending email via Cloud Function:', emailData);

      const result = await sendSupportEmail(emailData);
      const data = result.data as { success: boolean; message: string };
      
      if (data.success) {
        setMessageSent(true);
        setSupportMessage('');
        toast.success('Message sent successfully! We\'ll get back to you soon.', {
          position: 'top-center',
          autoClose: 3000,
        });
        setTimeout(() => setMessageSent(false), 3000);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.message || 'Failed to send message. Please try again.', {
        position: 'top-center',
        autoClose: 4000,
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteReason.trim()) {
      toast.error('Please provide a reason for deleting your account');
      return;
    }

    // Show confirmation modal
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setShowDeleteModal(false);
    
    try {
      // Send deletion feedback email to team
      const sendSupportEmail = httpsCallable(functions, 'sendSupportEmail');
      
      const deletionEmailData = {
        message: `User Deletion Request:\n\n${deleteReason}\n\nUser Details:\n- Name: ${appUser?.name || 'N/A'}\n- Email: ${appUser?.email || 'N/A'}\n- Role: ${appUser?.role || 'N/A'}\n- User ID: ${appUser?.uid || 'N/A'}`,
        userName: appUser?.name || 'User',
        userEmail: appUser?.email || 'anonymous@example.com',
        subject: `🚨 Account Deletion Request from ${appUser?.name || 'User'}`
      };

      // Send email notification (don't block on failure)
      try {
        await sendSupportEmail(deletionEmailData);
        console.log('Deletion feedback email sent successfully');
      } catch (emailError) {
        console.error('Failed to send deletion feedback email:', emailError);
        // Continue with deletion even if email fails
      }

      // Try to delete account first (will check if reauthentication is needed)
      if (appUser?.uid) {
        try {
          // First, check if we need reauthentication by attempting the operation
          await deleteAccount(appUser.uid);
          
          toast.success('Your account has been deleted.', {
            position: 'top-center',
            autoClose: 3000,
          });
          
          // Redirect to home page
          navigate('/');
        } catch (error: any) {
          console.log('Deletion error:', error);
          
          // Handle reauthentication requirement
          if (error.message === 'REQUIRES_REAUTH' || error.code === 'auth/requires-recent-login') {
            // Show reauth modal based on provider
            const provider = error.provider || appUser.provider;
            setReauthProvider(provider === 'google' ? 'google' : 'password');
            setShowReauthModal(true);
            setIsDeletingAccount(false); // Allow user to interact with modal
          } else if (error.message === 'NEEDS_PASSWORD') {
            // Password required but not provided
            setReauthProvider('password');
            setShowReauthModal(true);
            setIsDeletingAccount(false);
          } else {
            // Other errors
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      toast.error(error.message || 'Failed to delete account. Please try again or contact support.', {
        position: 'top-center',
        autoClose: 4000,
      });
      setIsDeletingAccount(false);
    }
  };

  const handlePasswordReauth = async (password: string) => {
    if (!appUser?.uid) return;
    
    setIsReauthenticating(true);
    try {
      await deleteAccount(appUser.uid, password, true);
      
      toast.success('Your account has been deleted.', {
        position: 'top-center',
        autoClose: 2000,
      });
      
      setShowReauthModal(false);
      navigate('/');
    } catch (error: any) {
      console.error('Reauthentication failed:', error);
      toast.error(error.message || 'Incorrect password. Please try again.', {
        position: 'top-center',
        autoClose: 4000,
      });
    } finally {
      setIsReauthenticating(false);
    }
  };

  const handleGoogleReauth = async () => {
    if (!appUser?.uid) return;
    
    setIsReauthenticating(true);
    try {
      // Trigger Google popup DIRECTLY on user click to avoid popup blockers
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user is currently signed in');
      }
      
      const googleProvider = new GoogleAuthProvider();
      console.log('Triggering Google sign-in popup...');
      await reauthenticateWithPopup(user, googleProvider);
      console.log('Google reauthentication successful');
      
      // Now delete account with skipReauth flag since we just reauthenticated
      await deleteAccount(appUser.uid, undefined, true);
      
      toast.success('Your account has been deleted.', {
        position: 'top-center',
        autoClose: 2000,
      });
      
      setShowReauthModal(false);
      navigate('/');
    } catch (error: any) {
      console.error('Reauthentication failed:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast.info('Sign-in cancelled. Please try again.', {
          position: 'top-center',
          autoClose: 3000,
        });
      } else if (error.code === 'auth/cancelled-popup-request') {
        toast.info('Sign-in cancelled. Please try again.', {
          position: 'top-center',
          autoClose: 3000,
        });
      } else {
        toast.error(error.message || 'Failed to verify identity. Please try again.', {
          position: 'top-center',
          autoClose: 4000,
        });
      }
    } finally {
      setIsReauthenticating(false);
    }
  };

  const capitalizeName = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleFollowersClick = async () => {
    if (!appUser) return;
    setFollowersModal({ isOpen: true, type: 'followers', users: [], isLoading: true });
    try {
      const followers = await getFollowersList(appUser.uid);
      setFollowersModal({ isOpen: true, type: 'followers', users: followers, isLoading: false });
    } catch (error) {
      console.error('Error loading followers:', error);
      toast.error('Failed to load followers');
      setFollowersModal({ isOpen: false, type: 'followers', users: [], isLoading: false });
    }
  };

  const handleFollowingClick = async () => {
    if (!appUser) return;
    setFollowersModal({ isOpen: true, type: 'following', users: [], isLoading: true });
    try {
      const following = await getFollowingList(appUser.uid);
      setFollowersModal({ isOpen: true, type: 'following', users: following, isLoading: false });
    } catch (error) {
      console.error('Error loading following:', error);
      toast.error('Failed to load following');
      setFollowersModal({ isOpen: false, type: 'following', users: [], isLoading: false });
    }
  };

  const handleCloseFollowersModal = () => {
    setFollowersModal({ isOpen: false, type: 'followers', users: [], isLoading: false });
  };

  const handleRemoveFollower = async (followerId: string) => {
    if (!appUser) return;
    try {
      // Remove the follower by unfollowing from their side
      await unfollowArtist(followerId, appUser.uid);
      toast.success('Follower removed');
      
      // Refresh the followers list
      const updatedFollowers = await getFollowersList(appUser.uid);
      setFollowersModal(prev => ({ ...prev, users: updatedFollowers }));
      
      // Refresh stats
      const userStats = await getUserStats(appUser.uid);
      setStats(userStats);
    } catch (error) {
      console.error('Error removing follower:', error);
      toast.error('Failed to remove follower');
    }
  };

  const handleUnfollow = async (artistId: string) => {
    if (!appUser) return;
    try {
      await unfollowArtist(appUser.uid, artistId);
      toast.success('Unfollowed successfully');
      
      // Refresh the following list
      const updatedFollowing = await getFollowingList(appUser.uid);
      setFollowersModal(prev => ({ ...prev, users: updatedFollowing }));
      
      // Refresh stats
      const userStats = await getUserStats(appUser.uid);
      setStats(userStats);
    } catch (error) {
      console.error('Error unfollowing user:', error);
      toast.error('Failed to unfollow');
    }
  };

  return (
    <div>
      <style>{`
        @media (min-width: 481px) and (max-width: 768px) {
          .profile-header-mobile {
            padding: 1rem !important;
            gap: 0.75rem !important;
          }
          .profile-image-mobile {
            width: 60px !important;
            height: 60px !important;
            border-width: 2px !important;
          }
          .profile-name-mobile {
            font-size: 1.1rem !important;
            margin-bottom: 0.2rem !important;
          }
          .profile-email-mobile {
            font-size: 0.85rem !important;
            margin-bottom: 0.4rem !important;
          }
          .following-box-mobile {
            padding: 0.35rem 0.6rem !important;
            min-width: 65px !important;
          }
          .following-number-mobile {
            font-size: 1.1rem !important;
          }
          .following-label-mobile {
            font-size: 0.6rem !important;
            margin-top: 0.15rem !important;
            letter-spacing: 0.3px !important;
          }
          .profile-badge-mobile {
            padding: 0.3rem 0.6rem !important;
            font-size: 0.75rem !important;
          }
          .member-since-mobile {
            font-size: 0.7rem !important;
          }
        }
      `}</style>
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.profileHeader} className="profile-header-mobile">
            <div style={styles.profileImageContainer}>
              {appUser?.role === 'artist' ? (
                <img src={appUser.avatar || '/artist.png'} alt="Artist Profile" style={styles.profileImage} className="profile-image-mobile" />
              ) : (
                <img src="/man-with-hat.png" alt="Buyer Profile" style={styles.profileImage} className="profile-image-mobile" />
              )}
            </div>
            <div style={styles.profileInfo}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <h2 style={styles.name} className="profile-name-mobile">{appUser?.name ? capitalizeName(appUser.name) : 'User'}</h2>
                  <p style={styles.email} className="profile-email-mobile">{appUser?.email}</p>
                </div>
                
                {/* Following Stats */}
                {appUser?.role === 'artist' && (
                  <div 
                    onClick={handleFollowingClick}
                    className="following-box-mobile"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '0.5rem 1rem',
                      backgroundColor: 'rgba(47, 164, 169, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(47, 164, 169, 0.2)',
                      transition: 'all 0.2s ease',
                      minWidth: '90px',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(47, 164, 169, 0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(47, 164, 169, 0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span className="following-number-mobile" style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: 700, 
                      color: 'var(--color-teal, #0d9488)',
                      lineHeight: 1
                    }}>
                      {formatNumber(stats.following)}
                    </span>
                    <span className="following-label-mobile" style={{ 
                      fontSize: '0.7rem', 
                      color: 'var(--color-text-secondary)',
                      marginTop: '0.25rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontWeight: 600
                    }}>
                      Following
                    </span>
                  </div>
                )}
              </div>
              
              <div style={styles.badgeRow}>
                <span style={styles.roleBadge} className="profile-badge-mobile">
                  {appUser?.role === 'artist' ? '🎨 Artist' : '🎩 Art Lover'}
                </span>
                <span style={styles.memberSince} className="member-since-mobile">
                  since {(() => {
                    try {
                      if (!appUser?.createdAt) return 'N/A';
                      const date = appUser.createdAt instanceof Date ? appUser.createdAt : new Date(appUser.createdAt);
                      return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    } catch {
                      return 'N/A';
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Theme Toggle Section */}
          {/* <div style={styles.themeSection}>
            <div style={styles.themeToggleContainer}>
              <span style={styles.themeDescription}>
                {theme === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </span>
              <button
                onClick={toggleTheme}
                style={{
                  ...styles.themeToggleButton,
                  ...(hoveredButton === 'theme' ? {
                    background: 'var(--gradient-primary-hover)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 8px rgba(47, 164, 169, 0.3)',
                  } : {})
                }}
                onMouseEnter={() => setHoveredButton('theme')}
                onMouseLeave={() => setHoveredButton(null)}
              >
                Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
              </button>
            </div>
          </div> */}

          {/* Support & Suggestions Section */}
          <div style={styles.supportSection}>
            <div style={styles.supportHeader}>
              <span style={styles.supportLabel}>💬 Support & Suggestions</span>
            </div>
            <p style={styles.supportDescription}>
              Have feedback or need help? Send us a message and we'll get back to you at kalarang.team@gmail.com
            </p>
            <textarea
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              placeholder="Type your message here..."
              style={styles.messageTextarea}
              rows={4}
            />
            <button
              onClick={handleSendMessage}
              disabled={isSendingMessage || !supportMessage.trim()}
              style={{
                ...styles.sendButton,
                ...(hoveredButton === 'send' && supportMessage.trim() ? {
                  background: 'var(--gradient-primary-hover)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 8px rgba(47, 164, 169, 0.3)',
                } : {}),
                ...(isSendingMessage || !supportMessage.trim() ? {
                  opacity: 0.6,
                  cursor: 'not-allowed',
                } : {})
              }}
              onMouseEnter={() => setHoveredButton('send')}
              onMouseLeave={() => setHoveredButton(null)}
            >
              {isSendingMessage ? 'Sending...' : messageSent ? '✓ Sent!' : 'Send Message'}
            </button>
          </div>

          {/* Account Actions Section */}
          <div style={styles.accountActionsSection}>
            <div style={styles.supportHeader}>
              <span style={styles.supportLabel}> Account Actions</span>
            </div>

            {!showDeleteConfirm ? (
              <div style={styles.actionButtonsContainer}>
                <button
                  onClick={handleLogout}
                  style={{
                    ...styles.logoutButton,
                    ...(hoveredButton === 'logout' ? {
                      background: 'var(--gradient-primary-hover)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 8px rgba(47, 164, 169, 0.3)',
                    } : {})
                  }}
                  onMouseEnter={() => setHoveredButton('logout')}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  Logout
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    ...styles.deleteButton,
                    ...(hoveredButton === 'delete' ? {
                      backgroundColor: 'rgba(220, 38, 38, 0.1)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                    } : {})
                  }}
                  onMouseEnter={() => setHoveredButton('delete')}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  Delete Account
                </button>
              </div>
            ) : (
              <div style={styles.deleteConfirmContainer}>
                <p style={styles.supportDescription}>
                  We're sorry to see you go! Please help us improve by sharing why you're leaving (required):
                </p>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Your feedback helps us improve..."
                  style={styles.messageTextarea}
                  rows={3}
                />
                <div style={styles.actionButtonsContainer}>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || !deleteReason.trim()}
                    style={{
                      ...styles.confirmDeleteButton,
                      ...(isDeletingAccount || !deleteReason.trim() ? {
                        opacity: 0.6,
                        cursor: 'not-allowed',
                      } : {}),
                      ...(hoveredButton === 'confirmDelete' && deleteReason.trim() ? {
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                      } : {})
                    }}
                    onMouseEnter={() => setHoveredButton('confirmDelete')}
                    onMouseLeave={() => setHoveredButton(null)}
                  >
                    {isDeletingAccount ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteReason('');
                    }}
                    disabled={isDeletingAccount}
                    style={{
                      ...styles.cancelButton,
                      ...(hoveredButton === 'cancelDelete' ? {
                        background: 'var(--primary-alpha-10)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 2px 4px rgba(47, 164, 169, 0.2)',
                      } : {})
                    }}
                    onMouseEnter={() => setHoveredButton('cancelDelete')}
                    onMouseLeave={() => setHoveredButton(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    {/* Followers Modal */}
    <FollowersModal
      isOpen={followersModal.isOpen}
      onClose={handleCloseFollowersModal}
      type={followersModal.type}
      users={followersModal.users}
      isLoading={followersModal.isLoading}
      onRemoveFollower={handleRemoveFollower}
      onUnfollow={handleUnfollow}
    />

    {/* Delete Account Confirmation Modal */}
    <ConfirmModal
      isOpen={showDeleteModal}
      onClose={() => setShowDeleteModal(false)}
      onConfirm={confirmDeleteAccount}
      title="Delete Account"
      message="Are you sure? This action cannot be undone. Your account and all data will be permanently deleted."
      confirmText="Delete My Account"
      cancelText="Cancel"
      type="danger"
    />

    {/* Reauthentication Modal */}
    <ReauthModal
      isOpen={showReauthModal}
      onClose={() => {
        setShowReauthModal(false);
        setIsDeletingAccount(false);
      }}
      onPasswordSubmit={handlePasswordReauth}
      onGoogleSignIn={handleGoogleReauth}
      provider={reauthProvider}
      isLoading={isReauthenticating}
    />

    {/* Full Screen Loader for Account Deletion */}
    <FullScreenLoader
      isVisible={isDeletingAccount && !showReauthModal}
      message="Deleting your account... Please wait."
    />
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100%',
    padding: '1rem 1rem',
  },
  content: {
    maxWidth: '600px',
    margin: '0 auto',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
    padding: '1.5rem',
    backgroundColor: 'var(--color-bg-white)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow-sm)',
  },
  profileImageContainer: {
    flexShrink: 0,
  },
  profileImage: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    border: '3px solid var(--color-primary)',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--color-text-primary-light)',
    marginBottom: '0.3rem',
  },
  email: {
    fontSize: '0.95rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '0.6rem',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  memberSince: {
    fontSize: '0.8rem',
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
  },
  roleBadge: {
    display: 'inline-block',
    padding: '0.4rem 0.8rem',
    backgroundColor: 'rgba(47, 164, 169, 0.1)',
    color: 'var(--color-primary)',
    borderRadius: '16px',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  themeSection: {
    padding: '1.5rem',
    backgroundColor: 'var(--color-bg-white)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow-sm)',
    marginBottom: '1.5rem',
  },
  themeHeader: {
    marginBottom: '1rem',
  },
  themeLabel: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text-primary-light)',
  },
  themeToggleContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  themeDescription: {
    fontSize: '0.95rem',
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  themeToggleButton: {
    padding: '0.6rem 1.5rem',
    background: 'var(--gradient-primary)',
    color: 'var(--color-text-primary-dark)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(47, 164, 169, 0.2)',
    whiteSpace: 'nowrap' as const,
  },
  editButton: {
    padding: '0.4rem 1rem',
    background: 'var(--gradient-primary)',
    color: 'var(--color-text-primary-dark)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(47, 164, 169, 0.2)',
  },
  deleteIconButton: {
    padding: '0.4rem 0.4rem',
    backgroundColor: 'transparent',
    color: '#2fa5a3',
    border: '2px solid #3aaaa0',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginLeft: '0.5rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  saveButton: {
    padding: '0.5rem 1.2rem',
    background: 'var(--gradient-primary)',
    color: 'var(--color-text-primary-dark)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(47, 164, 169, 0.2)',
  },
  cancelButton: {
    padding: '0.5rem 1.2rem',
    backgroundColor: 'transparent',
    color: 'var(--color-primary)',
    border: '2px solid var(--color-primary)',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  supportSection: {
    padding: '1.5rem',
    backgroundColor: 'var(--color-bg-white)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow-sm)',
    marginTop: '1.5rem',
  },
  supportHeader: {
    marginBottom: '0.75rem',
  },
  supportLabel: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text-primary-light)',
  },
  supportDescription: {
    fontSize: '0.9rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '1rem',
    lineHeight: '1.5',
  },
  messageTextarea: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '0.95rem',
    border: '2px solid var(--color-border)',
    borderRadius: '8px',
    outline: 'none',
    color: 'var(--color-text-dark)',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    transition: 'all 0.2s ease',
    marginBottom: '1rem',
    minHeight: '100px',
  },
  sendButton: {
    padding: '0.5rem 1.5rem',
    background: 'var(--gradient-primary)',
    color: 'var(--color-text-primary-dark)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(47, 164, 169, 0.2)',
    width: '100%',
  },
  accountActionsSection: {
    padding: '1.5rem',
    backgroundColor: 'var(--color-bg-white)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow-sm)',
    marginTop: '1.5rem',
  },
  actionButtonsContainer: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  logoutButton: {
    flex: '1',
    minWidth: '150px',
    padding: '0.75rem 1.5rem',
    background: 'var(--gradient-primary)',
    color: 'var(--color-text-primary-dark)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 4px rgba(47, 164, 169, 0.2)',
  },
  deleteButton: {
    flex: '1',
    minWidth: '150px',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    color: '#dc2626',
    border: '2px solid #dc2626',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  deleteConfirmContainer: {
    marginTop: '1rem',
  },
  deleteWarning: {
    fontSize: '0.95rem',
    color: '#dc2626',
    fontWeight: 600,
    marginBottom: '1rem',
    padding: '0.75rem',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: '8px',
    borderLeft: '4px solid #dc2626',
  },
  confirmDeleteButton: {
    flex: '1',
    minWidth: '150px',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'transparent',
    color: '#dc2626',
    border: '2px solid #dc2626',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  section: {
    marginBottom: '2rem',
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(47, 164, 169, 0.1)',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--color-text-primary-light)',
    marginBottom: '1.5rem',
  },
  infoGrid: {
    display: 'grid',
    gap: '1.5rem',
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '1rem',
    borderBottom: '1px solid rgba(47, 164, 169, 0.1)',
  },
  infoLabel: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
  },
  infoValue: {
    fontSize: '1rem',
    color: 'var(--color-text-primary-light)',
  },
  comingSoon: {
    textAlign: 'center' as const,
    padding: '3rem 2rem',
    backgroundColor: 'rgba(47, 164, 169, 0.05)',
    borderRadius: '12px',
    border: '2px dashed rgba(47, 164, 169, 0.2)',
  },
  emoji: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '1rem',
  },
  comingSoonTitle: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--color-primary)',
    marginBottom: '0.5rem',
  },
  comingSoonText: {
    fontSize: '1rem',
    color: 'var(--color-text-secondary)',
  },
};

export default Profile;
