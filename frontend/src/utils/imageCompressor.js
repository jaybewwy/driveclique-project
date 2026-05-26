/**
 * Compresses an image file and returns a compressed base64 string along with the filename.
 * @param {File} file - The image file to compress
 * @param {number} maxWidth - Maximum width of the compressed image (default: 400)
 * @param {number} maxHeight - Maximum height of the compressed image (default: 400)
 * @param {number} quality - JPEG quality from 0 to 1 (default: 0.7)
 * @returns {Promise<{compressedData: string, fileName: string}>} Compressed base64 string and filename
 */
export const compressImage = (file, maxWidth = 400, maxHeight = 400, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Invalid file type. Please select an image.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed base64 (use JPEG for better compression)
        const compressedData = canvas.toDataURL('image/jpeg', quality);
        const fileName = file.name;

        resolve({ compressedData, fileName });
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
};

/**
 * Extracts filename from a file input
 * @param {File} file - The file to extract name from
 * @returns {string} The filename
 */
export const getFileName = (file) => {
  if (!file) return '';
  return file.name;
};