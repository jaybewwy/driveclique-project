/**
 * Compresses an image file to a base64 data URL.
 *
 * Strategy:
 *  1. Resize to fit within maxWidth × maxHeight (preserving aspect ratio).
 *  2. Try WebP encoding first (smaller at equal quality); fall back to JPEG.
 *  3. Start at `quality` and step down by 0.05 until the output is ≤ MAX_SIZE_KB,
 *     but never below MIN_QUALITY — so quality is only reduced when actually needed.
 *
 * @param {File}   file      - The image file to compress.
 * @param {number} maxWidth  - Max output width in pixels (default 500).
 * @param {number} maxHeight - Max output height in pixels (default 500).
 * @param {number} quality   - Starting encode quality 0–1 (default 0.85).
 * @returns {Promise<{compressedData: string, fileName: string}>}
 */
export const compressImage = (file, maxWidth = 500, maxHeight = 500, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Invalid file type. Please select an image.'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.onload = () => {
        // Scale down proportionally to fit within the bounding box.
        // Only shrink — never upscale a small image.
        const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const width  = Math.round(img.width  * ratio);
        const height = Math.round(img.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled  = true;
        ctx.imageSmoothingQuality  = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // WebP gives better quality-per-byte than JPEG.
        // A quick probe tells us whether this browser supports it.
        const mimeType = canvas.toDataURL('image/webp').startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/jpeg';

        // Step down quality until the output fits within the budget.
        const MAX_SIZE_KB = 100;
        const MIN_QUALITY = 0.50;
        let q = Math.max(MIN_QUALITY, Math.min(1, quality));
        let dataUrl;

        do {
          dataUrl = canvas.toDataURL(mimeType, q);
          // base64 expands binary by ~4/3; length × 0.75 approximates decoded bytes.
          const sizeKB = (dataUrl.length * 0.75) / 1024;
          if (sizeKB <= MAX_SIZE_KB || q <= MIN_QUALITY) break;
          q = Math.max(q - 0.05, MIN_QUALITY);
        // eslint-disable-next-line no-constant-condition
        } while (true);

        resolve({ compressedData: dataUrl, fileName: file.name });
      };
      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Extracts the filename from a File object.
 * @param {File} file
 * @returns {string}
 */
export const getFileName = (file) => (file ? file.name : '');
