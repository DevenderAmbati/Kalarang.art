import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Lottie from 'lottie-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import UploadDropzone from './UploadDropzone';
import ImagePreviewGrid from './ImagePreviewGrid';
import ArtworkMetadataForm, { ArtworkFormData } from './ArtworkMetadataForm';
import { useAuth } from '../../context/AuthContext';
import { createArtwork, toggleArtworkPublish, getArtwork, updateArtwork, uploadArtworkImages } from '../../services/artworkService';
import { cache, cacheKeys } from '../../utils/cache';
import artAnimation from '../../animations/Line art (1).json';
import publishAnimation from '../../animations/Line art (2).json';
import './CreateArtwork.css';

interface ImagePreview {
  id: string;
  file?: File;
  url: string;
  isExisting?: boolean;
}

const CreateArtwork: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editArtworkId = searchParams.get('edit');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [savedArtworkId, setSavedArtworkId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [currentTip, setCurrentTip] = useState('');
  const [isLoadingArtwork, setIsLoadingArtwork] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true); // Start with true for new artworks
  const [formData, setFormData] = useState<ArtworkFormData>({
    title: '',
    description: '',
    createdDate: '',
    category: '',
    medium: '',
    width: '',
    height: '',
    price: '',
    isCommissioned: false,
  });

  const maxImages = 6;

  // Load draft from localStorage if available (for new artworks only)
  useEffect(() => {
    if (editArtworkId) return; // Don't load draft if editing existing artwork

    const savedDraft = localStorage.getItem('artworkDraft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.formData) {
          setFormData(draft.formData);
        }
        // Restore images from base64 data URLs
        if (draft.images && Array.isArray(draft.images)) {
          const restoredImages: ImagePreview[] = draft.images.map((img: any) => ({
            id: img.id,
            url: img.dataUrl,
            isExisting: false,
          }));
          setImages(restoredImages);
        }
        console.log('[Draft] Loaded from localStorage:', draft);
        toast.info('Draft restored from your last session', {
          autoClose: 3000,
        });
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, [editArtworkId]);

  // Save draft to localStorage whenever form data changes
  useEffect(() => {
    if (editArtworkId) return; // Don't save draft if editing existing artwork

    // Only save if there's actual data (not just empty form)
    const hasData = formData.title || formData.description || formData.category || 
                     formData.medium || formData.createdDate || formData.width || 
                     formData.height || formData.price;
    
    if (!hasData && images.length === 0) {
      // If form is empty and no images, remove the draft
      localStorage.removeItem('artworkDraft');
      return;
    }

    // Debounce the save to avoid too many writes
    const timeoutId = setTimeout(async () => {
      try {
        // Convert images to base64 data URLs for storage
        const imagesToSave = await Promise.all(
          images.filter(img => !img.isExisting).map(async (img) => {
            // If it's a blob URL, fetch and convert to base64
            if (img.url.startsWith('blob:')) {
              try {
                const response = await fetch(img.url);
                const blob = await response.blob();
                const reader = new FileReader();
                const dataUrl = await new Promise<string>((resolve) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                return { id: img.id, dataUrl };
              } catch (error) {
                console.error('Error converting image:', error);
                return null;
              }
            }
            return { id: img.id, dataUrl: img.url };
          })
        );

        const draft = {
          formData,
          images: imagesToSave.filter(img => img !== null),
          timestamp: Date.now(),
        };
        
        const draftStr = JSON.stringify(draft);
        // Check if draft is too large (localStorage limit is typically 5-10MB)
        if (draftStr.length > 4.5 * 1024 * 1024) { // 4.5MB limit to be safe
          console.warn('[Draft] Draft too large, saving without images');
          const draftWithoutImages = {
            formData,
            timestamp: Date.now(),
          };
          localStorage.setItem('artworkDraft', JSON.stringify(draftWithoutImages));
          toast.warning('Draft saved without images (size limit)', { autoClose: 2000 });
        } else {
          localStorage.setItem('artworkDraft', draftStr);
          console.log('[Draft] Saved to localStorage:', draft);
        }
      } catch (error) {
        console.error('[Draft] Error saving:', error);
        // If error (e.g., quota exceeded), try saving without images
        try {
          const draftWithoutImages = {
            formData,
            timestamp: Date.now(),
          };
          localStorage.setItem('artworkDraft', JSON.stringify(draftWithoutImages));
        } catch (e) {
          console.error('[Draft] Failed to save even without images:', e);
        }
      }
    }, 500); // Wait 500ms after last change before saving

    return () => clearTimeout(timeoutId);
  }, [formData, images, editArtworkId]);

  // Load existing artwork if editing
  useEffect(() => {
    const loadArtwork = async () => {
      if (!editArtworkId || !appUser) return;

      setIsLoadingArtwork(true);
      try {
        const artwork = await getArtwork(editArtworkId);
        if (!artwork) {
          toast.error('Artwork not found');
          navigate('/post');
          return;
        }

        // Check if current user is the owner
        if (artwork.artistId !== appUser.uid) {
          toast.error('You can only edit your own artwork');
          navigate('/post');
          return;
        }

        // Set form data
        setFormData({
          title: artwork.title || '',
          description: artwork.description || '',
          createdDate: artwork.createdDate || '',
          category: artwork.category || '',
          medium: artwork.medium || '',
          width: artwork.width?.toString() || '',
          height: artwork.height?.toString() || '',
          price: artwork.price?.toString() || '',
          isCommissioned: artwork.isCommissioned || false,
        });

        // Set existing images as ImagePreview objects
        const existingPreviews: ImagePreview[] = (artwork.images || []).map((url, index) => ({
          id: `existing-${index}-${Date.now()}`,
          url,
          isExisting: true,
        }));
        setImages(existingPreviews);
        setSavedArtworkId(editArtworkId);
      } catch (error) {
        console.error('Error loading artwork:', error);
        toast.error('Failed to load artwork');
        navigate('/post');
      } finally {
        setIsLoadingArtwork(false);
      }
    };

    loadArtwork();
  }, [editArtworkId, appUser, navigate]);

  const createImagePreview = (file: File): ImagePreview => ({
    id: `new-${Date.now()}-${Math.random()}`,
    file,
    url: URL.createObjectURL(file),
    isExisting: false,
  });

  const handleFileSelect = useCallback((files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const totalCurrentImages = images.length;
    const remainingSlots = maxImages - totalCurrentImages;
    const filesToAdd = imageFiles.slice(0, remainingSlots);
    
    const newPreviews = filesToAdd.map(createImagePreview);
    setImages(prev => [...prev, ...newPreviews]);
    setIsDragActive(false);
    // Mark as having unsaved changes when editing or after initial save
    if (editArtworkId || savedArtworkId) {
      setHasUnsavedChanges(true);
    }
  }, [images.length, maxImages, editArtworkId, savedArtworkId]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      // Clean up URL for new images only
      const removedImage = prev.find(img => img.id === id);
      if (removedImage && !removedImage.isExisting && removedImage.file) {
        URL.revokeObjectURL(removedImage.url);
      }
      return updated;
    });
    // Mark as having unsaved changes when editing or after initial save
    if (editArtworkId || savedArtworkId) {
      setHasUnsavedChanges(true);
    }
  }, [editArtworkId, savedArtworkId]);

  const handleDragEnter = useCallback(() => {
    const totalCurrentImages = images.length;
    if (totalCurrentImages < maxImages) {
      setIsDragActive(true);
    }
  }, [images.length, maxImages]);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((files: File[]) => {
    handleFileSelect(files);
  }, [handleFileSelect]);

  const handleFormDataChange = useCallback((field: keyof ArtworkFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'isCommissioned' ? value === 'true' : value,
    }));
    // Mark as having unsaved changes when editing or after initial save
    if (editArtworkId || savedArtworkId) {
      setHasUnsavedChanges(true);
    }
  }, [editArtworkId, savedArtworkId]);

  // dnd-kit sensors for drag and drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms press before drag starts
        tolerance: 5, // 5px tolerance for movement
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reordered = arrayMove(items, oldIndex, newIndex);
        
        // Mark as having unsaved changes when editing or after initial save
        if (editArtworkId || savedArtworkId) {
          setHasUnsavedChanges(true);
        }
        
        return reordered;
      });
    }
  }, [editArtworkId, savedArtworkId]);

  const handleSaveToGallery = async () => {
    if (!appUser) {
      toast.error('You must be logged in to save artwork');
      return;
    }

    // Check if there's at least one image
    if (images.length === 0) {
      toast.error('Please add at least one image');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Please add a title');
      return;
    }

    setIsSaving(true);
    setUploadProgress(0);
    setUploadStatus('Preparing your artwork...');

    // Engaging tips to show during upload
    const tips = [
      "🎨 Pro tip: Add detailed descriptions to help buyers connect with your art",
      "✨ Your artwork is being optimized for the best viewing experience",
      "🌟 Great art takes time - we're making sure every pixel is perfect!",
      "💫 We're securely storing your artwork in the cloud",
      "🔥 Tip: Published artworks appear in the Discover feed instantly",
      "🚀 Sit tight, your masterpiece is almost ready to shine!",
      "🎉 Once it is saved, publish it to share with the world!"
    ];

    let tipInterval: NodeJS.Timeout | null = null;
    let currentTipIndex = 0;

    try {
      const artworkUpload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        medium: formData.medium,
        width: formData.width,
        height: formData.height,
        price: parseFloat(formData.price) || 0,
        isCommissioned: formData.isCommissioned,
        createdDate: formData.createdDate,
      };

      // Show rotating tips every 3 seconds
      setCurrentTip(tips[0]);
      tipInterval = setInterval(() => {
        currentTipIndex = (currentTipIndex + 1) % tips.length;
        setCurrentTip(tips[currentTipIndex]);
      }, 3000);

      let artworkId: string;

      if (savedArtworkId) {
        // Update existing artwork (works for both edit mode and after initial save)
        console.log('Updating existing artwork:', savedArtworkId);
        console.log('Images state:', images.map(img => ({ id: img.id, isExisting: img.isExisting, hasFile: !!img.file })));
        setUploadStatus('Updating artwork...');
        
        // Separate existing and new images
        const existingImages = images.filter(img => img.isExisting);
        const newImages = images.filter(img => !img.isExisting && img.file);
        
        console.log('Existing images count:', existingImages.length);
        console.log('New images count:', newImages.length);
        
        setUploadProgress(10);
        
        // Upload new images in parallel for better performance
        let newImageUrls: string[] = [];
        if (newImages.length > 0) {
          setUploadStatus(`Uploading ${newImages.length} new image${newImages.length > 1 ? 's' : ''}...`);
          const newImageFiles = newImages.map(img => img.file!);
          newImageUrls = await uploadArtworkImages(appUser.uid, newImageFiles);
          setUploadProgress(60);
        } else {
          setUploadProgress(60);
        }

        // Reconstruct images array maintaining the order
        const allImageUrls: string[] = [];
        let newImageIndex = 0;
        
        for (const img of images) {
          if (img.isExisting) {
            allImageUrls.push(img.url);
          } else {
            allImageUrls.push(newImageUrls[newImageIndex]);
            newImageIndex++;
          }
        }

        setUploadStatus('Saving changes...');
        setUploadProgress(70);

        await updateArtwork(savedArtworkId, {
          ...artworkUpload,
          images: allImageUrls,
        } as any);

        artworkId = savedArtworkId;
        console.log('Artwork updated successfully:', artworkId);
        
        // Convert all images to existing after update to prevent re-upload
        setUploadStatus('Finalizing...');
        const existingImagePreviews: ImagePreview[] = allImageUrls.map((url, index) => ({
          id: `existing-${index}-${Date.now()}`,
          url,
          isExisting: true,
        }));
        setImages(existingImagePreviews);
        setUploadProgress(80);
      } else {
        // Create new artwork
        console.log('Creating new artwork...');
        const imageFiles = images.filter(img => img.file).map(img => img.file!);
        
        setUploadStatus(`Uploading ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''}...`);
        setUploadProgress(20);
        
        artworkId = await createArtwork(
          appUser.uid,
          appUser.name,
          undefined,
          artworkUpload,
          imageFiles
        );

        setUploadProgress(60);
        console.log('Artwork created successfully:', artworkId);
        
        // Fetch the created artwork to get the uploaded image URLs
        setUploadStatus('Finalizing...');
        const createdArtwork = await getArtwork(artworkId);
        
        if (createdArtwork && createdArtwork.images) {
          // Convert images to existing images with server URLs to prevent re-upload on next update
          const existingImagePreviews: ImagePreview[] = createdArtwork.images.map((url, index) => ({
            id: `existing-${index}-${Date.now()}`,
            url,
            isExisting: true,
          }));
          setImages(existingImagePreviews);
        }
        setUploadProgress(80);
      }
      
      if (tipInterval) {
        clearInterval(tipInterval);
      }
      
      setUploadProgress(100);

      // Small delay to show 100%
      await new Promise(resolve => setTimeout(resolve, 500));

      setSavedArtworkId(artworkId);
      toast.success(savedArtworkId ? 'Artwork updated successfully!' : 'Artwork saved to gallery! You can now publish it to feature.');
      
      // Invalidate portfolio cache to reflect changes
      if (appUser) {
        console.log('[Cache] Invalidating portfolio cache after save');
        cache.invalidate(cacheKeys.galleryWorks(appUser.uid));
        cache.invalidate(cacheKeys.artistWorks(appUser.uid));
      }
      
      // Clear unsaved changes flag after successful save
      setHasUnsavedChanges(false);
      
      // Clear draft from localStorage after successful save
      localStorage.removeItem('artworkDraft');
      
    } catch (error: any) {
      console.error('Error saving artwork:', error);
      if (tipInterval) {
        clearInterval(tipInterval);
      }
      toast.error(error.message || 'Failed to save artwork. Please try again.');
    } finally {
      if (tipInterval) {
        clearInterval(tipInterval);
      }
      setIsSaving(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStatus('');
        setCurrentTip('');
      }, 1000);
    }
  };

  const handlePublish = async () => {
    if (!appUser) {
      toast.error('You must be logged in to publish artwork');
      return;
    }

    if (!savedArtworkId) {
      toast.error('Please save to gallery first');
      return;
    }

    setIsPublishing(true);

    try {
      await toggleArtworkPublish(savedArtworkId, true);

      toast.success('Artwork published successfully! It will now appear in Discover.');
      
      // Invalidate all portfolio caches when publishing
      if (appUser) {
        console.log('[Cache] Invalidating all portfolio cache after publish');
        cache.invalidate(cacheKeys.publishedWorks(appUser.uid));
        cache.invalidate(cacheKeys.galleryWorks(appUser.uid));
        cache.invalidate(cacheKeys.artistWorks(appUser.uid));
      }
      
      images.forEach(img => URL.revokeObjectURL(img.url));
      
      // Clear draft from localStorage after successful publish
      localStorage.removeItem('artworkDraft');
      
      setImages([]);
      setFormData({
        title: '',
        description: '',
        createdDate: '',
        category: '',
        medium: '',
        width: '',
        height: '',
        price: '',
        isCommissioned: false,
      });
      setSavedArtworkId(null);

      setTimeout(() => {
        navigate('/portfolio');
      }, 1000);
    } catch (error: any) {
      console.error('Error publishing artwork:', error);
      toast.error(error.message || 'Failed to publish artwork. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const isFormValid = 
    formData.title.trim() && 
    formData.description.trim() && 
    formData.category && 
    formData.medium && 
    formData.width && 
    formData.height && 
    formData.price && 
    images.length > 0;

  return (
    <>
      {/* Loading existing artwork */}
      {isLoadingArtwork && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{ width: '200px', maxWidth: '90%', marginBottom: '2rem' }}>
            <Lottie 
              animationData={artAnimation}
              loop={true}
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          <p style={{ 
            color: 'var(--color-accent)', 
            fontSize: '1.25rem', 
            fontWeight: 600,
          }}>
            Loading Artwork...
          </p>
        </div>
      )}

      {/* Full Screen Loader for Saving */}
      {isSaving && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 31, 42, 0.98)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{ width: '280px', maxWidth: '90%', marginBottom: '2rem' }}>
            <Lottie 
              animationData={artAnimation} 
              loop={true}
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          <p style={{ 
            color: 'var(--color-accent)', 
            fontSize: '1.5rem', 
            fontWeight: 700,
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}>
            {uploadStatus || 'Saving to Gallery...'}
          </p>
          <p style={{ 
            color: 'var(--color-primary)', 
            fontSize: '1.2rem',
            fontWeight: 600,
            marginBottom: '1.5rem',
          }}>
            {uploadProgress}% Complete
          </p>
          <div style={{
            width: '350px',
            maxWidth: '90%',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '2rem',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #2FA4A9, #5FD1D8, #2FA4A9)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite',
              transition: 'width 0.4s ease-out',
              boxShadow: '0 0 20px rgba(95, 209, 216, 0.6)',
            }} />
          </div>
          {currentTip && (
            <div style={{
              maxWidth: '400px',
              width: '90%',
              padding: '1.25rem',
              animation: 'fadeIn 0.5s ease-in',
            }}>
              <p style={{ 
                color: '#5FD1D8',
                fontSize: '1rem',
                lineHeight: '1.6',
                textAlign: 'center',
                margin: 0,
                fontWeight: 500,
              }}>
                {currentTip}
              </p>
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Full Screen Loader for Publishing */}
      {isPublishing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(11, 31, 42, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{ width: '250px', maxWidth: '90%', marginBottom: '2rem' }}>
            <Lottie 
              animationData={publishAnimation} 
              loop={true}
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          <p style={{ 
            color: 'var(--color-accent)', 
            fontSize: '1.25rem', 
            fontWeight: 600,
            marginBottom: '0.5rem'
          }}>
            Publishing to Feature...
          </p>
          <p style={{ color: 'var(--color-primary)', fontSize: '1rem' }}>
            Your artwork will appear in Discover soon
          </p>
        </div>
      )}

      <div className="create-artwork-container">
        <div className="create-artwork-header">
          <p className="create-artwork-subtitle">
            Share your latest creation with the Kalarang community.
          </p>
        </div>

        <div className="create-artwork-form">
          {/* Basic Details Section */}
          <div className="section">
            <h3 className="section-title">Upload Images</h3>
            <div className="upload-section">
              <UploadDropzone
                onFileSelect={handleFileSelect}
                isDragActive={isDragActive}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
              <div>
                <h4 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--color-royal)',
                  marginBottom: '0.5rem',
                }}>
                  Preview ({images.length}/{maxImages})
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1rem', fontStyle: 'italic' }}>
                  Drag images to rearrange their order
                </p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={images.map(img => img.id)}
                    strategy={rectSortingStrategy}
                  >
                    <ImagePreviewGrid
                      images={images}
                      onRemoveImage={handleRemoveImage}
                      maxImages={maxImages}
                    />
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <ArtworkMetadataForm
            formData={formData}
            onFormDataChange={handleFormDataChange}
          />

          {/* Info Message */}
          <div style={{
            margin: '0.5rem 0',
            marginTop: '0rem',
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(95, 209, 216, 0.08), rgba(47, 164, 169, 0.08))',
            borderLeft: '4px solid var(--color-primary)',
            borderRadius: '8px',
          }}>
            <p style={{ 
              color: 'var(--color-text-secondary)', 
              fontSize: '0.95rem',
              lineHeight: '1.6',
              margin: 0,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>💡</span> Feels like your artwork is incomplete? Save to gallery now and publish it later from your Gallery tab. Your work is safely stored and you can update it anytime!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="button-group">
            {/* Clear Draft Button - Only show for new artworks with data that haven't been saved yet */}
            {!editArtworkId && !savedArtworkId && (formData.title || formData.description || images.length > 0) && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
             
                    setFormData({
                      title: '',
                      description: '',
                      createdDate: '',
                      category: '',
                      medium: '',
                      width: '',
                      height: '',
                      price: '',
                      isCommissioned: false,
                    });
                    setImages([]);
                    localStorage.removeItem('artworkDraft');
                    toast.success('Draft cleared');
                  
                }}
                style={{ color: 'var(--color-royal)'}}
              >
                Clear Draft
              </button>
            )}
            
            {/* Show save/update button when there are unsaved changes */}
            {hasUnsavedChanges && (
              <button
                type="button"
                className="button button-outline-green"
                onClick={handleSaveToGallery}
                disabled={isSaving || isPublishing || images.length === 0 || !formData.title.trim()}
              >
                {isSaving ? 'Saving...' : (savedArtworkId ? 'Update Artwork' : 'Save to gallery')}
              </button>
            )}
            
            {!formData.isCommissioned && (
              <button
                type="button"
                className="button button-primary"
                onClick={handlePublish}
                disabled={isPublishing || isSaving || !savedArtworkId || !isFormValid || hasUnsavedChanges}
                style={(!savedArtworkId || !isFormValid || hasUnsavedChanges) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {isPublishing ? 'Publishing...' : 'Publish to feature'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateArtwork;