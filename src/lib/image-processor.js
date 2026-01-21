/**
 * Image Processor Module
 * Handles image resizing and manipulation
 */

export class ImageProcessor {
    /**
     * Resize an image to the specified dimensions (in mm, converted to pixels)
     * Using 10 pixels per mm for reasonable resolution
     */
    resize(image, widthMm, heightMm, pxPerMm = 10) {
        const widthPx = widthMm * pxPerMm;
        const heightPx = heightMm * pxPerMm;

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = widthPx;
        canvas.height = heightPx;

        // Calculate scaling to fit while maintaining aspect ratio
        const imgAspect = image.width / image.height;
        const targetAspect = widthPx / heightPx;

        let drawWidth, drawHeight;

        if (imgAspect > targetAspect) {
            // Image is wider - fit to width
            drawWidth = widthPx;
            drawHeight = widthPx / imgAspect;
        } else {
            // Image is taller - fit to height
            drawHeight = heightPx;
            drawWidth = heightPx * imgAspect;
        }

        // Set canvas to exact image size (no padding)
        canvas.width = drawWidth;
        canvas.height = drawHeight;

        // Draw image (no background fill needed as canvas is exactly sized)
        ctx.drawImage(image, 0, 0, drawWidth, drawHeight);

        // Return image data
        return ctx.getImageData(0, 0, drawWidth, drawHeight);
    }

    /**
     * Convert ImageData to Image element
     */
    imageDataToImage(imageData) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            ctx.putImageData(imageData, 0, 0);

            const img = new Image();
            img.onload = () => resolve(img);
            img.src = canvas.toDataURL();
        });
    }

    /**
     * Get image data from an image element
     */
    getImageData(image) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, image.width, image.height);
    }
}
