import { ref, uploadBytes, getDownloadURL, UploadMetadata } from 'firebase/storage';
import { storage } from '../firebase';
import { compressChatImage } from '../utils/imageCompression';

const CHAT_IMAGE_MAX_BYTES = 12 * 1024 * 1024; // 12 MB raw file limit before client-side handling

/**
 * Uploads a chat attachment to Storage under the sender's namespace.
 * Path: chat_images/{userId}/{scope}/{chatId}/{filename}
 */
export async function uploadChatMessageImage(
  userId: string,
  scope: 'chats' | 'commissionChats',
  chatId: string,
  file: File,
  hd = false,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.');
  }
  if (file.size > CHAT_IMAGE_MAX_BYTES) {
    throw new Error('Image is too large (max 12 MB).');
  }

  const processed = await compressChatImage(file, hd);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const ext = processed.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
  const filename = `${timestamp}_${random}.${safeExt}`;
  const storageRef = ref(storage, `chat_images/${userId}/${scope}/${chatId}/${filename}`);

  const contentType = processed.type || 'image/jpeg';
  const metadata: UploadMetadata = {
    contentType,
    cacheControl: 'public, max-age=31536000',
  };

  await uploadBytes(storageRef, processed, metadata);
  return getDownloadURL(storageRef);
}
