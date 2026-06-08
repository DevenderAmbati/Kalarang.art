import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';

export type FreeSketchCopyType = 'physical' | 'digital';

export interface FreeSketchRequestInput {
  name: string;
  whatsapp: string;
  orderId: string;
  copyType: FreeSketchCopyType;
  address?: string;
  pincode?: string;
}

const SAFE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

async function uploadImage(
  requestId: string,
  kind: 'reference' | 'payment',
  file: File,
): Promise<string> {
  const rawExt = file.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? 'jpg';
  const ext = SAFE_EXTENSIONS.includes(rawExt) ? rawExt : 'jpg';
  const path = `freeSketch/${requestId}/${kind}.${ext}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: 'private, max-age=300',
  });
  return path;
}

export async function submitFreeSketchRequest(
  input: FreeSketchRequestInput,
  referenceImage: File,
  paymentScreenshot: File | null,
): Promise<string> {
  const requestId = doc(collection(db, 'freeSketchRequests')).id;

  const referenceImagePath = await uploadImage(requestId, 'reference', referenceImage);

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    whatsapp: input.whatsapp.trim(),
    orderId: input.orderId.trim(),
    copyType: input.copyType,
    referenceImagePath,
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  if (input.copyType === 'physical') {
    if (!paymentScreenshot) throw new Error('Payment screenshot is required');
    const paymentScreenshotPath = await uploadImage(requestId, 'payment', paymentScreenshot);
    payload.address = (input.address ?? '').trim();
    payload.pincode = (input.pincode ?? '').trim();
    payload.paymentScreenshotPath = paymentScreenshotPath;
  }

  await setDoc(doc(db, 'freeSketchRequests', requestId), payload);
  return requestId;
}
