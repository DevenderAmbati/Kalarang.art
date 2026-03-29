import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/webp',
};

/**
 * Compress an image file before upload
 * Skips compression if file is already under 1MB
 * Converts to WebP format for 30% better compression than JPEG
 */
export async function compressImage(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<File> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  
  // Skip compression if already under 1MB
  if (file.size < 1 * 1024 * 1024) {
    // Still convert to File if it's a Blob
    if (file instanceof Blob && !(file instanceof File)) {
      return new File([file], 'image.webp', { type: file.type });
    }
    return file as File;
  }

  try {
    const compressedFile = await imageCompression(file as File, {
      maxSizeMB: mergedOptions.maxSizeMB!,
      maxWidthOrHeight: mergedOptions.maxWidthOrHeight!,
      useWebWorker: mergedOptions.useWebWorker!,
      fileType: mergedOptions.fileType,
    });

    return compressedFile;
  } catch (error) {
    // Return original file if compression fails
    if (file instanceof Blob && !(file instanceof File)) {
      return new File([file], 'image.webp', { type: file.type });
    }
    return file as File;
  }
}

/**
 * Compress multiple image files in parallel
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {}
): Promise<File[]> {
  return Promise.all(files.map(file => compressImage(file, options)));
}

/**
 * Chat attachments: high max dimension and size so downloads stay sharp;
 * JPEG output for broad compatibility (browser-image-compression).
 */
export async function compressChatImage(file: File): Promise<File> {
  return compressImage(file, {
    maxSizeMB: 8,
    maxWidthOrHeight: 4096,
    useWebWorker: true,
    fileType: 'image/jpeg',
  });
}

/**
 * Get compressed file size info for logging/debugging
 */
export function getCompressionStats(original: File, compressed: File): {
  originalSize: string;
  compressedSize: string;
  savings: string;
  savingsPercent: number;
} {
  const originalSize = original.size;
  const compressedSize = compressed.size;
  const savings = originalSize - compressedSize;
  const savingsPercent = Math.round((savings / originalSize) * 100);

  return {
    originalSize: formatBytes(originalSize),
    compressedSize: formatBytes(compressedSize),
    savings: formatBytes(savings),
    savingsPercent,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
