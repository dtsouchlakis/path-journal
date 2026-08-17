import { Camera, MediaTypeSelection, type MediaResult } from '@capacitor/camera';
import { Capacitor, registerPlugin } from '@capacitor/core';

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_EDGE = 800;
const WEBP_QUALITY = 0.72;

const isHeifImage = (blob: Blob, name = '', format = '') =>
  ['image/heic', 'image/heif'].includes(blob.type.toLowerCase()) ||
  /\.(heic|heif)$/i.test(name) ||
  ['heic', 'heif'].includes(format.toLowerCase());

const decodeImage = (blob: Blob) => new Promise<{ image: HTMLImageElement; objectUrl: string }>((resolve, reject) => {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => resolve({ image, objectUrl });
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Image decode failed'));
  };
  image.src = objectUrl;
});

export async function optimizePhoto(input: Blob, name = '', format = ''): Promise<Blob> {
  if (input.size > MAX_INPUT_BYTES) throw new Error('Please choose an image smaller than 20 MB');

  let source = input;
  if (isHeifImage(input, name, format)) {
    // libheif is the largest web dependency. Loading it only for HEIF keeps the
    // normal camera path faster and reduces startup memory.
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: input, toType: 'image/jpeg', quality: 0.86 });
    source = Array.isArray(converted) ? converted[0] : converted;
  }

  const { image, objectUrl } = await decodeImage(source);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      // toBlob avoids the extra base64 string and byte-array copies created by toDataURL.
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image compression failed')), 'image/webp', WEBP_QUALITY);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function mediaResultToBlob(result?: MediaResult) {
  if (!result?.webPath) throw new Error('The selected photo has no readable path');
  const response = await fetch(result.webPath);
  if (!response.ok) throw new Error('The selected photo could not be opened');
  return {
    blob: await response.blob(),
    format: result.metadata?.format ?? '',
  };
}

export type NativePhoto = { path?: string; mimeType?: string };

type DaymarkCameraPlugin = {
  takePhoto: () => Promise<NativePhoto>;
  getPendingPhoto: () => Promise<NativePhoto>;
  acknowledgePhoto: () => Promise<void>;
};

const daymarkCamera = registerPlugin<DaymarkCameraPlugin>('DaymarkCamera');

export const takeNativePhoto = () => daymarkCamera.takePhoto();

export const getPendingNativePhoto = () => daymarkCamera.getPendingPhoto();

export const acknowledgeNativePhoto = () => daymarkCamera.acknowledgePhoto();

export async function nativePhotoToBlob(photo: NativePhoto) {
  if (!photo.path) throw new Error('The captured photo path was lost');
  const response = await fetch(Capacitor.convertFileSrc(photo.path));
  if (!response.ok) throw new Error('The captured photo could not be opened');
  return response.blob();
}

export const chooseNativePhoto = () => Camera.chooseFromGallery({
  mediaType: MediaTypeSelection.Photo,
  allowMultipleSelection: false,
  includeMetadata: true,
  quality: 72,
  targetWidth: 900,
  targetHeight: 900,
  correctOrientation: true,
});

export const wasPhotoSelectionCancelled = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|canceled|cancelled|no image selected/i.test(message);
};
