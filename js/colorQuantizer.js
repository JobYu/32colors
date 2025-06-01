/**
 * 颜色量化算法模块
 * 实现K-means聚类和中位切分算法来减少图片颜色数量
 */

class ColorQuantizer {
    constructor() {
        this.maxIterations = 20;
        this.convergenceThreshold = 1;
    }

    /**
     * 使用K-means算法进行颜色量化
     * @param {ImageData} imageData - 图像数据
     * @param {number} k - 目标颜色数量
     * @returns {object} 量化结果 {palette, quantizedData}
     */
    kMeansQuantize(imageData, k) {
        const pixels = this.extractPixels(imageData);
        
        // 如果像素数量少于目标颜色数，直接返回
        if (pixels.length <= k) {
            return {
                palette: pixels.map((pixel, index) => ({
                    color: pixel,
                    number: index + 1,
                    count: 1
                })),
                quantizedData: imageData
            };
        }

        // 初始化聚类中心
        let centroids = this.initializeCentroids(pixels, k);
        let assignments = new Array(pixels.length);
        let converged = false;
        let iteration = 0;

        while (!converged && iteration < this.maxIterations) {
            // 分配像素到最近的聚类中心
            const newAssignments = this.assignPixelsToCentroids(pixels, centroids);
            
            // 检查是否收敛
            converged = this.hasConverged(assignments, newAssignments);
            assignments = newAssignments;

            // 更新聚类中心
            centroids = this.updateCentroids(pixels, assignments, k);
            iteration++;
        }

        // 生成调色板
        const palette = this.generatePalette(centroids, pixels, assignments);
        
        // 量化图像数据
        const quantizedData = this.quantizeImageData(imageData, palette);

        return { palette, quantizedData };
    }

    /**
     * 使用中位切分算法进行颜色量化
     * @param {ImageData} imageData - 图像数据
     * @param {number} targetColors - 目标颜色数量
     * @returns {object} 量化结果
     */
    medianCutQuantize(imageData, targetColors) {
        const pixels = this.extractPixels(imageData);
        
        if (pixels.length <= targetColors) {
            return {
                palette: pixels.map((pixel, index) => ({
                    color: pixel,
                    number: index + 1,
                    count: 1
                })),
                quantizedData: imageData
            };
        }

        // 创建初始颜色盒子
        const initialBox = {
            pixels: pixels,
            min: { r: 0, g: 0, b: 0 },
            max: { r: 255, g: 255, b: 255 }
        };

        this.updateBoxBounds(initialBox);
        
        // 递归分割颜色盒子
        const boxes = [initialBox];
        while (boxes.length < targetColors) {
            // 找到最大的盒子进行分割
            const boxToSplit = this.findLargestBox(boxes);
            if (!boxToSplit || boxToSplit.pixels.length <= 1) break;

            const newBoxes = this.splitBox(boxToSplit);
            if (newBoxes.length === 2) {
                const index = boxes.indexOf(boxToSplit);
                boxes.splice(index, 1, ...newBoxes);
            } else {
                break;
            }
        }

        // 从每个盒子生成代表颜色
        const palette = boxes.map((box, index) => {
            const avgColor = this.getAverageColor(box.pixels);
            return {
                color: avgColor,
                number: index + 1,
                count: box.pixels.length
            };
        });

        // 量化图像数据
        const quantizedData = this.quantizeImageData(imageData, palette);

        return { palette, quantizedData };
    }

    /**
     * 从图像数据中提取像素
     * @param {ImageData} imageData - 图像数据
     * @returns {Array} 像素数组
     */
    extractPixels(imageData) {
        const pixels = [];
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            // 跳过透明像素
            if (data[i + 3] > 128) {
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
        return centroids.map((centroid, index) => {
            const count = assignments.filter(assignment => assignment === index).length;
            return {
                color: centroid,
                number: index + 1,
                count: count
            };
        }).filter(item => item.count > 0);
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
     * @param {ImageData} imageData - 原始图像数据
     * @param {Array} palette - 调色板
     * @returns {ImageData} 量化后的图像数据
     */
    quantizeImageData(imageData, palette) {
        const quantizedData = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        
        const data = quantizedData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 128) { // 非透明像素
                const pixel = {
                    r: data[i],
                    g: data[i + 1],
                    b: data[i + 2]
                };
                
                // 找到最近的调色板颜色
                let minDistance = Infinity;
                let closestColor = palette[0].color;
                
                for (const paletteItem of palette) {
                    const distance = Utils.colorDistance(pixel, paletteItem.color);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestColor = paletteItem.color;
                    }
                }
                
                data[i] = closestColor.r;
                data[i + 1] = closestColor.g;
                data[i + 2] = closestColor.b;
            }
        }
        
        return quantizedData;
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
        const palette = Array.from(colorMap.entries()).map(([colorKey, count], index) => {
            const [r, g, b] = colorKey.split(',').map(Number);
            return {
                color: { r, g, b },
                number: index + 1,
                count: count
            };
        });
        
        return { palette, quantizedData };
    }
}

// 创建全局实例
const colorQuantizer = new ColorQuantizer(); 