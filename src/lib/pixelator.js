/**
 * Pixelator — applies a blocky pixel-art effect to an ImageData.
 *
 * Each blockSizePx × blockSizePx tile is replaced with the mean colour of
 * all source pixels inside it. Edge tiles that are smaller than blockSizePx
 * are handled correctly (the actual tile dimensions are used for the average).
 *
 * blockSizePx <= 1 is a no-op: the original ImageData is returned as-is.
 */
export class Pixelator {
    /**
     * @param {ImageData} imageData
     * @param {number} blockSizePx  Tile size in pixels (integer >= 1).
     * @returns {ImageData}
     */
    pixelate(imageData, blockSizePx) {
        const size = Math.max(1, Math.round(blockSizePx));
        if (size <= 1) return imageData;

        const { width, height, data } = imageData;
        const out = new Uint8ClampedArray(data.length);

        for (let blockY = 0; blockY < height; blockY += size) {
            for (let blockX = 0; blockX < width; blockX += size) {
                const tileW = Math.min(size, width - blockX);
                const tileH = Math.min(size, height - blockY);
                const count = tileW * tileH;

                let r = 0, g = 0, b = 0, a = 0;
                for (let dy = 0; dy < tileH; dy++) {
                    for (let dx = 0; dx < tileW; dx++) {
                        const i = ((blockY + dy) * width + (blockX + dx)) * 4;
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        a += data[i + 3];
                    }
                }

                const mr = Math.round(r / count);
                const mg = Math.round(g / count);
                const mb = Math.round(b / count);
                const ma = Math.round(a / count);

                for (let dy = 0; dy < tileH; dy++) {
                    for (let dx = 0; dx < tileW; dx++) {
                        const i = ((blockY + dy) * width + (blockX + dx)) * 4;
                        out[i]     = mr;
                        out[i + 1] = mg;
                        out[i + 2] = mb;
                        out[i + 3] = ma;
                    }
                }
            }
        }

        return { data: out, width, height };
    }
}
