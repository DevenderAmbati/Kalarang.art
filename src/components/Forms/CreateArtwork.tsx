import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MdInfoOutline } from 'react-icons/md';
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
import ArtworkMetadataForm, { ArtworkFormData, ArtworkFormErrors } from './ArtworkMetadataForm';
import { useAuth } from '../../context/AuthContext';
import { createArtwork, toggleArtworkPublish, getArtwork, updateArtwork, uploadArtworkImages, uploadSingleArtworkImage, deleteArtworkImagesByUrls, createArtworkWithUrls } from '../../services/artworkService';
import { cache, cacheKeys } from '../../utils/cache';
import artAnimation from '../../animations/Line art (1).json';
import publishAnimation from '../../animations/Line art (2).json';
import './CreateArtwork.css';

interface ImagePreview {
  id: string;
  file?: File;
  url: string; // Local blob URL or Firebase URL
  firebaseUrl?: string; // Firebase Storage URL after upload
  isExisting?: boolean;
  isUploading?: boolean;
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
  const [showPublishErrors, setShowPublishErrors] = useState(false);
  const [savedArtworkId, setSavedArtworkId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [currentTip, setCurrentTip] = useState('');
  const [isLoadingArtwork, setIsLoadingArtwork] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true); // Start with true for new artworks
  const [showUploadGuidelinesTooltip, setShowUploadGuidelinesTooltip] = useState(false);
  const uploadGuidelinesRef = useRef<HTMLDivElement>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showUpiRequiredModal, setShowUpiRequiredModal] = useState(false);
  const [isArtworkPublished, setIsArtworkPublished] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  // Track Firebase URLs of newly uploaded images (not yet saved to gallery) for potential cleanup
  const uploadedImageUrlsRef = useRef<string[]>([]);
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

  const lottieRef = useRef<any>(null);

  // Close upload guidelines tooltip when clicking outside
  useEffect(() => {
    if (!showUploadGuidelinesTooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (uploadGuidelinesRef.current && !uploadGuidelinesRef.current.contains(e.target as Node)) {
        setShowUploadGuidelinesTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUploadGuidelinesTooltip]);

  useEffect(() => {
    if (!isLoadingArtwork && !isSaving && !isPublishing) return;
    const t = setTimeout(() => lottieRef.current?.setSpeed(2), 50);
    return () => clearTimeout(t);
  }, [isLoadingArtwork, isSaving, isPublishing]);

  const maxImages = 4;

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
        // Restore images from Firebase URLs
        if (draft.images && Array.isArray(draft.images) && draft.images.length > 0) {
          const restoredImages: ImagePreview[] = draft.images.map((img: any) => ({
            id: img.id,
            url: img.firebaseUrl, // Use Firebase URL for display
            firebaseUrl: img.firebaseUrl,
            isExisting: false, // Mark as not existing in DB yet
          }));
          setImages(restoredImages);
          // Track these URLs for potential cleanup
          uploadedImageUrlsRef.current = draft.images.map((img: any) => img.firebaseUrl);
        }
      } catch (error) {
        // Silently fail
      }
    }
  }, [editArtworkId]);

  // Check if there's unsaved content worth prompting about
  const hasUnsavedContent = !editArtworkId && !savedArtworkId && !!(
    formData.title || formData.description || formData.category || 
    formData.medium || formData.createdDate || formData.width || 
    formData.height || formData.price || images.length > 0
  );

  // Save draft function - called manually or when navigating away
  const saveDraft = useCallback(() => {
    if (editArtworkId) return; // Don't save draft if editing existing artwork

    const hasData = formData.title || formData.description || formData.category || 
                     formData.medium || formData.createdDate || formData.width || 
                     formData.height || formData.price;
    
    if (!hasData && images.length === 0) {
      localStorage.removeItem('artworkDraft');
      return;
    }

    try {
      // Save images with their Firebase URLs
      const imagesToSave = images
        .filter(img => img.firebaseUrl) // Only save images that have been uploaded to Firebase
        .map(img => ({
          id: img.id,
          firebaseUrl: img.firebaseUrl,
        }));

      const draft = {
        formData,
        images: imagesToSave,
        timestamp: Date.now(),
      };
      
      localStorage.setItem('artworkDraft', JSON.stringify(draft));
    } catch (error) {
      // Silently fail
    }
  }, [formData, images, editArtworkId]);

  // Track if we're allowing navigation (after user confirms)
  const allowNavigationRef = useRef(false);

  // Handle browser close/refresh with beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedContent) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedContent]);

  // Intercept browser back/forward navigation
  useEffect(() => {
    if (!hasUnsavedContent) return;

    // Push a dummy state so we can intercept back navigation
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }
      // Push state again to prevent navigation
      window.history.pushState(null, '', window.location.href);
      // Show modal
      setShowDraftModal(true);
      setPendingNavigation(() => () => {
        allowNavigationRef.current = true;
        window.history.back();
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasUnsavedContent]);

  // Intercept link clicks for internal navigation
  useEffect(() => {
    if (!hasUnsavedContent) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      
      // Internal link - intercept it
      e.preventDefault();
      e.stopPropagation();
      
      setShowDraftModal(true);
      setPendingNavigation(() => () => navigate(href));
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedContent, navigate]);

  // Handle save draft from modal
  const handleSaveDraftAndLeave = () => {
    saveDraft();
    setShowDraftModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Handle cancel/discard from modal - delete uploaded images in background
  const handleDiscardAndLeave = () => {
    // Delete uploaded images in background (only those not yet saved to gallery)
    const urlsToDelete = uploadedImageUrlsRef.current.filter(url => url);
    if (urlsToDelete.length > 0) {
      // Fire and forget - delete in background
      deleteArtworkImagesByUrls(urlsToDelete).catch(() => {
        // Silently fail
      });
    }
    
    localStorage.removeItem('artworkDraft');
    uploadedImageUrlsRef.current = [];
    setShowDraftModal(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  // Handle cancel from modal (stay on page)
  const handleCancelNavigation = () => {
    setShowDraftModal(false);
    setPendingNavigation(null);
  };

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
        setIsArtworkPublished(artwork.published || false);
      } catch (error) {
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
    isUploading: true, // Start with uploading state
  });

  const handleFileSelect = useCallback(async (files: File[]) => {
    if (!appUser) {
      toast.error('You must be logged in to upload images');
      return;
    }

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const totalCurrentImages = images.length;
    const remainingSlots = maxImages - totalCurrentImages;
    const filesToAdd = imageFiles.slice(0, remainingSlots);
    
    if (filesToAdd.length === 0) return;

    // Create previews with uploading state
    const newPreviews = filesToAdd.map(createImagePreview);
    setImages(prev => [...prev, ...newPreviews]);
    setIsDragActive(false);

    // Upload each image to Firebase immediately
    for (let i = 0; i < newPreviews.length; i++) {
      const preview = newPreviews[i];
      const file = filesToAdd[i];
      
      try {
        const firebaseUrl = await uploadSingleArtworkImage(appUser.uid, file);
        
        // Update the image with Firebase URL and remove uploading state
        setImages(prev => prev.map(img => 
          img.id === preview.id 
            ? { ...img, firebaseUrl, isUploading: false, url: firebaseUrl }
            : img
        ));
        
        // Track the URL for potential cleanup
        uploadedImageUrlsRef.current.push(firebaseUrl);
      } catch (error) {
        toast.error(`Failed to upload image ${i + 1}`);
        // Remove the failed image from the list
        setImages(prev => prev.filter(img => img.id !== preview.id));
        // Clean up blob URL
        URL.revokeObjectURL(preview.url);
      }
    }

    // Mark as having unsaved changes when editing or after initial save
    if (editArtworkId || savedArtworkId) {
      setHasUnsavedChanges(true);
    }
  }, [images.length, maxImages, editArtworkId, savedArtworkId, appUser]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages(prev => {
      const removedImage = prev.find(img => img.id === id);
      const updated = prev.filter(img => img.id !== id);
      
      if (removedImage) {
        // Clean up blob URL for new images
        if (!removedImage.isExisting && removedImage.file) {
          URL.revokeObjectURL(removedImage.url);
        }
        
        // If image has Firebase URL and hasn't been saved to gallery yet, delete from storage
        if (removedImage.firebaseUrl && !savedArtworkId && !removedImage.isExisting) {
          // Remove from tracking array
          uploadedImageUrlsRef.current = uploadedImageUrlsRef.current.filter(
            url => url !== removedImage.firebaseUrl
          );
          // Delete from Firebase in background
          deleteArtworkImagesByUrls([removedImage.firebaseUrl]).catch(() => {
            // Silently fail
          });
        }
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
        setUploadStatus('Updating artwork...');
        setUploadProgress(10);
        
        // Reconstruct images array maintaining the order
        // For new images with firebaseUrl (pre-uploaded), use that
        // For existing images, use their current URL
        // For new images without firebaseUrl but with file (legacy/fallback), upload them
        const allImageUrls: string[] = [];
        const imagesToUpload: { index: number; file: File }[] = [];
        
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          if (img.isExisting) {
            allImageUrls.push(img.url);
          } else if (img.firebaseUrl) {
            // Already uploaded via immediate upload flow
            allImageUrls.push(img.firebaseUrl);
          } else if (img.file) {
            // Fallback: needs to be uploaded
            imagesToUpload.push({ index: i, file: img.file });
            allImageUrls.push(''); // Placeholder
          }
        }
        
        // Upload any images that weren't pre-uploaded (fallback case)
        if (imagesToUpload.length > 0) {
          setUploadStatus(`Uploading ${imagesToUpload.length} new image${imagesToUpload.length > 1 ? 's' : ''}...`);
          const files = imagesToUpload.map(item => item.file);
          const uploadedUrls = await uploadArtworkImages(appUser.uid, files);
          
          // Fill in the placeholders
          for (let j = 0; j < imagesToUpload.length; j++) {
            allImageUrls[imagesToUpload[j].index] = uploadedUrls[j];
          }
        }
        
        setUploadProgress(60);

        setUploadStatus('Saving changes...');
        setUploadProgress(70);

        await updateArtwork(savedArtworkId, {
          ...artworkUpload,
          images: allImageUrls,
        } as any);

        artworkId = savedArtworkId;
        
        // Convert all images to existing after update to prevent re-upload
        setUploadStatus('Finalizing...');
        const existingImagePreviews: ImagePreview[] = allImageUrls.map((url, index) => ({
          id: `existing-${index}-${Date.now()}`,
          url,
          firebaseUrl: url,
          isExisting: true,
        }));
        setImages(existingImagePreviews);
        setUploadProgress(80);
      } else {
        // Create new artwork using pre-uploaded Firebase URLs
        // Images are already uploaded when added, so use their firebaseUrls
        const imageUrls = images
          .filter(img => img.firebaseUrl)
          .map(img => img.firebaseUrl!);
        
        if (imageUrls.length === 0) {
          throw new Error('No images have been uploaded. Please wait for images to finish uploading.');
        }
        
        setUploadStatus('Creating artwork...');
        setUploadProgress(40);
        
        artworkId = await createArtworkWithUrls(
          appUser.uid,
          appUser.name,
          undefined,
          artworkUpload,
          imageUrls
        );

        setUploadProgress(60);
        
        // Convert images to existing images with server URLs to prevent issues on next update
        setUploadStatus('Finalizing...');
        const existingImagePreviews: ImagePreview[] = imageUrls.map((url, index) => ({
          id: `existing-${index}-${Date.now()}`,
          url,
          firebaseUrl: url,
          isExisting: true,
        }));
        setImages(existingImagePreviews);
        setUploadProgress(80);
      }
      
      if (tipInterval) {
        clearInterval(tipInterval);
      }
      
      setUploadProgress(100);

      // Small delay to show 100%
      await new Promise(resolve => setTimeout(resolve, 500));

      setSavedArtworkId(artworkId);
      
      toast.success('✅ Saved to gallery');
      
      // Invalidate portfolio cache to reflect changes
      if (appUser) {
        cache.invalidate(cacheKeys.galleryWorks(appUser.uid));
        cache.invalidate(cacheKeys.artistWorks(appUser.uid));
      }
      
      // Clear unsaved changes flag after successful save
      setHasUnsavedChanges(false);
      
      // Clear draft from localStorage after successful save
      localStorage.removeItem('artworkDraft');
      
      // Clear uploaded images tracking since they are now saved to gallery
      uploadedImageUrlsRef.current = [];
      
    } catch (error: any) {
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

    if (!isFormValid) {
      setShowPublishErrors(true);
      return;
    }

    if (!savedArtworkId) {
      toast.error('Please save to gallery first');
      return;
    }

    // Check if UPI ID is configured
    if (!appUser.upiId || appUser.upiId.trim() === '') {
      setShowUpiRequiredModal(true);
      return;
    }

    await executePublish();
  };

  const executePublish = async () => {
    if (!appUser || !savedArtworkId) return;

    setIsPublishing(true);

    try {
      await toggleArtworkPublish(savedArtworkId, true);

      toast.success('✅ Published');
      
      // Mark artwork as published
      setIsArtworkPublished(true);
      
      // Invalidate all portfolio caches when publishing
      if (appUser) {
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
      setIsArtworkPublished(false);

      setTimeout(() => {
        navigate('/portfolio');
      }, 1000);
    } catch (error: any) {
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

  const publishValidationErrors: ArtworkFormErrors & { images?: string } = {
    images: images.length === 0 ? 'At least one image is required' : '',
    title: !formData.title.trim() ? 'Title is required' : '',
    description: !formData.description.trim() ? 'Description is required' : '',
    category: !formData.category ? 'Category is required' : '',
    medium: !formData.medium ? 'Medium is required' : '',
    width: !formData.width ? 'Width is required' : '',
    height: !formData.height ? 'Height is required' : '',
    price: !formData.price ? 'Price is required' : '',
  };

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
          background: '#ffffff',
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
              lottieRef={lottieRef}
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
          <p style={{ 
            color: 'var(--color-primary)', 
            fontSize: '1.25rem', 
            fontWeight: 400,
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
              lottieRef={lottieRef}
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
              lottieRef={lottieRef}
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
          <div className="create-artwork-header-left">
            <p className="create-artwork-subtitle">
              Upload and share your creations.
            </p>
          </div>
          <div ref={uploadGuidelinesRef} className="upload-guidelines-trigger">
            <button
              type="button"
              onClick={() => setShowUploadGuidelinesTooltip((prev) => !prev)}
              className="upload-guidelines-btn"
              aria-label="Upload guidelines"
              aria-expanded={showUploadGuidelinesTooltip}
            >
              {MdInfoOutline({ size: 18 })}
              <span>Guidelines</span>
            </button>
            {showUploadGuidelinesTooltip && (
              <div className="upload-guidelines-tooltip" role="tooltip" id="upload-guidelines-tooltip">
                <div className="upload-guidelines-tooltip-title">Guidelines to upload art</div>
                <ul className="upload-guidelines-tooltip-list">
                  <li>Upload only <strong>original artwork</strong> created by you.</li>
                  <li>Do not upload copied, AI-generated, or copyrighted content you don't own.</li>
                  <li>Avoid heavy filters or excessive editing. Show the artwork as it truly is.</li>
                  <li>Photograph your artwork in <strong>natural lighting</strong> with a clear background.</li>
                  <li>Ensure the image is <strong>high resolution</strong> and not blurry.</li>
                  <li>Not ready to sell it? You can still upload, it will be saved to your gallery. You can edit and publish to Discover anytime later.</li>
                  <li>Use a <strong>title and description</strong> that match your art so it’s easy to find in Discover.</li>
                  <li>When publishing your work, include accurate <strong>pricing</strong>, <strong>category</strong>, <strong>medium</strong>, and <strong>size</strong>.</li>
                </ul>
              </div>
            )}
          </div>
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
            {showPublishErrors && publishValidationErrors.images && (
              <span className="field-error">{publishValidationErrors.images}</span>
            )}
          </div>

          {/* Form Fields */}
          <ArtworkMetadataForm
            formData={formData}
            onFormDataChange={handleFormDataChange}
            errors={showPublishErrors ? publishValidationErrors : {}}
          />

          {/* Info Message */}
          <div className="gallery-hint-box" style={{
            margin: '0.5rem 0',
            marginTop: '0rem',
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(95, 209, 216, 0.08), rgba(47, 164, 169, 0.08))',
            borderLeft: '4px solid var(--color-primary)',
            borderRadius: '8px',
          }}>
            <p className="gallery-hint-text" style={{ 
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
            {/* Save/update button - always visible, disabled when no changes */}
            <button
              type="button"
              className="button button-outline-green"
              onClick={handleSaveToGallery}
              disabled={!hasUnsavedChanges || isSaving || isPublishing || images.length === 0 || !formData.title.trim() || images.some(img => img.isUploading)}
              style={!hasUnsavedChanges ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {images.some(img => img.isUploading)
                ? 'Uploading images...'
                : isSaving
                  ? 'Saving...'
                  : savedArtworkId
                    ? 'Update Artwork'
                    : 'Save to gallery'}
            </button>
            
            {!formData.isCommissioned && !hasUnsavedChanges && !isArtworkPublished && (
              <button
                type="button"
                className="button button-primary"
                onClick={handlePublish}
                disabled={isPublishing || isSaving || images.some(img => img.isUploading)}
              >
                {isPublishing ? 'Publishing...' : 'Publish to feature'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* UPI Required Modal - shown when trying to publish without UPI ID */}
      {showUpiRequiredModal && (
        <div 
          className="confirm-modal-overlay" 
          onClick={() => setShowUpiRequiredModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            className="confirm-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '360px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              position: 'relative',
            }}
          >
            {/* Icon */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(47, 164, 169, 0.1)',
              color: 'var(--color-accent, #2fa4a9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            
            <h2 style={{ 
              margin: '0 0 0.75rem', 
              fontSize: '1.25rem',
              color: '#1a1a1a',
              textAlign: 'center',
            }}>
              UPI ID Required
            </h2>
            <p style={{ 
              margin: '0 0 1.5rem', 
              color: '#666666',
              lineHeight: 1.5,
              textAlign: 'center',
            }}>
              Update your UPI ID in profile so that buyers can directly transfer money to you.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="button button-primary"
                onClick={() => {
                  saveDraft();
                  setShowUpiRequiredModal(false);
                  navigate('/profile');
                }}
                style={{ flex: 1 }}
              >
                Go to Profile
              </button>
              <button
                className="button button-outline"
                onClick={async () => {
                  setShowUpiRequiredModal(false);
                  await executePublish();
                }}
                style={{ flex: 1 }}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Save Modal - shown when navigating away with unsaved content */}
      {showDraftModal && (
        <div 
          className="confirm-modal-overlay" 
          onClick={handleCancelNavigation}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div 
            className="confirm-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '320px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={handleCancelNavigation}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666666',
                padding: '0',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
            <h2 style={{ 
              margin: '0 0 0.75rem', 
              fontSize: '1.25rem',
              color: '#1a1a1a',
              paddingRight: '2rem',
            }}>
              Unsaved Changes
            </h2>
            <p style={{ 
              margin: '0 0 1.5rem', 
              color: '#666666',
              lineHeight: 1.5,
            }}>
              You have unsaved work. Would you like to save it as a draft?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="button button-primary"
                onClick={handleSaveDraftAndLeave}
                disabled={images.some(img => img.isUploading)}
                style={{ flex: 1 }}
              >
                {images.some(img => img.isUploading) ? 'Wait...' : 'Save Draft'}
              </button>
              <button
                className="button button-outline"
                onClick={handleDiscardAndLeave}
                style={{ flex: 1, color: 'var(--color-error)' }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateArtwork;