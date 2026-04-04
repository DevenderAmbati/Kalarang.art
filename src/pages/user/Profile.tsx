import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import { useNavigate } from 'react-router-dom';
import { logout, deleteAccount } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getUserStats, getFollowersList, getFollowingList, updateUserProfile } from '../../services/userService';
import { unfollowArtist } from '../../services/interactionService';
import FollowersModal from '../../components/Modals/FollowersModal';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import ReauthModal from '../../components/Modals/ReauthModal';
import FullScreenLoader from '../../components/Common/FullScreenLoader';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { IoMdNotifications, IoMdChatbubbles } from 'react-icons/io';
import { MdInstallMobile } from 'react-icons/md';
import { toast } from 'react-toastify';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getBuyerOrders, BuyerOrder } from '../../services/chatService';
import { submitReview, getReviewsForBuyer, CommissionReview } from '../../services/reviewService';
import { createNotification } from '../../services/notificationService';
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
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<BuyerOrder | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewsByArtworkId, setReviewsByArtworkId] = useState<Record<string, CommissionReview>>({});
  const { canInstall, isInstalled, triggerInstall, isIos } = usePwaInstall();
  const { enabled: notifEnabled, loading: notifLoading, toggling: notifToggling, toggle: toggleNotif } = usePushNotifications();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [followersModal, setFollowersModal] = useState<{
    isOpen: boolean;
    type: 'followers' | 'following';
    users: Array<{ uid: string; name: string; username?: string; avatar?: string }>;
    isLoading: boolean;
  }>({ isOpen: false, type: 'followers', users: [], isLoading: false });

  // UPI ID state
  const [upiId, setUpiId] = useState(appUser?.upiId || '');
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [isSavingUpi, setIsSavingUpi] = useState(false);

  // Load user stats
  useEffect(() => {
    const loadStats = async () => {
      if (!appUser?.uid) return;
      try {
        const userStats = await getUserStats(appUser.uid);
        setStats(userStats);
      } catch (error) {
      }
    };
    loadStats();
  }, [appUser?.uid]);

  // Sync UPI ID from appUser
  useEffect(() => {
    if (appUser?.upiId !== undefined) {
      setUpiId(appUser.upiId);
    }
  }, [appUser?.upiId]);

  useEffect(() => {
    if (!ordersOpen || !appUser?.uid || appUser.role !== 'buyer') return;
    setOrdersLoading(true);
    Promise.all([
      getBuyerOrders(appUser.uid),
      getReviewsForBuyer(appUser.uid),
    ]).then(([fetchedOrders, reviews]) => {
      setOrders(fetchedOrders);
      const map: Record<string, CommissionReview> = {};
      reviews.forEach((r) => { map[r.commissionId] = r; });
      setReviewsByArtworkId(map);
    }).catch(() => {}).finally(() => setOrdersLoading(false));
  }, [ordersOpen, appUser?.uid, appUser?.role]);

  const handleSubmitReview = async () => {
    if (!appUser || !reviewOrder || reviewRating === 0 || !reviewText.trim()) return;
    setReviewSubmitting(true);
    try {
      const newReview: Omit<CommissionReview, 'id' | 'createdAt' | 'artistReply' | 'artistReplyAt'> = {
        commissionId: reviewOrder.artworkId,
        artistId: reviewOrder.artistId ?? '',
        buyerId: appUser.uid,
        buyerName: appUser.name,
        buyerAvatar: appUser.avatar,
        commissionTitle: reviewOrder.artworkTitle,
        reviewText: reviewText.trim(),
        rating: reviewRating,
      };
      await submitReview(newReview);
      if (reviewOrder.artistId) {
        createNotification(
          reviewOrder.artistId,
          'review_received',
          appUser.uid,
          appUser.name,
          appUser.avatar,
          reviewOrder.artworkId,
          reviewOrder.artworkTitle,
          reviewOrder.artworkImage,
          undefined,
          undefined,
          undefined,
          String(reviewRating),
        ).catch(() => {});
      }
      const optimistic: CommissionReview = {
        ...newReview,
        id: '',
        reviewText: reviewText.trim(),
        rating: reviewRating,
      };
      setReviewsByArtworkId((prev) => ({ ...prev, [reviewOrder.artworkId]: optimistic }));
      setReviewOrder(null);
      setReviewRating(0);
      setReviewText('');
      toast.success('Review submitted!');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Review submit failed:', err);
      toast.error('Could not submit review. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // Wait for auth state to settle, then navigate
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 400);
    } catch (error) {
      setIsLoggingOut(false);
    }
  };

  const handleSaveUpi = async () => {
    if (!appUser?.uid) return;
    
    setIsSavingUpi(true);
    try {
      await updateUserProfile(appUser.uid, { upiId: upiId.trim() || undefined });
      setIsEditingUpi(false);
      toast.success('UPI ID updated successfully');
    } catch (error) {
      toast.error('Failed to update UPI ID. Please try again.');
    } finally {
      setIsSavingUpi(false);
    }
  };

  const handleCancelUpiEdit = () => {
    setUpiId(appUser?.upiId || '');
    setIsEditingUpi(false);
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
      } catch (emailError) {
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
      await reauthenticateWithPopup(user, googleProvider);
      
      // Now delete account with skipReauth flag since we just reauthenticated
      await deleteAccount(appUser.uid, undefined, true);
      
      toast.success('Your account has been deleted.', {
        position: 'top-center',
        autoClose: 2000,
      });
      
      setShowReauthModal(false);
      navigate('/');
    } catch (error: any) {
      
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
      
      // Refresh the followers list
      const updatedFollowers = await getFollowersList(appUser.uid);
      setFollowersModal(prev => ({ ...prev, users: updatedFollowers }));
      
      // Refresh stats
      const userStats = await getUserStats(appUser.uid);
      setStats(userStats);
    } catch (error) {
      toast.error('Failed to remove follower');
    }
  };

  const handleUnfollow = async (artistId: string) => {
    if (!appUser) return;
    try {
      await unfollowArtist(appUser.uid, artistId);
      
      // Refresh the following list
      const updatedFollowing = await getFollowingList(appUser.uid);
      setFollowersModal(prev => ({ ...prev, users: updatedFollowing }));
      
      // Refresh stats
      const userStats = await getUserStats(appUser.uid);
      setStats(userStats);
    } catch (error) {
      toast.error('Failed to unfollow');
    }
  };

  return (
    <div>
      <style>{`
        @media (min-width: 401px) and (max-width: 768px) {
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
          .profile-info-row-mobile {
            gap: 0.5rem !important;
          }
        }
        @media (max-width: 400px) {
          .profile-info-row-mobile {
            gap: 0.35rem !important;
          }
          .profile-header-mobile {
            padding: 0.75rem !important;
            gap: 0.5rem !important;
          }
          .profile-image-mobile {
            width: 50px !important;
            height: 50px !important;
          }
          .profile-name-mobile {
            font-size: 1rem !important;
          }
          .profile-email-mobile {
            font-size: 0.75rem !important;
          }
          .following-box-mobile {
            padding: 0.3rem 0.5rem !important;
            min-width: 55px !important;
            flex-shrink: 1 !important;
          }
          .following-number-mobile {
            font-size: 0.95rem !important;
          }
          .following-label-mobile {
            font-size: 0.55rem !important;
          }
        }
        @media (max-width: 360px) {
          .profile-info-row-mobile {
            gap: 0.25rem !important;
          }
          .profile-header-mobile {
            padding: 0.6rem !important;
            gap: 0.4rem !important;
          }
          .profile-image-mobile {
            width: 44px !important;
            height: 44px !important;
          }
          .profile-name-mobile {
            font-size: 0.95rem !important;
          }
          .profile-email-mobile {
            font-size: 0.7rem !important;
          }
          .following-box-mobile {
            padding: 0.25rem 0.4rem !important;
            min-width: 48px !important;
          }
          .following-number-mobile {
            font-size: 0.85rem !important;
          }
          .following-label-mobile {
            font-size: 0.5rem !important;
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
              <div className="profile-info-row-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
                  <h2 style={{ ...styles.name, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="profile-name-mobile">{appUser?.name ? capitalizeName(appUser.name) : 'User'}</h2>
                  <p style={{ ...styles.email, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="profile-email-mobile">{appUser?.email}</p>
                </div>
                
                {/* Following Stats */}
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

          {/* Your Orders — buyer only */}
          {appUser?.role === 'buyer' && (
            <div style={styles.supportSection}>
              <div
                style={{ ...styles.supportHeader, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setOrdersOpen((p) => !p)}
              >
                <span style={{ ...styles.supportLabel, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  🛍️ Your Orders
                  <span style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: ordersOpen ? 'var(--color-primary)' : 'var(--primary-alpha-10)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: ordersOpen ? '#fff' : 'var(--color-primary)',
                    transition: 'all 0.25s ease',
                    flexShrink: 0,
                  }}>
                    <svg
                      width="11" height="11" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: ordersOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease' }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </span>
              </div>
              {ordersOpen && (
                ordersLoading ? (
                  <p style={{ ...styles.supportDescription, marginTop: '0.5rem' }}>Loading orders…</p>
                ) : orders.length === 0 ? (
                  <p style={{ ...styles.supportDescription, marginTop: '0.5rem' }}>No orders yet. When you accept an artist's offer, it will appear here.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                    {orders.map((order) => {
                      const fmtDate = (ts: any) => ts?.toDate?.()?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) ?? null;
                      const existingReview = reviewsByArtworkId[order.artworkId];
                      const alreadyReviewed = Boolean(existingReview);
                      return (
                        <div
                          key={`${order.chatId}_${order.artworkId}`}
                          style={{
                            padding: '0.75rem 0.9rem',
                            borderRadius: '10px',
                            border: '1px solid var(--color-border-light)',
                            background: order.status === 'completed' ? 'rgba(47,164,169,0.06)' : 'var(--color-bg-card)',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            {order.artworkImage && (
                              <img
                                src={order.artworkImage}
                                alt={order.artworkTitle}
                                style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                              />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {order.artworkTitle}
                              </p>
                              {order.finalPrice && (
                                <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>₹{order.finalPrice}</p>
                              )}
                              <span style={{
                                display: 'inline-block',
                                marginTop: '0.35rem',
                                padding: '0.15rem 0.55rem',
                                borderRadius: 20,
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: order.status === 'completed' ? 'rgba(47,164,169,0.15)' : 'rgba(251,191,36,0.15)',
                                color: order.status === 'completed' ? 'var(--color-primary)' : '#b45309',
                              }}>
                                {order.status === 'completed' ? 'Completed' : 'Inprogress'}
                              </span>
                            </div>
                          </div>

                          <div style={{ marginTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {(order.orderId || fmtDate(order.orderedAt)) && (
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {order.orderId && <span>Order ID: <strong style={{ color: 'var(--color-primary)', letterSpacing: '0.5px' }}>{order.orderId}</strong></span>}
                                {fmtDate(order.orderedAt) && <span>Ordered: <strong>{fmtDate(order.orderedAt)}</strong></span>}
                              </p>
                            )}
                            {order.status === 'completed' && (fmtDate(order.shippedAt) || order.trackingId) && (
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {fmtDate(order.shippedAt) && <span>Shipped: <strong>{fmtDate(order.shippedAt)}</strong></span>}
                                {order.trackingId && <span>Tracking ID: <strong>{order.trackingId}</strong></span>}
                              </p>
                            )}
                          </div>

                          {order.status === 'completed' && (
                            <>
                              <button
                                onClick={() => { if (!alreadyReviewed) { setReviewOrder(order); setReviewRating(0); setReviewText(''); } }}
                                disabled={alreadyReviewed}
                                style={{
                                  marginTop: '0.6rem',
                                  padding: '0.35rem 0.85rem',
                                  borderRadius: 8,
                                  border: '1.5px solid var(--color-primary)',
                                  background: 'transparent',
                                  color: 'var(--color-primary)',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: alreadyReviewed ? 'none' : 'inline-block',
                                }}
                              >
                                Write a Review
                              </button>
                              {existingReview && (
                                <div style={{ marginTop: '0.6rem', padding: '0.55rem 0.7rem', borderRadius: 8, background: 'rgba(47,164,169,0.06)', border: '1px solid rgba(47,164,169,0.18)' }}>
                                  <div style={{ display: 'flex', gap: '0.15rem', marginBottom: '0.25rem' }}>
                                    {[1,2,3,4,5].map((s) => (
                                      <span key={s} style={{ fontSize: '0.9rem', color: s <= existingReview.rating ? '#f59e0b' : 'var(--color-border-light)' }}>★</span>
                                    ))}
                                  </div>
                                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{existingReview.reviewText}</p>
                                  {existingReview.artistReply && (
                                    <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(47,164,169,0.15)' }}>
                                      <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                        Artist replied: {existingReview.artistReply}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}

          {/* Review modal */}
          {reviewOrder && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
              onClick={() => { if (!reviewSubmitting) setReviewOrder(null); }}
            >
              <div
                style={{ background: 'var(--color-bg-light)', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 380, position: 'relative' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setReviewOrder(null)}
                  disabled={reviewSubmitting}
                  style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}
                >×</button>
                <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700 }}>Review</h3>
                <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reviewOrder.artworkTitle}</p>

                {/* Star rating */}
                <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem' }}>
                  {[1,2,3,4,5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1.7rem', color: star <= reviewRating ? '#f59e0b' : 'var(--color-border-light)', lineHeight: 1 }}
                    >★</button>
                  ))}
                </div>

                <textarea
                  rows={4}
                  placeholder="Share your experience…"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  disabled={reviewSubmitting}
                  style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid var(--color-border-light)', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
                />

                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
                  <button
                    onClick={() => setReviewOrder(null)}
                    disabled={reviewSubmitting}
                    style={{ padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid var(--color-border-light)', background: 'transparent', fontSize: '0.83rem', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                  >Cancel</button>
                  <button
                    onClick={() => void handleSubmitReview()}
                    disabled={reviewSubmitting || reviewRating === 0 || !reviewText.trim()}
                    style={{ padding: '0.45rem 1.1rem', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: '0.83rem', fontWeight: 600, cursor: reviewSubmitting || reviewRating === 0 || !reviewText.trim() ? 'not-allowed' : 'pointer', opacity: reviewSubmitting || reviewRating === 0 || !reviewText.trim() ? 0.55 : 1 }}
                  >{reviewSubmitting ? 'Submitting…' : 'Submit'}</button>
                </div>
              </div>
            </div>
          )}

          {/* UPI ID Section - Only for Artists */}
          {appUser?.role === 'artist' && (
            <div style={styles.supportSection}>
              <div style={styles.supportHeader}>
                <span style={styles.supportLabel}>💳 UPI ID (for Payments)</span>
              </div>
              <p style={styles.supportDescription}>
                Add your UPI ID to receive payments for commissions and artwork sales
              </p>
              {isEditingUpi ? (
                <>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="Enter your UPI ID (Paytm, PhonePe or GPay)"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.95rem',
                      border: '1.5px solid var(--color-border-light)',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-primary)',
                      marginBottom: '0.75rem',
                      boxSizing: 'border-box' as const,
                    }}
                    disabled={isSavingUpi}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleCancelUpiEdit}
                      disabled={isSavingUpi}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        background: 'transparent',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '8px',
                        cursor: isSavingUpi ? 'not-allowed' : 'pointer',
                        opacity: isSavingUpi ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveUpi}
                      disabled={isSavingUpi}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#fff',
                        background: 'var(--gradient-primary)',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: isSavingUpi ? 'not-allowed' : 'pointer',
                        opacity: isSavingUpi ? 0.6 : 1,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isSavingUpi ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    padding: '0.75rem',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: '8px',
                    marginBottom: '0.75rem',
                    fontSize: '0.95rem',
                    color: upiId ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontFamily: upiId ? 'monospace' : 'inherit',
                  }}>
                    {upiId || 'Not set'}
                  </div>
                  <button
                    onClick={() => setIsEditingUpi(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'var(--gradient-primary)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(47, 164, 169, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {upiId ? 'Edit UPI ID' : 'Add UPI ID'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Support & Suggestions Section */}
          <div style={styles.supportSection}>
            <div style={styles.supportHeader}>
              <span style={styles.supportLabel}>{IoMdChatbubbles({style: {verticalAlign: 'middle', marginRight: '0.3rem'}})} Support & Suggestions</span>
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

          {/* Notification Settings Section */}
          <div style={styles.supportSection}>
            <div style={styles.supportHeader}>
              <span style={styles.supportLabel}>{IoMdNotifications({style: {verticalAlign: 'middle', marginRight: '0.3rem'}})} Notifications</span>
            </div>
            <p style={styles.supportDescription}>
              {notifEnabled
                ? 'Push notifications are enabled. You\'ll receive alerts for new messages, followers, and activity.'
                : 'Enable push notifications to stay updated on messages, followers, and art activity.'}
            </p>
            <div style={styles.notifToggleRow}>
              <span style={styles.notifStatusText}>
                {notifLoading ? 'Checking...' : notifEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={toggleNotif}
                disabled={notifLoading || notifToggling}
                style={{
                  ...styles.notifToggleButton,
                  ...(notifEnabled ? styles.notifToggleButtonActive : {}),
                  opacity: notifLoading || notifToggling ? 0.6 : 1,
                  cursor: notifLoading || notifToggling ? 'not-allowed' : 'pointer',
                }}
              >
                {notifToggling ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      animation: 'spin 1s linear infinite',
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: 'var(--primary-color)',
                    }}
                  >
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2 A10 10 0 0 1 22 12" />
                  </svg>
                ) : (
                  <span
                    style={{
                      ...styles.notifToggleKnob,
                      ...(notifEnabled ? styles.notifToggleKnobActive : {}),
                    }}
                  />
                )}
              </button>
            </div>
          </div>

          {/* Install App Section */}
          <div style={styles.supportSection}>
            <div style={styles.supportHeader}>
              <span style={styles.supportLabel}>
                {MdInstallMobile({style: {verticalAlign: 'middle', marginRight: '0.3rem'}})} {isInstalled ? 'App Installed' : 'Install App'}
              </span>
            </div>
            {isInstalled ? (
              <p style={styles.supportDescription}>
                Kalarang is installed on your device. Enjoy the full app experience!
              </p>
            ) : canInstall ? (
              <>
                <p style={styles.supportDescription}>
                  Install Kalarang on your device for faster access, offline support, and a native app experience.
                </p>
                <button
                  onClick={triggerInstall}
                  style={{
                    ...styles.sendButton,
                    ...(hoveredButton === 'installApp' ? {
                      background: 'var(--gradient-primary-hover)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 8px rgba(47, 164, 169, 0.3)',
                    } : {})
                  }}
                  onMouseEnter={() => setHoveredButton('installApp')}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  Install Kalarang
                </button>
              </>
            ) : isIos ? (
              <>
                <p style={styles.supportDescription}>
                  Install Kalarang on your iPhone/iPad in 3 easy steps:
                </p>
                <div style={{
                  background: 'var(--color-bg-light, #f5f5f5)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  marginTop: '0.5rem',
                  fontSize: '0.85rem',
                  lineHeight: 1.7,
                  color: 'var(--color-text-primary)',
                }}>
                  <div><strong>1.</strong> Tap the <strong>Share</strong> button <span style={{fontSize: '1.1rem'}}>⬆️</span> at the bottom of Safari</div>
                  <div><strong>2.</strong> Scroll down and tap <strong>"Add to Home Screen"</strong></div>
                  <div><strong>3.</strong> Tap <strong>"Add"</strong> to confirm</div>
                </div>
                <p style={{...styles.supportDescription, marginTop: '0.5rem', fontStyle: 'italic', fontSize: '0.78rem'}}>
                  After installing, open Kalarang from your home screen to enable push notifications.
                </p>
              </>
            ) : (
              <p style={styles.supportDescription}>
                To install Kalarang, open this site in Chrome or Edge on your device. If already installed, you're all set!
              </p>
            )}
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

    {/* Full Screen Loader for Logout */}
    <FullScreenLoader
      isVisible={isLoggingOut}
      message="Logging out... See you soon!"
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
    minWidth: 0,
    overflow: 'hidden',
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
    minWidth: 0,
    overflow: 'hidden',
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
  notifToggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.5rem',
  },
  notifStatusText: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
  },
  notifToggleButton: {
    width: '52px',
    height: '28px',
    borderRadius: '14px',
    border: 'none',
    backgroundColor: '#ccc',
    position: 'relative' as const,
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    padding: 0,
    flexShrink: 0,
  },
  notifToggleButtonActive: {
    backgroundColor: 'var(--color-primary, #0d9488)',
  },
  notifToggleKnob: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.3s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  notifToggleKnobActive: {
    transform: 'translateX(24px)',
  },
};

export default Profile;
