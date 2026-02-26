import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ImagePreview {
  id: string;
  file?: File;
  url: string;
  isExisting?: boolean;
}

interface ImagePreviewGridProps {
  images: ImagePreview[];
  onRemoveImage: (id: string) => void;
  maxImages?: number;
}

interface SortableItemProps {
  image: ImagePreview;
  index: number;
  onRemoveImage: (id: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ image, index, onRemoveImage }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    touchAction: 'none',
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="preview-item"
      {...attributes}
      {...listeners}
    >
      <img
        src={image.url}
        alt={`Preview ${index + 1}`}
        className="preview-image"
        style={{ pointerEvents: 'none' }}
      />
      <div className="preview-badge">{index + 1}</div>
      
      <button
        type="button"
        className="preview-remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemoveImage(image.id);
        }}
        title="Remove image"
        style={{ pointerEvents: 'auto' }}
      >
        ×
      </button>
    </div>
  );
};

const ImagePreviewGrid: React.FC<ImagePreviewGridProps> = ({
  images,
  onRemoveImage,
  maxImages = 6,
}) => {
  // Create empty slots to fill the grid
  const displayItems = [...images];
  const remainingSlots = Math.max(0, maxImages - images.length);
  
  for (let i = 0; i < remainingSlots; i++) {
    displayItems.push({} as ImagePreview);
  }

  // Only show up to maxImages (only actual images, not empty slots)
  const actualImages = images.slice(0, maxImages);
  const emptySlots = displayItems.slice(actualImages.length, maxImages);

  return (
    <div className="image-preview-grid">
      {actualImages.map((image, index) => (
        <SortableItem 
          key={image.id} 
          image={image} 
          index={index} 
          onRemoveImage={onRemoveImage}
        />
      ))}
      {emptySlots.map((_, index) => (
        <div 
          key={`empty-${index}`} 
          className="preview-item"
          style={{ 
            cursor: 'default',
            opacity: 1,
          }}
        >
          <div 
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-bg-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '2rem',
              opacity: 0.3,
            }}
          >
            +
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImagePreviewGrid;