import React, { useState } from 'react';
import ProfileHeader from './ProfileHeader';

/**
 * ProfileHeaderDemo - Demo component showcasing different ProfileHeader usage scenarios
 * 
 * This demo shows:
 * 1. Owner view (with edit capabilities)
 * 2. Visitor view (with reach out option)
 * 3. Different user data variations
 */

const ProfileHeaderDemo: React.FC = () => {
  const [currentDemo, setCurrentDemo] = useState<'owner' | 'visitor'>('owner');

  // Mock users for demo
  const artistUser = {
    name: 'Maya Chen',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=120&h=120&fit=crop&crop=face',
    bannerImage: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&h=400&fit=crop',
    stats: {
      followers: 2847,
      artworks: 156,
      following: 423,
    },
  };

  const establishedArtistUser = {
    name: 'Alex Rodriguez',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
    bannerImage: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&h=400&fit=crop',
    stats: {
      followers: 15600,
      artworks: 89,
      following: 1200,
    },
  };

  const currentUser = currentDemo === 'owner' ? artistUser : establishedArtistUser;

  const handleEditProfile = () => {
    alert('Edit Profile clicked! This would open a profile editing modal or navigate to edit page.');
  };

  const handleShareProfile = () => {
    if (navigator.share) {
      navigator.share({
        title: `${currentUser.name}'s Portfolio`,
        text: `Check out ${currentUser.name}'s amazing artwork collection on Kalarang!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Profile link copied to clipboard!');
    }
  };

  return (
    <div style={styles.demoContainer}>
      <div style={styles.controls}>
        <h2 style={styles.title}>ProfileHeader Component Demo</h2>
        <div style={styles.toggleGroup}>
          <button
            style={{
              ...styles.toggleBtn,
              ...(currentDemo === 'owner' ? styles.toggleBtnActive : {}),
            }}
            onClick={() => setCurrentDemo('owner')}
          >
            Owner View
          </button>
          <button
            style={{
              ...styles.toggleBtn,
              ...(currentDemo === 'visitor' ? styles.toggleBtnActive : {}),
            }}
            onClick={() => setCurrentDemo('visitor')}
          >
            Visitor View
          </button>
        </div>
      </div>

      <div style={styles.demoArea}>
        <ProfileHeader
          user={currentUser}
          onEditProfile={handleEditProfile}
          onShareProfile={handleShareProfile}
          isOwner={currentDemo === 'owner'}
        />
      </div>

      <div style={styles.description}>
        <h3 style={styles.descTitle}>Current Demo: {currentDemo === 'owner' ? 'Owner View' : 'Visitor View'}</h3>
        <p style={styles.descText}>
          {currentDemo === 'owner' 
            ? 'This shows how the component appears to the profile owner. The edit icon is visible on the avatar and the secondary button shows "Edit Profile".'
            : 'This shows how the component appears to visitors. No edit icon is shown and the secondary button shows "Reach Out" for contacting the artist.'
          }
        </p>
      </div>
    </div>
  );
};

const styles = {
  demoContainer: {
    maxWidth: '1200px',
    margin: '2rem auto',
    padding: '2rem',
  },
  controls: {
    marginBottom: '2rem',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--color-text-primary-light)',
    marginBottom: '1.5rem',
  },
  toggleGroup: {
    display: 'inline-flex',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  toggleBtn: {
    padding: '0.75rem 1.5rem',
    border: 'none',
    background: 'var(--color-bg-white)',
    color: 'var(--color-text-secondary)',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    borderRight: '1px solid var(--color-border)',
  },
  toggleBtnActive: {
    background: 'var(--color-primary)',
    color: 'var(--color-text-primary-dark)',
  },
  demoArea: {
    background: 'var(--color-bg-light)',
    padding: '2rem',
    borderRadius: '12px',
    marginBottom: '2rem',
  },
  description: {
    textAlign: 'center' as const,
    padding: '2rem',
    background: 'var(--primary-alpha-10)',
    borderRadius: '12px',
  },
  descTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--color-primary)',
    marginBottom: '0.75rem',
  },
  descText: {
    fontSize: '1rem',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.6',
    maxWidth: '600px',
    margin: '0 auto',
  },
};

export default ProfileHeaderDemo;