import React, { createContext, useContext, useCallback } from 'react';
import { cache, cacheKeys } from '../utils/cache';
import { useAuth } from './AuthContext';

interface PortfolioContextType {
  invalidatePublishedWorks: () => void;
  invalidateGalleryWorks: () => void;
  invalidateAllPortfolio: () => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();

  const invalidatePublishedWorks = useCallback(() => {
    if (!appUser) return;
    console.log('[Cache] Invalidating published works cache');
    cache.invalidate(cacheKeys.publishedWorks(appUser.uid));
  }, [appUser]);

  const invalidateGalleryWorks = useCallback(() => {
    if (!appUser) return;
    console.log('[Cache] Invalidating gallery works cache');
    cache.invalidate(cacheKeys.galleryWorks(appUser.uid));
  }, [appUser]);

  const invalidateAllPortfolio = useCallback(() => {
    if (!appUser) return;
    console.log('[Cache] Invalidating all portfolio cache');
    cache.invalidate(cacheKeys.publishedWorks(appUser.uid));
    cache.invalidate(cacheKeys.galleryWorks(appUser.uid));
    cache.invalidate(cacheKeys.artistWorks(appUser.uid));
  }, [appUser]);

  const value = {
    invalidatePublishedWorks,
    invalidateGalleryWorks,
    invalidateAllPortfolio,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
