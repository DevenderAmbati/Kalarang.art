import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import Portfolio from './Portfolio';
import Profile from './Profile';
import './AccountHub.css';

type ArtistTab = 'portfolio' | 'profile';

const AccountHub: React.FC = () => {
  const { appUser } = useAuth();
  const isArtist = appUser?.role === 'artist';
  const [activeTab, setActiveTab] = useState<ArtistTab>('portfolio');
  const { hidden: tabsHidden, anchorRef: tabsAnchorRef } = useScrollDirection();

  const content = useMemo(() => {
    if (!isArtist) return <Profile />;
    return activeTab === 'portfolio' ? <Portfolio /> : <Profile />;
  }, [activeTab, isArtist]);

  return (
    <div className="account-hub">
      {isArtist && (
        <div ref={tabsAnchorRef} className={`account-hub-main-tabs-wrap${tabsHidden ? ' pill-tabs-hidden' : ''}`}>
          <div className="account-hub-main-tabs">
            <button
              type="button"
              className={`account-hub-tab ${activeTab === 'portfolio' ? 'active' : ''}`}
              onClick={() => setActiveTab('portfolio')}
            >
              Portfolio
            </button>
            <button
              type="button"
              className={`account-hub-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile
            </button>
          </div>
        </div>
      )}
      {content}
    </div>
  );
};

export default AccountHub;
