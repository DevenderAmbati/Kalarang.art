import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGalleryWorks, UseCachedDataResult } from '../../hooks/useCachedData';
import { Artwork } from '../../types/artwork';
import GalleryTab, { GalleryImage } from '../../components/Profile/GalleryTab';
import EmptyState from '../../components/State/EmptyState';
import LoadingState from '../../components/State/LoadingState';
import noContentAnimation from '../../animations/no content.json';
import lineArt1Animation from '../../animations/Line art (1).json';

interface GalleryProps {
  cachedData?: UseCachedDataResult<Artwork[]>;
  isOwnProfile?: boolean;
}

const Gallery: React.FC<GalleryProps> = ({ cachedData, isOwnProfile = true }) => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  
  // Use provided cached data or fetch if not provided
  const ownData = useGalleryWorks(appUser?.uid, !cachedData);
  const { data: artworks, isLoading } = cachedData || ownData;

  const handleImageClick = (artworkId: string) => {
    const artwork = artworks?.find(a => a.id === artworkId);
    if (artwork && !artwork.published) {
      // If unpublished, navigate to edit page
      navigate(`/post?edit=${artworkId}`);
    } else {
      // If published, navigate to detail page
      navigate(`/artwork/${artworkId}`);
    }
  };

  // Convert artworks to gallery images (only first image of each artwork)
  const galleryImages: GalleryImage[] = useMemo(() => {
    if (!artworks) return [];
    
    return artworks.map(artwork => ({
      id: artwork.id,
      src: artwork.images[0],
      alt: artwork.title,
      published: artwork.published,
      isCommissioned: artwork.isCommissioned,
    }));
  }, [artworks]);

  if (isLoading) {
    return <LoadingState animation={lineArt1Animation} message="Loading your gallery..." fullHeight />;
  }

  if (galleryImages.length === 0) {
    return isOwnProfile ? (
      <EmptyState
        animation={noContentAnimation}
        title="Your Gallery Awaits"
        description="Your creative space is ready! Upload your artwork to build your personal gallery and showcase your talent."
        actionLabel="Upload Your First Piece"
        actionPath="/post"
      />
    ) : (
      <EmptyState
        animation={noContentAnimation}
        title="No Artworks Yet"
        description="This artist hasn't uploaded any artworks to their gallery."
      />
    );
  }


  return <GalleryTab images={galleryImages} onImageClick={isOwnProfile ? handleImageClick : undefined} isOwnProfile={isOwnProfile} />;
};

export default Gallery;