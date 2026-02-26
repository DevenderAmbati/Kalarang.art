import React, { useState, useCallback, useRef } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { BsX, BsUpload } from 'react-icons/bs';
import './AvatarCropModal.css';

interface AvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedImageUrl: string) => void;
  currentAvatarUrl?: string;
}

const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentAvatarUrl,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avatar is always 1:1 (square)
  const aspectRatio = 1;

  // Load current avatar when modal opens
  React.useEffect(() => {
    if (isOpen && currentAvatarUrl) {
      setImageSrc(currentAvatarUrl);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [isOpen, currentAvatarUrl]);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedArea);
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

    // Match the canvas size exactly to the crop area dimensions
    // This ensures 1:1 mapping with what user sees
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Clear canvas
    ctx.clearRect(0, 0, pixelCrop.width, pixelCrop.height);

    // Create circular clipping path
    ctx.beginPath();
    ctx.arc(pixelCrop.width / 2, pixelCrop.height / 2, pixelCrop.width / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Draw the exact cropped portion at 1:1 scale
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
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
      }, 'image/png', 1.0); // Maximum quality
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
    <div className="avatar-crop-modal-overlay" onClick={onClose}>
      <div className="avatar-crop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="avatar-crop-modal-header">
          <h2>Edit Avatar</h2>
          <button className="avatar-crop-close-btn" onClick={onClose}>
            {(BsX as any)({ size: 24 })}
          </button>
        </div>

        <div className="avatar-crop-content">
          {imageSrc ? (
            <div className="avatar-crop-container">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                objectFit="cover"
                showGrid={false}
                cropShape="round"
                cropSize={{ width: 300, height: 300 }}
                style={{
                  containerStyle: {
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#000',
                  },
                  cropAreaStyle: {
                    border: 'none',
                  },
                }}
                restrictPosition={false}
              />
              {/* SVG Overlay with circular cutout */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <mask id="circleMask">
                    <rect width="100" height="100" fill="white" />
                    <circle cx="50" cy="50" r="28" fill="black" />
                  </mask>
                </defs>
                {/* Overlay with circular hole */}
                <rect
                  width="100"
                  height="100"
                  fill="rgba(0, 0, 0, 0.55)"
                  mask="url(#circleMask)"
                />
                {/* Circle border */}
                <circle
                  cx="50"
                  cy="50"
                  r="28"
                  fill="none"
                  stroke="#22d5c0"
                  strokeWidth="0.8"
                />
              </svg>
            </div>
          ) : (
            <div className="avatar-crop-placeholder">
              {(BsUpload as any)({ size: 48 })}
              <p>Choose an image to get started</p>
            </div>
          )}

          {imageSrc && (
            <div className="avatar-crop-zoom-control">
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

        <div className="avatar-crop-modal-footer">
          <button className="avatar-crop-btn avatar-crop-btn-secondary" onClick={handleChooseFile}>
            {(BsUpload as any)({ size: 18 })}
            Choose File
          </button>
          <button
            className="avatar-crop-btn avatar-crop-btn-primary"
            onClick={handleSave}
            disabled={!imageSrc || !croppedAreaPixels}
          >
            Save Avatar
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

export default AvatarCropModal;
