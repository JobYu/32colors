/**
 * 颜色量化算法模块
 * 实现K-means聚类和中位切分算法来减少图片颜色数量
 */

class ColorQuantizer {
    constructor() {
        this.maxIterations = 20;
        this.convergenceThreshold = 1;
        this.transparentThreshold = 32; // Alpha values <= this are considered transparent (lowered to 32 for pixel art)
    }

    /**
     * 使用K-means算法进行颜色量化
     * @param {ImageData} imageData - 图像数据
     * @param {number} k - 目标颜色数量
     * @returns {object} 量化结果 {palette, quantizedData}
     */
    kMeansQuantize(imageData, k) {
        // Extract only opaque pixels for palette generation
        const opaquePixelColors = this.extractPixels(imageData, this.transparentThreshold);

        if (opaquePixelColors.length === 0) {
            return { palette: [], quantizedData: imageData }; // Or handle as fully transparent
        }
        
        const palette = this.generatePaletteFromPixels(opaquePixelColors, k, 'kmeans');
        const quantizedData = this.quantizeImageData(imageData, palette, this.transparentThreshold);
        return { palette, quantizedData };
    }

    /**
     * 使用中位切分算法进行颜色量化
     * @param {ImageData} imageData - 图像数据
     * @param {number} targetColors - 目标颜色数量
     * @returns {object} 量化结果
     */
    medianCutQuantize(imageData, targetColors) {
        const opaquePixelColors = this.extractPixels(imageData, this.transparentThreshold);

        if (opaquePixelColors.length === 0) {
            return { palette: [], quantizedData: imageData };
        }

        const palette = this.generatePaletteFromPixels(opaquePixelColors, targetColors, 'median-cut');
        const quantizedData = this.quantizeImageData(imageData, palette, this.transparentThreshold);
        return { palette, quantizedData };
    }

