import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import ProfileHeader from '../../components/Profile/ProfileHeader';
import AboutTab from '../../components/Profile/AboutTab';
import EditProfile, { ProfileData } from '../../components/Profile/EditProfile';
import PublishedWorks from '../artwork/PublishedWorks';
import Gallery from './Gallery';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { PortfolioProvider } from '../../context/PortfolioContext';
import { usePublishedWorks, useGalleryWorks } from '../../hooks/useCachedData';
import { getUserProfile, updateUserBanner, updateUserAvatar, updateUserProfile, getUserStats, getFollowersList, getFollowingList, subscribeToUserStats } from '../../services/userService';
import { unfollowArtist } from '../../services/interactionService';
import { toast } from 'react-toastify';
import { Artwork } from '../../types/artwork';
import { createStory, getUserStories } from '../../services/storyService';
import FollowersModal from '../../components/Modals/FollowersModal';
import '../../components/Artwork/ArtworkGridCard.css'; // Import for story modal styles
import './Portfolio.css';

const Portfolio: React.FC = () => {
  const navigate = useNavigate();
  const { appUser, refreshUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('published');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [storyArtwork, setStoryArtwork] = useState<Artwork | null>(null);
  const [artworkIdsInStories, setArtworkIdsInStories] = useState<Set<string>>(new Set());
  const [followersModal, setFollowersModal] = useState<{
    isOpen: boolean;
    type: 'followers' | 'following';
    users: Array<{ uid: string; name: string; username?: string; avatar?: string }>;
    isLoading: boolean;
  }>({ isOpen: false, type: 'followers', users: [], isLoading: false });
  
  // Fetch data at Portfolio level to persist across tab switches
  const publishedWorksData = usePublishedWorks(appUser?.uid);
  const galleryWorksData = useGalleryWorks(appUser?.uid);

  // Load user's active stories to check which artworks are already in stories
  useEffect(() => {
    const loadUserStories = async () => {
      if (!appUser?.uid) return;
      
      try {
        const userStories = await getUserStories(appUser.uid);
        const artworkIds = new Set(userStories.map(story => story.artworkId));
        setArtworkIdsInStories(artworkIds);
      } catch (error) {
        console.error('Error loading user stories:', error);
      }
    };

    loadUserStories();
  }, [appUser?.uid]);

  // Load user's active stories to check which artworks are already in stories
  useEffect(() => {
    const loadUserStories = async () => {
      if (!appUser?.uid) return;
      
      try {
        const userStories = await getUserStories(appUser.uid);
        const artworkIds = new Set(userStories.map(story => story.artworkId));
        setArtworkIdsInStories(artworkIds);
      } catch (error) {
        console.error('Error loading user stories:', error);
      }
    };

    loadUserStories();
  }, [appUser?.uid]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleEditProfile = () => {
    setIsEditingProfile(true);
  };

  const handleShareProfile = () => {
    // TODO: Implement profile sharing functionality
    if (navigator.share) {
      navigator.share({
        title: `${mockUser.name}'s Portfolio`,
        text: `Check out ${mockUser.name}'s amazing artwork collection on Kalarang!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      // Could show a toast notification here
    }
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
      await refreshStats();
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
      await refreshStats();
    } catch (error) {
      console.error('Error unfollowing user:', error);
      toast.error('Failed to unfollow');
    }
  };

  const handleAddToStory = (id: string) => {
    const artwork = publishedWorksData.data?.find((a: Artwork) => a.id === id);
    if (artwork) {
      setStoryArtwork(artwork);
    }
  };

  const handleCloseStory = () => {
    setStoryArtwork(null);
  };

  const handleShareStory = async () => {
    if (!storyArtwork || !appUser) return;

    try {
      await createStory(
        storyArtwork.id,
        appUser.uid,
        storyArtwork.artistName,
        storyArtwork.artistAvatar || '',
        storyArtwork.images[0],
        storyArtwork.title,
        storyArtwork.price
      );
      
      toast.success('Story shared successfully!');
      
      // Add artwork to the set of artworks in stories
      setArtworkIdsInStories(prev => new Set(prev).add(storyArtwork.id));
      
      setStoryArtwork(null);
      
      // Redirect to home feed immediately
      navigate('/home', { replace: true, state: { storyCreated: true } });
    } catch (error) {
      console.error('Error sharing story:', error);
      toast.error('Failed to share story. Please try again.');
    }
  };

  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString('en-IN')}`;
  };

  // User data loaded from Firebase
  const [mockUser, setMockUser] = useState({
    name: appUser?.name || 'Artist Name',
    username: appUser?.username,
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face',
    bannerImage: '/logo.jpeg',
    stats: {
      followers: 0,
      artworks: 0,
      following: 0,
    },
  });

  // Load user profile data from Firebase
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!appUser) {
        setIsLoadingProfile(false);
        return;
      }

      try {
        const profile = await getUserProfile(appUser.uid);
        
        if (profile) {
          setMockUser({
            name: profile.name || appUser.name,
            username: profile.username,
            avatar: profile.avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face',
            bannerImage: profile.bannerImage || '/logo.jpeg',
            stats: { followers: 0, artworks: 0, following: 0 }, // Will be updated by real-time subscription
          });

          // Update profile data state
          setProfileData(prev => ({
            ...prev,
            name: profile.name || appUser.name,
            avatar: profile.avatar || prev.avatar,
            bannerImage: profile.bannerImage || prev.bannerImage,
            bio: profile.bio || '',
            artStyle: profile.artStyle || [],
            philosophy: profile.philosophy || '',
            achievements: profile.achievements || [],
            exhibitions: profile.exhibitions || [],
            education: profile.education || [],
            commissionStatus: profile.commissionStatus,
            commissionDescription: profile.commissionDescription || '',
            commissionCtaText: profile.commissionCtaText || 'Get in Touch',
            links: profile.links || [],
          }));
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [appUser]);

  // Real-time stats subscription
  useEffect(() => {
    if (!appUser) return;

    console.log('[Real-time] Subscribing to user stats:', appUser.uid);

    const unsubscribe = subscribeToUserStats(
      appUser.uid,
      (stats) => {
        console.log('[Real-time] Received stats update:', stats);
        setMockUser(prev => ({
          ...prev,
          stats: stats,
        }));
      },
      (error) => {
        console.error('[Real-time] Stats subscription error:', error);
      }
    );

    // CRITICAL: Cleanup subscription
    return () => {
      console.log('[Real-time] Unsubscribing from user stats');
      unsubscribe();
    };
  }, [appUser?.uid]);

  // Function to refresh stats (now handled by real-time subscription)
  const refreshStats = async () => {
    // Stats are now updated automatically via real-time subscription
    console.log('[Real-time] Stats refresh requested (automatic via subscription)');
  };

  // Listen for artwork changes to refresh stats
  useEffect(() => {
    const handleArtworkChanged = () => {
      refreshStats();
    };
    
    window.addEventListener('artwork-published', handleArtworkChanged);
    window.addEventListener('artwork-deleted', handleArtworkChanged);
    
    return () => {
      window.removeEventListener('artwork-published', handleArtworkChanged);
      window.removeEventListener('artwork-deleted', handleArtworkChanged);
    };
  }, [appUser]);

  // Sync appUser avatar and banner changes to local state
  useEffect(() => {
    if (appUser?.avatar) {
      setProfileData(prev => ({
        ...prev,
        avatar: appUser.avatar!
      }));
    }
    if (appUser?.bannerImage) {
      setProfileData(prev => ({
        ...prev,
        bannerImage: appUser.bannerImage!
      }));
    }
  }, [appUser?.avatar, appUser?.bannerImage]);

  // Profile data for editing
  const [profileData, setProfileData] = useState<ProfileData>({
    name: mockUser.name,
    avatar: mockUser.avatar,
    bannerImage: mockUser.bannerImage,
    bio: "",
    artStyle: [],
    philosophy: "",
    achievements: [],
    exhibitions: [],
    education: [],
    commissionStatus: undefined,
    commissionDescription: "",
    commissionCtaText: "Get in Touch",
    links: []
  });

  const handleSaveProfile = async (data: ProfileData) => {
    if (!appUser) return;

    try {
      // Update local state immediately for optimistic UI
      setProfileData(data);
      setMockUser(prev => ({
        ...prev,
        name: data.name
      }));
      setIsEditingProfile(false);

      // Save to Firebase - filter out undefined values
      const updateData: any = {
        name: data.name,
        bio: data.bio,
        artStyle: data.artStyle,
        philosophy: data.philosophy,
        achievements: data.achievements,
        exhibitions: data.exhibitions,
        education: data.education,
        commissionDescription: data.commissionDescription,
        commissionCtaText: data.commissionCtaText,
        links: data.links
      };
      
      // Only include commissionStatus if it's defined
      if (data.commissionStatus !== undefined) {
        updateData.commissionStatus = data.commissionStatus;
      }
      
      await updateUserProfile(appUser.uid, updateData);

      // Refresh user profile in AuthContext
      await refreshUserProfile();
      
      toast.success('Profile updated successfully!');
      console.log('Profile saved to Firebase:', data);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
  };

  const handleBannerUpdate = async (newBannerBlobUrl: string) => {
    if (!appUser) return;

    try {
      // Show optimistic update
      setProfileData(prev => ({
        ...prev,
        bannerImage: newBannerBlobUrl
      }));
      setMockUser(prev => ({
        ...prev,
        bannerImage: newBannerBlobUrl
      }));

      // Upload to Firebase and update database in the background
      // Don't update UI again to prevent re-rendering
      await updateUserBanner(appUser.uid, newBannerBlobUrl);
      
      // Refresh user profile in AuthContext to update avatar/banner throughout app
      await refreshUserProfile();
      
      toast.success('Banner updated successfully!');
      console.log('Banner uploaded to Firebase');
    } catch (error) {
      console.error('Error updating banner:', error);
      toast.error('Failed to update banner. Please try again.');
    }
  };

  const handleAvatarUpdate = async (newAvatarBlobUrl: string) => {
    if (!appUser) return;

    try {
      // Show optimistic update
      setProfileData(prev => ({
        ...prev,
        avatar: newAvatarBlobUrl
      }));
      setMockUser(prev => ({
        ...prev,
        avatar: newAvatarBlobUrl
      }));

      // Upload to Firebase and update database in the background
      // Don't update UI again to prevent re-rendering
      await updateUserAvatar(appUser.uid, newAvatarBlobUrl);
      
      // Refresh user profile in AuthContext to update avatar throughout app
      await refreshUserProfile();
      
      toast.success('Avatar updated successfully!');
      console.log('Avatar uploaded to Firebase');
    } catch (error) {
      console.error('Error updating avatar:', error);
      toast.error('Failed to update avatar. Please try again.');
    }
  };

  const tabs = [
    { id: 'about', label: 'About' },
    { id: 'published', label: 'Published Works' },
    { id: 'gallery', label: 'Gallery' },
  ];

  const renderTabContent = () => {
    // Render all tabs but hide inactive ones to prevent remounting
    return (
      <>
        <div style={{ display: activeTab === 'about' ? 'block' : 'none' }}>
          <AboutTab 
            bio={profileData.bio}
            artStyle={profileData.artStyle}
            philosophy={profileData.philosophy}
            achievements={profileData.achievements}
            exhibitions={profileData.exhibitions}
            education={profileData.education}
            commissions={{
              status: profileData.commissionStatus,
              description: profileData.commissionDescription,
              ctaText: profileData.commissionCtaText
            }}
            links={profileData.links}
          />
        </div>
        <div style={{ display: activeTab === 'published' ? 'block' : 'none' }}>
          <PublishedWorks 
            cachedData={publishedWorksData}
            onAddToStory={handleAddToStory}
            artworkIdsInStories={artworkIdsInStories}
          />
        </div>
        <div style={{ display: activeTab === 'gallery' ? 'block' : 'none' }}>
          <Gallery 
            cachedData={galleryWorksData}
          />
        </div>
      </>
    );
  };

  return (
    <div>
      <PortfolioProvider>
        <div style={styles.container}>
          <div style={styles.content}>
            <ProfileHeader
              user={{
                name: profileData.name,
                username: mockUser.username,
                avatar: profileData.avatar,
                bannerImage: profileData.bannerImage,
                stats: mockUser.stats
              }}
              onEditProfile={handleEditProfile}
              onShareProfile={handleShareProfile}
              onBannerUpdate={handleBannerUpdate}
              onAvatarUpdate={handleAvatarUpdate}
              isOwner={true}
              onFollowersClick={handleFollowersClick}
              onFollowingClick={handleFollowingClick}
            />
            
            <div style={styles.tabSection}>
              <div style={styles.tabContainer} className="portfolio-tab-container">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="portfolio-tab-button"
                    style={{
                      ...styles.tabButton,
                      ...(activeTab === tab.id ? styles.activeTabButton : {}),
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              <div style={styles.tabContent}>
                {renderTabContent()}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {isEditingProfile && (
          <EditProfile
            profileData={profileData}
            onSave={handleSaveProfile}
            onCancel={handleCancelEdit}
          />
        )}

        {/* Story Modal */}
        {storyArtwork && (
          <div className="story-fullscreen" onClick={handleCloseStory}>
            <div className="story-fullscreen-content" onClick={(e) => e.stopPropagation()}>
              <button className="story-close-btn" onClick={handleCloseStory}>
                ✕
              </button>
              <div className="story-image-wrapper">
                <img 
                  src={storyArtwork.images[0]} 
                  alt={storyArtwork.title} 
                  className="story-fullscreen-image"
                />
                <div className="story-price">{formatPrice(storyArtwork.price)}</div>
              </div>
              <div className="story-fullscreen-info">
                <img src={storyArtwork.artistAvatar || ''} alt={storyArtwork.artistName} className="story-fullscreen-avatar" />
                <span className="story-fullscreen-name">{storyArtwork.artistName}</span>
              </div>
              <div className="story-fullscreen-actions">
                <div className="story-buttons">
                  <button className="story-btn story-btn-secondary" onClick={handleCloseStory}>
                    Cancel
                  </button>
                  <button className="story-btn story-btn-primary" onClick={handleShareStory}>
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Followers/Following Modal */}
        <FollowersModal
          isOpen={followersModal.isOpen}
          onClose={handleCloseFollowersModal}
          type={followersModal.type}
          users={followersModal.users}
          isLoading={followersModal.isLoading}
          onRemoveFollower={handleRemoveFollower}
          onUnfollow={handleUnfollow}
        />
      </PortfolioProvider>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100%',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 0rem',
    justifyContent: 'center',
  },
  tabSection: {
    marginTop: '1.5rem',
  },
  tabContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: '2rem',
    gap: '0',
    overflowX: 'hidden' as const,
    paddingBottom: '0',
    '@media (min-width: 640px) and (max-width: 1023px)': {
      gap: '0.25rem',
      justifyContent: 'flex-start',
      paddingLeft: '1rem',
      paddingRight: '1rem',
    },
    '@media (max-width: 639px)': {
      gap: '0.25rem',
      justifyContent: 'flex-start',
      paddingLeft: '1rem',
      paddingRight: '1rem',
    },
  },
  tabButton: {
    position: 'relative' as const,
    padding: '1rem 2rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: '0.95rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap' as const,
    borderBottom: '3px solid transparent',
    '@media (min-width: 640px) and (max-width: 1023px)': {
      padding: '0.875rem 1.5rem',
      fontSize: '0.9rem',
    },
    '@media (max-width: 639px)': {
      padding: '0.875rem 1.5rem',
      fontSize: '0.9rem',
    },
    '@media (max-width: 480px)': {
      padding: '0.75rem 1.25rem',
      fontSize: '0.85rem',
    },
  },
  activeTabButton: {
    color: 'var(--color-primary)',
    fontWeight: 600,
    borderBottom: '3px solid var(--color-primary)',
    backgroundColor: 'rgba(var(--color-primary-rgb), 0.05)',
  },
  tabContent: {
    minHeight: '400px',
  },
  emoji: {
    fontSize: '2.5rem',
    display: 'block',
    marginBottom: '0.75rem',
  },
  comingSoonTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--color-primary)',
    marginBottom: '0.75rem',
  },
  comingSoonText: {
    fontSize: '0.95rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.5',
  },
};

export default Portfolio;
