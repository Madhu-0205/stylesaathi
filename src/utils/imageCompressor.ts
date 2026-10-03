/**
 * Client-side image compressor using HTML5 Canvas.
 * Resizes max dimension to ~800px and exports JPEG at 0.78 quality.
 */
export async function compressImage(file: File, maxDimension = 800, quality = 0.78): Promise<string> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Selected file is not an image');
  }

  // File size limit: 15MB
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image size is too large (maximum 15MB)');
  }

  return new Promise<string>((resolve, reject) => {
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

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
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
