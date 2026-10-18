/**
 * Image compressor utility for Strategy Studio.
 * - Scales down images if exceeding maxDimension (preserving aspect ratio, never upscaling).
 * - Honors EXIF orientation from cameras / mobile devices.
 * - Detects transparency: outputs PNG if transparency exists, otherwise high-quality JPEG (0.85).
 * - Safe fallback: returns original data URL if canvas processing fails.
 */

export interface CompressionOptions {
  maxDimension: number;
  quality?: number; // 0..1, default 0.85 for JPEG
}

/**
 * Checks if a canvas context contains any transparent pixels (alpha < 250).
 * Samples pixels for performance rather than checking every single pixel on huge images.
 */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 80));
    const imgData = ctx.getImageData(0, 0, width, height).data;
    const len = imgData.length;
    for (let i = 3; i < len; i += 4 * sampleStep) {
      if (imgData[i] < 250) {
        return true;
      }
    }
  } catch {
    // If getImageData fails (e.g. security origin), default to keeping PNG
    return true;
  }
  return false;
}

/**
 * Loads an image from File or Blob into an HTMLImageElement or ImageBitmap,
 * ensuring modern EXIF orientation is handled automatically.
 */
async function loadImageSource(file: File | Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup?: () => void;
}> {
  // 1. Try createImageBitmap with imageOrientation: 'from-image' (modern standard)
  if (typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await window.createImageBitmap(file, {
        imageOrientation: 'from-image'
      } as ImageBitmapOptions);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.()
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  // 2. Standard HTMLImageElement with object URL
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl)
      });
    };
    img.onerror = err => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

/**
 * Compresses an uploaded image file before it is written into document state.
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions
): Promise<string> {
  const quality = options.quality ?? 0.85;
  const maxDim = options.maxDimension;

  try {
    const { source, width, height, cleanup } = await loadImageSource(file);

    try {
      // Compute target dimensions: do NOT upscale smaller images
      let targetW = width;
      let targetH = height;

      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          targetW = maxDim;
          targetH = Math.round((height * maxDim) / width);
        } else {
          targetH = maxDim;
          targetW = Math.round((width * maxDim) / height);
        }
      }

      // If already small enough and small file size, check if we even need recompression
      // (still recompress if it's large MB photo from camera)
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // High quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, targetW, targetH);

      // Check transparency
      const isPngNeeded = file.type === 'image/png' || file.type === 'image/webp' ? hasTransparency(ctx, targetW, targetH) : false;

      let resultDataUrl: string;
      if (isPngNeeded) {
        resultDataUrl = canvas.toDataURL('image/png');
      } else {
        resultDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      return resultDataUrl;
    } finally {
      cleanup?.();
    }
  } catch (err) {
    console.warn('[compressImageFile] Compression failed, falling back to FileReader:', err);
    // Safe fallback: standard data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const res = ev.target?.result as string;
        if (res) resolve(res);
        else reject(new Error('FileReader returned empty result'));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
