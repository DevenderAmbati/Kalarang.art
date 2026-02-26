import React, { useRef, useEffect, useState } from 'react';
import { Grid, AutoSizer } from 'react-virtualized';
import 'react-virtualized/styles.css';
import ArtworkGridCard from './ArtworkGridCard';
import './ArtworkGrid.css';

export interface Artwork {
  id: string;
  title: string;
  artworkImage: string;
  artistName: string;
  artistAvatar: string;
  artistId?: string;
  price: number;
  sold?: boolean;
}

export interface ArtworkGridProps {
  artworks: Artwork[];
  onArtworkClick: (id: string) => void;
  isOwner?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onMarkAsSold?: (id: string) => void;
  onSave?: (id: string) => void;
  savedArtworks?: Set<string>;
  onAddToStory?: (id: string) => void;
  artworkIdsInStories?: Set<string>;
  currentUserId?: string;
  viewType?: 'homefeed' | 'discover' | 'published' | 'favourites';
}

const ArtworkGrid: React.FC<ArtworkGridProps> = ({ 
  artworks, 
  onArtworkClick,
  isOwner = false,
  onEdit,
  onDelete,
  onMarkAsSold,
  onSave,
  savedArtworks,
  onAddToStory,
  artworkIdsInStories = new Set(),
  currentUserId,
  viewType
}) => {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // Update screen width on resize
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate column count based on screen width
  const getColumnCount = () => {
    if (screenWidth >= 1440) return 4;
    if (screenWidth >= 1024) return 3;
    if (screenWidth >= 640) return 2;
    // Mobile view: 1 column for homefeed, 2 columns for others
    if (viewType === 'homefeed') return 1;
    return 2;
  };

  const columnCount = getColumnCount();

  // Cell renderer
  const cellRenderer = ({ columnIndex, key, rowIndex, style }: any) => {
    const index = rowIndex * columnCount + columnIndex;
    const artwork = artworks[index];

    if (!artwork) return null;

    return (
      <div key={key} style={{ ...style, padding: '8px' }}>
        <ArtworkGridCard
          artwork={artwork}
          onArtworkClick={onArtworkClick}
          isOwner={isOwner}
          onEdit={onEdit}
          onDelete={onDelete}
          onMarkAsSold={onMarkAsSold}
          onSave={onSave}
          isSaved={savedArtworks?.has(artwork.id) || false}
          onAddToStory={onAddToStory}
          hasStory={artworkIdsInStories.has(artwork.id)}
          currentUserId={currentUserId}
        />
      </div>
    );
  };

  // Fallback for small lists
  if (artworks.length < 20) {
    return (
      <div className={`artwork-grid ${viewType ? `artwork-grid-${viewType}` : ''}`}>
        {artworks.map((artwork) => (
          <ArtworkGridCard
            key={artwork.id}
            artwork={artwork}
            onArtworkClick={onArtworkClick}
            isOwner={isOwner}
            onEdit={onEdit}
            onDelete={onDelete}
            onMarkAsSold={onMarkAsSold}
            onSave={onSave}
            isSaved={savedArtworks?.has(artwork.id) || false}
            onAddToStory={onAddToStory}
            hasStory={artworkIdsInStories.has(artwork.id)}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    );
  }

  const rowCount = Math.ceil(artworks.length / columnCount);

  return (
    <div className={`artwork-grid-virtualized ${viewType ? `artwork-grid-${viewType}` : ''}`}>
      <AutoSizer>
        {({ width, height }) => {
          const columnWidth = width / columnCount;
          const rowHeight = columnWidth * 1.4; // Maintain aspect ratio

          return (
            <Grid
              columnCount={columnCount}
              columnWidth={columnWidth}
              height={height}
              rowCount={rowCount}
              rowHeight={rowHeight}
              width={width}
              overscanRowCount={4}
              className="artwork-virtual-grid"
              cellRenderer={cellRenderer}
            />
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default ArtworkGrid;
