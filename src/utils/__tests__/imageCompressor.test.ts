import { describe, it, expect } from 'vitest';
import { dataUrlToBlob, compressImageToBlob } from '../imageCompressor';

describe('Image Compressor Utilities', () => {
  // 1x1 PNG data URL
  const sampleDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  describe('dataUrlToBlob', () => {
    it('correctly converts a valid base64 data URL into a Blob', () => {
      const blob = dataUrlToBlob(sampleDataUrl);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('throws on an invalid data URL', () => {
      expect(() => dataUrlToBlob('invalid-string')).toThrow('Invalid data URL');
    });
  });

  describe('compressImageToBlob input validation', () => {
    it('rejects files that are not images', async () => {
      const textFile = new File(['hello world'], 'test.txt', { type: 'text/plain' });
      await expect(compressImageToBlob(textFile)).rejects.toThrow('Selected file is not an image');
    });

    it('rejects image files exceeding 15MB', async () => {
      const hugeFile = new File([new ArrayBuffer(16 * 1024 * 1024)], 'huge.jpg', {
        type: 'image/jpeg',
      });
      await expect(compressImageToBlob(hugeFile)).rejects.toThrow('Image size is too large');
    });
  });
});
