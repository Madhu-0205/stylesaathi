/**
 * Utility functions for image compression and format conversion.
 */

/**
 * Converts a base64 data URL string into a native Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Invalid data URL string');
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binaryStr = atob(parts[1]);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Compresses an uploaded image file using HTML5 Canvas to a max dimension
 * of ~800px as a JPEG Blob with quality ~0.8.
 */
export async function compressImageToBlob(
  file: File,
  maxDimension = 800,
  quality = 0.8
): Promise<Blob> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  // File size limit: 15MB
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image size is too large (maximum 15MB)');
  }

  return new Promise<Blob>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          // Scale calculation
          const scale = Math.min(1, maxDimension / Math.max(width, height));
          const targetWidth = Math.round(width * scale);
          const targetHeight = Math.round(height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context could not be created'));
            return;
          }

          // Soft off-white backdrop so transparent PNGs/WebPs look clean on warm neutral cards
          ctx.fillStyle = '#F8F5F0';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          if (canvas.toBlob) {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  // Fallback via dataUrl if toBlob returns null
                  try {
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrlToBlob(dataUrl));
                  } catch (e) {
                    reject(new Error('Failed to create image blob'));
                  }
                }
              },
              'image/jpeg',
              quality
            );
          } else {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrlToBlob(dataUrl));
          }
        } catch (err) {
          reject(new Error('Failed to process and compress image'));
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image file into memory'));
      };

      img.src = String(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Backward-compatible helper returning base64 data URL string.
 */
export async function compressImage(
  file: File,
  maxDimension = 800,
  quality = 0.78
): Promise<string> {
  const blob = await compressImageToBlob(file, maxDimension, quality);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}
