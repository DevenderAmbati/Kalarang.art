import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import ProfileHeader from '../../components/Profile/ProfileHeader';
import AboutTab from '../../components/Profile/AboutTab';
import ChatDrawer, { ChatContact } from '../../components/Chat/ChatDrawer';
import PublishedWorks from '../artwork/PublishedWorks';
import Gallery from './Gallery';
import { logout } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { PortfolioProvider } from '../../context/PortfolioContext';
import { getUserProfile, getUserStats } from '../../services/userService';
import { followArtist, unfollowArtist, isFollowingArtist } from '../../services/interactionService';
import { toast } from 'react-toastify';
import { getArtworksByArtist } from '../../services/artworkService';
import LoadingState from '../../components/State/LoadingState';
import lineArt1Animation from '../../animations/Line art (1).json';
import './Portfolio.css';

const OtherUserPortfolio: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState('published');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [publishedArtworks, setPublishedArtworks] = useState<any[]>([]);
  const [galleryArtworks, setGalleryArtworks] = useState<any[]>([]);
  
  const [profileUser, setProfileUser] = useState({
    name: 'Artist Name',
    username: undefined as string | undefined,
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face',
    bannerImage: '/logo.jpeg',
    stats: {
      followers: 0,
      artworks: 0,
      following: 0,
    },
    bio: '',
    artStyle: [] as string[],
    philosophy: '',
    achievements: [] as string[],
    exhibitions: [] as { year: string; title: string }[],
    education: [] as string[],
    commissionStatus: undefined as "Open" | "Closed" | undefined,
    commissionDescription: '',
    commissionCtaText: 'Get in Touch',
    links: [] as { label: string; url: string; icon: string }[],
  });

  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [commissionReachOutContact, setCommissionReachOutContact] = useState<ChatContact | null>(null);
  const [commissionReachOutMessage, setCommissionReachOutMessage] = useState('');

  useEffect(() => {
    if (!userId) {
      navigate('/home');
      return;
    }

    // If viewing own profile, redirect to /portfolio
    if (appUser && userId === appUser.uid) {
      navigate('/portfolio');
      return;
    }

    loadUserProfile();
  }, [userId, appUser]);

  // Set document title with artist's first name
  useEffect(() => {
    if (profileUser.name && profileUser.name !== 'Artist Name') {
      document.title = `${profileUser.name.split(' ')[0]}'s Portfolio - Kalarang`;
    }
    return () => {
      document.title = 'Kalarang';
    };
  }, [profileUser.name]);

  const loadUserProfile = async () => {
    if (!userId) return;

    try {
      setIsLoadingProfile(true);
      
      // Load user profile
      const profile = await getUserProfile(userId);
      
      if (!profile) {
        toast.error('User not found');
        navigate('/home');
        return;
      }

      // Fetch real-time stats
      const stats = await getUserStats(userId);

      setProfileUser({
        name: profile.name,
        username: profile.username,
        avatar: profile.avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face',
        bannerImage: profile.bannerImage || '/logo.jpeg',
        stats: stats,
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
      });

      // Check if current user is following this artist
      if (appUser) {
        const following = await isFollowingArtist(appUser.uid, userId);
        setIsFollowing(following);
      }

      // Load artworks
      const artworks = await getArtworksByArtist(userId);
      const published = artworks.filter(art => art.published);
      
      setPublishedArtworks(published);
      // Gallery shows all published artworks for other users (unpublished are private drafts)
      setGalleryArtworks(published);

    } catch (error) {
      console.error('Error loading user profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleShareProfile = () => {
    if (navigator.share) {
      navigator.share({
        title: `${profileUser.name}'s Portfolio`,
        text: `Check out ${profileUser.name}'s amazing artwork collection on Kalarang!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleGetInTouch = () => {
    if (!appUser || !userId) {
      toast.error('Please log in to get in touch with artists');
      return;
    }

    if (appUser.uid === userId) {
      toast.info('You cannot message yourself');
      return;
    }

    const contact: ChatContact = {
      uid: userId,
      name: profileUser.name,
      avatar: profileUser.avatar,
    };
    const message = `Hi ${profileUser.name}, I'm interested in commissioning work and would like to learn more about your process and availability. Could you share the details?`;
    setCommissionReachOutContact(contact);
    setCommissionReachOutMessage(message);
    setChatDrawerOpen(true);
  };

  const handleFollow = async () => {
    if (!appUser || !userId) {
      toast.error('Please log in to follow artists');
      return;
    }

    try {
      if (isFollowing) {
        await unfollowArtist(appUser.uid, userId);
        setIsFollowing(false);
        toast.success('Unfollowed artist');
      } else {
        await followArtist(appUser.uid, userId, appUser.name, appUser.avatar);
        setIsFollowing(true);
        toast.success('Following artist');
      }
      
      // Refresh stats after follow/unfollow
      const updatedStats = await getUserStats(userId);
      setProfileUser(prev => ({
        ...prev,
        stats: updatedStats,
      }));
      
      // Broadcast change to other components
      window.dispatchEvent(new CustomEvent('follow-changed', { detail: { userId: appUser.uid } }));
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  };

  const tabs = [
    { id: 'about', label: 'About' },
    { id: 'published', label: 'Published Works' },
    { id: 'gallery', label: 'Gallery' },
  ];

  const renderTabContent = () => {
    return (
      <>
        <div style={{ display: activeTab === 'about' ? 'block' : 'none' }}>
          <AboutTab 
            bio={profileUser.bio}
            artStyle={profileUser.artStyle}
            philosophy={profileUser.philosophy}
            achievements={profileUser.achievements}
            exhibitions={profileUser.exhibitions}
            education={profileUser.education}
            commissions={{
              status: profileUser.commissionStatus,
              description: profileUser.commissionDescription,
              ctaText: profileUser.commissionCtaText
            }}
            onGetInTouch={handleGetInTouch}
            links={profileUser.links}
          />
        </div>
        <div style={{ display: activeTab === 'published' ? 'block' : 'none' }}>
          <PublishedWorks 
            cachedData={{
              data: publishedArtworks,
              isLoading: false,
              isError: false,
              error: null,
              isStale: false,
              refetch: loadUserProfile,
              invalidate: () => {},
              updateCache: () => {},
            }}
            onAddToStory={() => {}}
            artworkIdsInStories={new Set()}
            isOwnProfile={false}
          />
        </div>
        <div style={{ display: activeTab === 'gallery' ? 'block' : 'none' }}>
          <Gallery 
            cachedData={{
              data: galleryArtworks,
              isLoading: false,
              isError: false,
              error: null,
              isStale: false,
              refetch: loadUserProfile,
              invalidate: () => {},
              updateCache: () => {},
            }}
            isOwnProfile={false}
          />
        </div>
      </>
    );
  };

  if (isLoadingProfile) {
    return (
      <LoadingState 
        animation={lineArt1Animation}
        message="Loading profile..." 
        fullHeight 
      />
    );
  }

  return (
    <div>
      <PortfolioProvider>
        <div style={styles.container}>
          <div style={styles.content}>
            <ProfileHeader
              user={{
                name: profileUser.name,
                username: profileUser.username,
                avatar: profileUser.avatar,
                bannerImage: profileUser.bannerImage,
                stats: profileUser.stats
              }}
              onShareProfile={handleShareProfile}
              isOwner={false}
              isFollowing={isFollowing}
              onFollow={handleFollow}
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

        {chatDrawerOpen && commissionReachOutContact && appUser && (
          <ChatDrawer
            isOpen={chatDrawerOpen}
            onClose={() => {
              setChatDrawerOpen(false);
              setCommissionReachOutContact(null);
              setCommissionReachOutMessage('');
            }}
            initialContact={commissionReachOutContact}
            initialMessage={commissionReachOutMessage || undefined}
            reachOutMetadata={{ artworkId: 'commission', artworkTitle: 'Commission inquiry' }}
          />
        )}
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
};

export default OtherUserPortfolio;
