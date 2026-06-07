import { getBlob, ref } from 'firebase/storage';
import { storage } from '../firebase';

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Downloads a Firebase Storage image at full quality.
 *
 * The Storage REST endpoint only returns CORS headers if the **bucket** has a CORS
 * config (see `storage-cors.json` in the repo — apply with `gsutil cors set`).
 * Until then, `getBlob` may fail in the browser; we fall back to opening the URL
 * in a new tab so the user can save the image (Save image as…).
 */
export async function downloadImageFromUrl(url: string, filename: string): Promise<void> {
  try {
    const storageRef = ref(storage, url);
    const blob = await getBlob(storageRef);
    triggerBlobDownload(blob, filename);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function suggestedChatImageFilename(prefix: string, mimeHint?: string): string {
  const ext =
    mimeHint === 'image/png'
      ? 'png'
      : mimeHint === 'image/webp'
        ? 'webp'
        : mimeHint === 'image/gif'
          ? 'gif'
          : 'jpg';
  return `${prefix}-${Date.now()}.${ext}`;
}