    /**
     * 从图像数据中提取像素
     * @param {ImageData} imageData - 图像数据
     * @param {number} transparentThreshold - Alpha values <= this are considered transparent
     * @returns {Array} 像素数组
     */
    extractPixels(imageData, transparentThreshold = 128) {
        const pixels = [];
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > transparentThreshold) {
                pixels.push({
                    r: data[i],
                    g: data[i + 1],
                    b: data[i + 2]
                });
            }
        }
        
        return pixels;
    }

    /**
     * 初始化K-means聚类中心
     * @param {Array} pixels - 像素数组
     * @param {number} k - 聚类数量
     * @returns {Array} 初始聚类中心
     */
    initializeCentroids(pixels, k) {
        const centroids = [];
        
        // 使用K-means++算法初始化
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
        
        for (let i = 1; i < k; i++) {
            const distances = pixels.map(pixel => {
                let minDist = Infinity;
                for (const centroid of centroids) {
                    const dist = Utils.colorDistance(pixel, centroid);
                    minDist = Math.min(minDist, dist);
                }
                return minDist * minDist;
            });
            
            const totalDist = distances.reduce((sum, dist) => sum + dist, 0);
            const random = Math.random() * totalDist;
            
            let cumulative = 0;
            for (let j = 0; j < pixels.length; j++) {
                cumulative += distances[j];
                if (cumulative >= random) {
                    centroids.push(pixels[j]);
                    break;
                }
            }
        }
        
        return centroids;
    }

    /**
     * 将像素分配到最近的聚类中心
     * @param {Array} pixels - 像素数组
     * @param {Array} centroids - 聚类中心
     * @returns {Array} 分配结果
     */
    assignPixelsToCentroids(pixels, centroids) {
        return pixels.map(pixel => {
            let minDistance = Infinity;
            let assignment = 0;
            
            for (let i = 0; i < centroids.length; i++) {
                const distance = Utils.colorDistance(pixel, centroids[i]);
                if (distance < minDistance) {
                    minDistance = distance;
                    assignment = i;
                }
            }
            
            return assignment;
        });
    }

    /**
     * 检查K-means是否收敛
     * @param {Array} oldAssignments - 旧的分配
     * @param {Array} newAssignments - 新的分配
     * @returns {boolean} 是否收敛
     */
    hasConverged(oldAssignments, newAssignments) {
        if (!oldAssignments) return false;
        
        let changes = 0;
        for (let i = 0; i < oldAssignments.length; i++) {
            if (oldAssignments[i] !== newAssignments[i]) {
                changes++;
            }
        }
        
        return changes <= this.convergenceThreshold;
    }

    /**
     * 更新K-means聚类中心
     * @param {Array} pixels - 像素数组
     * @param {Array} assignments - 分配结果
     * @param {number} k - 聚类数量
     * @returns {Array} 新的聚类中心
     */
    updateCentroids(pixels, assignments, k) {
        const centroids = [];
        
        for (let i = 0; i < k; i++) {
            const clusterPixels = pixels.filter((_, index) => assignments[index] === i);
            
            if (clusterPixels.length > 0) {
                const avgColor = this.getAverageColor(clusterPixels);
                centroids.push(avgColor);
            } else {
                // 如果聚类为空，随机选择一个像素
                centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
            }
        }
        
        return centroids;
    }

    /**
     * 计算像素数组的平均颜色
     * @param {Array} pixels - 像素数组
     * @returns {object} 平均颜色
     */
    getAverageColor(pixels) {
        if (pixels.length === 0) return { r: 0, g: 0, b: 0 };
        
        const sum = pixels.reduce((acc, pixel) => ({
            r: acc.r + pixel.r,
            g: acc.g + pixel.g,
            b: acc.b + pixel.b
        }), { r: 0, g: 0, b: 0 });
        
        return {
            r: Math.round(sum.r / pixels.length),
            g: Math.round(sum.g / pixels.length),
            b: Math.round(sum.b / pixels.length)
        };
    }

    /**
     * 生成调色板
     * @param {Array} centroids - 聚类中心
     * @param {Array} pixels - 像素数组
     * @param {Array} assignments - 分配结果
     * @returns {Array} 调色板
     */
    generatePalette(centroids, pixels, assignments) {
        const palette = centroids.map((centroid, index) => {
            const count = assignments.filter(assignment => assignment === index).length;
            return {
                color: centroid,
                count: count,
                brightness: Utils.getGrayscale(centroid.r, centroid.g, centroid.b)
            };
        }).filter(item => item.count > 0);

        // Sorting and numbering will be done by the calling method (generatePaletteFromPixels)
        return palette;
    }

    /**
     * 更新颜色盒子的边界
     * @param {object} box - 颜色盒子
     */
    updateBoxBounds(box) {
        if (box.pixels.length === 0) return;
        
        box.min = { r: 255, g: 255, b: 255 };
        box.max = { r: 0, g: 0, b: 0 };
        
        for (const pixel of box.pixels) {
            box.min.r = Math.min(box.min.r, pixel.r);
            box.min.g = Math.min(box.min.g, pixel.g);
            box.min.b = Math.min(box.min.b, pixel.b);
            box.max.r = Math.max(box.max.r, pixel.r);
            box.max.g = Math.max(box.max.g, pixel.g);
            box.max.b = Math.max(box.max.b, pixel.b);
        }
    }

    /**
     * 找到最大的颜色盒子
     * @param {Array} boxes - 颜色盒子数组
     * @returns {object} 最大的盒子
     */
    findLargestBox(boxes) {
        let largestBox = null;
        let maxVolume = 0;
        
        for (const box of boxes) {
            if (box.pixels.length <= 1) continue;
            
            const volume = (box.max.r - box.min.r) * 
                          (box.max.g - box.min.g) * 
                          (box.max.b - box.min.b);
            
            if (volume > maxVolume) {
                maxVolume = volume;
                largestBox = box;
            }
        }
        
        return largestBox;
    }

    /**
     * 分割颜色盒子
     * @param {object} box - 要分割的盒子
     * @returns {Array} 分割后的盒子数组
     */
    splitBox(box) {
        if (box.pixels.length <= 1) return [box];
        
        // 找到最长的维度
        const ranges = {
            r: box.max.r - box.min.r,
            g: box.max.g - box.min.g,
            b: box.max.b - box.min.b
        };
        
        const longestDim = Object.keys(ranges).reduce((a, b) => 
            ranges[a] > ranges[b] ? a : b
        );
        
        // 按最长维度排序
        box.pixels.sort((a, b) => a[longestDim] - b[longestDim]);
        
        // 在中位数处分割
        const medianIndex = Math.floor(box.pixels.length / 2);
        
        const box1 = {
            pixels: box.pixels.slice(0, medianIndex),
            min: { ...box.min },
            max: { ...box.max }
        };
        
        const box2 = {
            pixels: box.pixels.slice(medianIndex),
            min: { ...box.min },
            max: { ...box.max }
        };
        
        this.updateBoxBounds(box1);
        this.updateBoxBounds(box2);
        
        return [box1, box2];
    }

    /**
     * 量化图像数据
     * @param {ImageData} originalImageData - 原始图像数据
     * @param {Array} palette - 调色板
     * @param {number} transparentThreshold - Alpha values <= this are considered transparent
     * @returns {ImageData} 量化后的图像数据
     */
    quantizeImageData(originalImageData, palette, transparentThreshold = 128) {
        const { width, height, data } = originalImageData;
        // Create a new ImageData object to store quantized data
        const newCanvas = document.createElement('canvas');
        newCanvas.width = width;
        newCanvas.height = height;
        const newCtx = newCanvas.getContext('2d');
        const quantizedImageData = newCtx.createImageData(width, height);

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > transparentThreshold) {
                const pixelColor = { r: data[i], g: data[i + 1], b: data[i + 2] };
                
                // Find the closest color in the palette
                let closestColor = palette[0].color;
                let minDistance = Utils.colorDistance(pixelColor, closestColor);

                for (let j = 1; j < palette.length; j++) {
                    const distance = Utils.colorDistance(pixelColor, palette[j].color);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestColor = palette[j].color;
                    }
                }
                quantizedImageData.data[i] = closestColor.r;
                quantizedImageData.data[i + 1] = closestColor.g;
                quantizedImageData.data[i + 2] = closestColor.b;
                quantizedImageData.data[i + 3] = 255; // Opaque
            } else {
                // Preserve original transparent/semi-transparent pixel
                quantizedImageData.data[i] = data[i];
                quantizedImageData.data[i + 1] = data[i + 1];
                quantizedImageData.data[i + 2] = data[i + 2];
                quantizedImageData.data[i + 3] = alpha;
            }
        }
        return quantizedImageData;
    }

    /**
     * 简单的颜色量化（降低颜色精度）
     * @param {ImageData} imageData - 图像数据
     * @param {number} levels - 每个颜色通道的级别数
     * @returns {object} 量化结果
     */
    simpleQuantize(imageData, levels = 8) {
        const factor = 255 / (levels - 1);
        const quantizedData = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        
        const colorMap = new Map();
        const data = quantizedData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 128) {
                // 量化每个颜色通道
                const r = Math.round(Math.round(data[i] / factor) * factor);
                const g = Math.round(Math.round(data[i + 1] / factor) * factor);
                const b = Math.round(Math.round(data[i + 2] / factor) * factor);
                
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                
                // 记录颜色
                const colorKey = `${r},${g},${b}`;
                colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
            }
        }
        
        // 生成调色板
        let palette = Array.from(colorMap.entries()).map(([colorKey, count], index) => {
            const [r, g, b] = colorKey.split(',').map(Number);
            const color = { r, g, b };
            return {
                color: color,
                count: count,
                brightness: Utils.getGrayscale(color.r, color.g, color.b) // Calculate brightness
            };
        });
        
        // Sort by brightness (ascending)
        palette.sort((a, b) => a.brightness - b.brightness);

        // Assign sequential numbers
        palette.forEach((item, index) => {
            item.number = index + 1;
        });
        
        return { palette, quantizedData };
    }

    /**
     * Generates a color palette from a list of pixel colors using a specified algorithm.
     * @param {Array<object>} opaquePixelColors - Array of {r, g, b} objects for opaque pixels.
     * @param {number} k - Target number of colors in the palette.
     * @param {string} algorithm - 'kmeans', 'median-cut', or 'simple'.
     * @returns {Array<object>} The generated palette.
     */
    generatePaletteFromPixels(opaquePixelColors, k, algorithm = 'kmeans') {
        console.log(`[ColorQuantizer Debug] generatePaletteFromPixels called with k=${k}, algorithm=${algorithm}, opaquePixels.length=${opaquePixelColors?.length}`);
        
        if (!opaquePixelColors || opaquePixelColors.length === 0) {
            return [];
        }

        // If the number of unique opaque pixels is less than or equal to k,
        // create a palette directly from these unique colors.
        const uniqueColors = [];
        const colorMap = new Map();
        
        // For small images or when we suspect few colors, use exact pixel matching
        for (const pixel of opaquePixelColors) {
            const colorString = `${pixel.r}-${pixel.g}-${pixel.b}`;
            if (!colorMap.has(colorString)) {
                colorMap.set(colorString, { color: pixel, count: 0 });
                uniqueColors.push(pixel);
            }
            colorMap.get(colorString).count++;
        }

        // Debug logging
        console.log(`[ColorQuantizer Debug] Found ${uniqueColors.length} unique colors from ${opaquePixelColors.length} opaque pixels. Target: ${k} colors.`);
        if (uniqueColors.length <= 10) { // Only log if reasonable number of unique colors
            console.log('[ColorQuantizer Debug] Unique colors found:', uniqueColors.map(c => `rgb(${c.r},${c.g},${c.b})`));
            console.log('[ColorQuantizer Debug] Color counts:', uniqueColors.map(c => {
                const colorString = `${c.r}-${c.g}-${c.b}`;
                return `rgb(${c.r},${c.g},${c.b}): ${colorMap.get(colorString).count} pixels`;
            }));
        }

        if (uniqueColors.length <= k) {
            const palette = uniqueColors.map((color, index) => ({
                color: color,
                number: index + 1,
                count: colorMap.get(`${color.r}-${color.g}-${color.b}`).count,
                brightness: Utils.getGrayscale(color.r, color.g, color.b)
            }));
            palette.sort((a, b) => a.brightness - b.brightness);
            palette.forEach((item, index) => item.number = index + 1);
            console.log(`[ColorQuantizer Debug] Returning ${palette.length} colors directly (no quantization needed).`);
            return palette;
        }

        // Proceed with the chosen quantization algorithm for palette generation
        let palette;
        if (algorithm === 'median-cut') {
            palette = this._medianCutPalette(opaquePixelColors, k);
        } else if (algorithm === 'simple') {
            // Simple quantize might not be ideal for palette generation from a list,
            // as it typically works by reducing bit depth of all pixels in an ImageData.
            // We'll use a K-means fallback for 'simple' if opaquePixelColors is the input.
            console.warn("SimpleQuantize for direct palette generation from pixel list is not optimal, using K-means as fallback.");
            palette = this._kMeansPalette(opaquePixelColors, k);
        } else { // Default to k-means
            palette = this._kMeansPalette(opaquePixelColors, k);
        }
        
        // Sort and assign numbers (already done if uniqueColors.length <= k)
        if (uniqueColors.length > k) {
            palette.sort((a, b) => a.brightness - b.brightness);
            palette.forEach((item, index) => {
                item.number = index + 1;
                // item.count is already set by _kMeansPalette or _medianCutPalette
            });
        }
        return palette;
    }

    /**
     * Internal K-means for generating palette from a pixel list.
     * @param {Array<object>} pixels - Array of {r, g, b} pixel colors.
     * @param {number} k - Target number of colors.
     * @returns {Array<object>} Palette.
     */
    _kMeansPalette(pixels, k) {
        if (pixels.length <= k) {
             // This case should be handled by the caller (generatePaletteFromPixels)
            // but as a safeguard:
            return pixels.map((pixel, index) => ({
                color: pixel,
                number: index + 1, // Temp number, will be reassigned after sort
                count: 1,
                brightness: Utils.getGrayscale(pixel.r, pixel.g, pixel.b)
            }));
        }

        let centroids = this.initializeCentroids(pixels, k);
        let assignments = new Array(pixels.length);
        let converged = false;
        let iteration = 0;

        while (!converged && iteration < this.maxIterations) {
            const newAssignments = this.assignPixelsToCentroids(pixels, centroids);
            converged = this.hasConverged(assignments, newAssignments);
            assignments = newAssignments;
            centroids = this.updateCentroids(pixels, assignments, k);
            iteration++;
        }
        return this.generatePalette(centroids, pixels, assignments); // generatePalette now used internally
    }

    /**
     * Internal Median Cut for generating palette from a pixel list.
     * @param {Array<object>} pixels - Array of {r, g, b} pixel colors.
     * @param {number} targetColors - Target number of colors.
     * @returns {Array<object>} Palette.
     */
    _medianCutPalette(pixels, targetColors) {
        if (pixels.length <= targetColors) {
            // This case should be handled by the caller (generatePaletteFromPixels)
            return pixels.map((pixel, index) => ({
                color: pixel,
                number: index + 1, // Temp number
                count: 1,
                brightness: Utils.getGrayscale(pixel.r, pixel.g, pixel.b)
            }));
        }

        const initialBox = { pixels: pixels, min: { r: 0, g: 0, b: 0 }, max: { r: 255, g: 255, b: 255 } };
        this.updateBoxBounds(initialBox);
        
        const boxes = [initialBox];
        while (boxes.length < targetColors) {
            const boxToSplit = this.findLargestBox(boxes);
            if (!boxToSplit || boxToSplit.pixels.length <= 1) break;
            const newBoxes = this.splitBox(boxToSplit);
            if (newBoxes.length === 2) {
                boxes.splice(boxes.indexOf(boxToSplit), 1, ...newBoxes);
            } else {
                break;
            }
        }

        return boxes.map(box => {
            const avgColor = this.getAverageColor(box.pixels);
            return {
                color: avgColor,
                count: box.pixels.length,
                brightness: Utils.getGrayscale(avgColor.r, avgColor.g, avgColor.b)
                // Number will be assigned after sorting in the main method
            };
        });
    }
}

// 创建全局实例
const colorQuantizer = new ColorQuantizer(); 