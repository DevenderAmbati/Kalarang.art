import React, { useState, useCallback, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { BsX, BsUpload } from 'react-icons/bs';
import './BannerCropModal.css';

interface BannerCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedImageUrl: string) => void;
  currentBannerUrl?: string;
}

const BannerCropModal: React.FC<BannerCropModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentBannerUrl,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the aspect ratio based on screen width
  const getAspectRatio = (): number => {
    const width = window.innerWidth;
    if (width <= 480) {
      return 2.5 / 1; // Mobile
    } else if (width <= 768) {
      return 2.5 / 1; // Tablet Small
    } else if (width <= 1024) {
      return 3.5 / 1; // Tablet Large
    } else {
      return 4.5 / 1; // Desktop
    }
  };

  const [aspectRatio] = useState<number>(getAspectRatio());

  // Load current banner when modal opens
  React.useEffect(() => {
    if (isOpen && currentBannerUrl) {
      setImageSrc(currentBannerUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [isOpen, currentBannerUrl]);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
      });
      reader.readAsDataURL(file);
    }
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Calculate target dimensions based on current aspect ratio
    // This ensures the output matches what user sees in preview
    const targetWidth = 1800; // High quality output
    const targetHeight = Math.round(targetWidth / aspectRatio);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Draw the cropped image scaled to target dimensions
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // Convert canvas to blob with high quality
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        const fileUrl = URL.createObjectURL(blob);
        resolve(fileUrl);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      return;
    }

    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onSave(croppedImage);
      onClose();
    } catch (e) {
      console.error('Error cropping image:', e);
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="banner-crop-modal-overlay" onClick={onClose}>
      <div className="banner-crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="banner-crop-modal-header">
          <h2>Edit Banner</h2>
          <button className="banner-crop-close-btn" onClick={onClose}>
            {(BsX as any)({ size: 24 })}
          </button>
        </div>

        <div className="banner-crop-content">
          {imageSrc ? (
            <div className="banner-crop-container">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                objectFit="horizontal-cover"
                showGrid={false}
                cropShape="rect"
                style={{
                  containerStyle: {
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#000',
                  },
                  cropAreaStyle: {
                    border: '2px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: 'none',
                  },
                  mediaStyle: {
                    opacity: 1,
                  },
                }}
                classes={{
                  containerClassName: 'custom-cropper-container',
                  cropAreaClassName: 'custom-crop-area',
                }}
              />
            </div>
          ) : (
            <div className="banner-crop-placeholder">
              {(BsUpload as any)({ size: 48 })}
              <p>Choose an image to get started</p>
            </div>
          )}

          {imageSrc && (
            <div className="banner-crop-zoom-control">
              <label>Zoom</label>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </div>
          )}
        </div>

        <div className="banner-crop-modal-footer">
          <button className="banner-crop-btn banner-crop-btn-secondary" onClick={handleChooseFile}>
            {(BsUpload as any)({ size: 18 })}
            Choose File
          </button>
          <button
            className="banner-crop-btn banner-crop-btn-primary"
            onClick={handleSave}
            disabled={!imageSrc || !croppedAreaPixels}
          >
            Save Banner
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default BannerCropModal;
