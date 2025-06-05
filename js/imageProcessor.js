/**
 * 图像处理模块
 * 负责图片加载、处理和网格生成
 */

class ImageProcessor {
    constructor() {
        this.maxImageSize = 800; // 最大处理尺寸
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    /**
     * 从文件加载图片
     * @param {File} file - 图片文件
     * @returns {Promise<HTMLImageElement>} 加载的图片
     */
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('Please select a valid image file'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Image loading failed'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('File reading failed'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * 从URL加载图片
     * @param {string} url - 图片URL
     * @returns {Promise<HTMLImageElement>} 加载的图片
     */
    loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            if (!Utils.isValidImageUrl(url)) {
                reject(new Error('Please enter a valid image URL'));
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous'; // 尝试跨域
            
            // 添加缓存破坏参数，确保每次都重新加载图片
            const cacheBustedUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
            
            img.onload = () => {
                console.log('[ImageProcessor Debug] Image loaded successfully from URL:', url);
                resolve(img);
            };
            img.onerror = () => {
                console.log('[ImageProcessor Debug] Direct load failed, trying proxy for URL:', url);
                // 如果跨域失败，尝试通过代理加载
                this.loadImageThroughProxy(url)
                    .then(resolve)
                    .catch(reject);
            };
            
            // 使用带缓存破坏参数的URL
            img.src = cacheBustedUrl;
        });
    }

    /**
     * 从Data URL加载图片
     * @param {string} dataUrl - Data URL字符串
     * @returns {Promise<HTMLImageElement>} 加载的图片
     */
    loadImageFromDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            if (!dataUrl || !dataUrl.startsWith('data:image/')) {
                reject(new Error('Invalid Data URL'));
                return;
            }

            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Data URL image loading failed'));
            img.src = dataUrl;
        });
    }

    /**
     * 通过代理加载图片（处理CORS问题）
     * @param {string} url - 图片URL
     * @returns {Promise<HTMLImageElement>} 加载的图片
     */
    async loadImageThroughProxy(url) {
        try {
            // 这里可以调用后端代理API
            // const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
            
            // 暂时使用公共CORS代理（生产环境应该使用自己的代理）
            const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
            
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error('Proxy loading failed');
            }
            
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(img);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Proxy image loading failed'));
                };
                img.src = objectUrl;
            });
        } catch (error) {
            throw new Error(`Unable to load image: ${error.message}`);
        }
    }

    /**
     * 调整图片尺寸
     * @param {HTMLImageElement} img - 原始图片
     * @param {number} maxSize - 最大尺寸
     * @returns {object} 调整后的尺寸 {width, height}
     */
    calculateResizedDimensions(img, maxSize = this.maxImageSize) {
        let { width, height } = img;
        
        if (width <= maxSize && height <= maxSize) {
            return { width, height };
        }
        
        const ratio = Math.min(maxSize / width, maxSize / height);
        return {
            width: Math.round(width * ratio),
            height: Math.round(height * ratio)
        };
    }

    /**
     * 处理图片并生成游戏数据
     * @param {HTMLImageElement} img - 图片对象
     * @param {object} options - 处理选项
     * @returns {object} 处理结果
     */
    async processImage(img, options = {}) {
        const {
            colorCount = 16, // Default to 16 as per previous requirement
            gridSize = 'pixel',
            algorithm = 'kmeans'
        } = options;

        console.log(`[ImageProcessor Debug] processImage called with colorCount: ${colorCount}, algorithm: ${algorithm}`);

        const transparentThreshold = 128; // Alpha values <= this are considered transparent (lowered from 128)

        try {
            // 调整图片尺寸
            const dimensions = this.calculateResizedDimensions(img);
            this.canvas.width = dimensions.width;
            this.canvas.height = dimensions.height;

            // 绘制图片到画布
            this.ctx.clearRect(0, 0, dimensions.width, dimensions.height);
            this.ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);

            // 获取图像数据
            const imageData = this.ctx.getImageData(0, 0, dimensions.width, dimensions.height);
            const data = imageData.data;
            
            // Count unique colors (ignoring alpha for the color key, but respecting transparentThreshold for inclusion)
            const uniqueColors = new Set();
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > transparentThreshold) { // Check alpha channel (use the same threshold as opaquePixels)
                    uniqueColors.add(`${data[i]},${data[i+1]},${data[i+2]}`);
                }
            }

            console.log(`[ImageProcessor Debug] Image has ${uniqueColors.size} unique colors (threshold: ${transparentThreshold})`);
            if (uniqueColors.size <= 10) { // Only log if reasonable number
                console.log('[ImageProcessor Debug] Unique colors:', Array.from(uniqueColors).map(colorStr => `rgb(${colorStr})`));
            }

            if (uniqueColors.size > 128) {
                throw new Error('Image contains too many colors (max 128 allowed).');
            }
            
            // 收集非透明像素用于颜色量化
            const opaquePixels = [];
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > transparentThreshold) { // Check alpha channel
                    opaquePixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
                }
            }

            console.log(`[ImageProcessor Debug] Collected ${opaquePixels.length} opaque pixels for quantization`);

            if (opaquePixels.length === 0) {
                // Handle fully transparent image or image with all pixels below threshold
                // Create a gameGrid of all transparent cells
                const gameGrid = this.generateGameGrid(imageData, [], gridSize, transparentThreshold, true);
                 return {
                    originalImage: img,
                    processedImageData: imageData, // Original image data
                    palette: [], // No palette for fully transparent image
                    gameGrid: gameGrid,
                    dimensions: dimensions,
                    isFullyTransparent: true
                };
            }

            // For pixel art, directly extract unique colors if count is manageable
            let palette;
            let quantizedImageData;
            
            if (uniqueColors.size <= colorCount) {
                console.log(`[ImageProcessor Debug] Using direct color extraction (${uniqueColors.size} unique colors <= ${colorCount} target)`);
                // Create palette directly from unique colors without any quantization
                palette = this.createDirectPalette(uniqueColors, opaquePixels, transparentThreshold);
                // No quantization needed - original image data already has the right colors
                quantizedImageData = imageData;
            } else {
                console.log(`[ImageProcessor Debug] Using quantization algorithm (${uniqueColors.size} unique colors > ${colorCount} target)`);
                // Only use quantization when there are too many colors
                palette = colorQuantizer.generatePaletteFromPixels(opaquePixels, colorCount, algorithm);
                quantizedImageData = this.mapImageDataToPalette(imageData, palette, transparentThreshold);
            }

            // 生成游戏网格
            const gameGrid = this.generateGameGrid(
                quantizedImageData, // This is imageData with opaque pixels mapped to palette
                palette,
                gridSize,
                transparentThreshold
            );

            return {
                originalImage: img,
                processedImageData: quantizedImageData,
                palette: palette,
                gameGrid: gameGrid,
                dimensions: dimensions
            };

        } catch (error) {
            console.error('Image processing error:', error);
            throw new Error(`Image processing failed: ${error.message}`);
        }
    }

    /**
     * Creates a palette directly from unique colors without quantization
     * @param {Set} uniqueColors - Set of unique color strings "r,g,b"
     * @param {Array} opaquePixels - Array of opaque pixel objects {r, g, b}
     * @param {number} transparentThreshold - Transparency threshold
     * @returns {Array} Direct palette
     */
    createDirectPalette(uniqueColors, opaquePixels, transparentThreshold) {
        console.log(`[ImageProcessor Debug] Creating direct palette from ${uniqueColors.size} unique colors`);
        
        // Count frequency of each color
        const colorCounts = new Map();
        for (const pixel of opaquePixels) {
            const colorKey = `${pixel.r},${pixel.g},${pixel.b}`;
            colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
        }
        
        // Create palette entries for each unique color
        const palette = Array.from(uniqueColors).map((colorStr, index) => {
            const [r, g, b] = colorStr.split(',').map(Number);
            const color = { r, g, b };
            const count = colorCounts.get(colorStr) || 0;
            const brightness = Utils.getGrayscale(r, g, b);
            
            return {
                color: color,
                count: count,
                brightness: brightness,
                number: index + 1 // Will be reassigned after sorting
            };
        });
        
        // Sort by brightness (darker colors first)
        palette.sort((a, b) => a.brightness - b.brightness);
        
        // Reassign sequential numbers after sorting
        palette.forEach((item, index) => {
            item.number = index + 1;
        });
        
        console.log(`[ImageProcessor Debug] Direct palette created with ${palette.length} colors:`, 
                   palette.map(p => `rgb(${p.color.r},${p.color.g},${p.color.b}): ${p.count} pixels`));
        
        return palette;
    }

    /**
     * Maps an ImageData object to a given palette, leaving transparent pixels as they are.
     * @param {ImageData} originalImageData - The original image data.
     * @param {Array} palette - The color palette.
     * @param {number} transparentThreshold - Alpha threshold for transparency.
     * @returns {ImageData} A new ImageData object with opaque pixels mapped to the palette.
     */
    mapImageDataToPalette(originalImageData, palette, transparentThreshold) {
        const { width, height, data } = originalImageData;
        const newData = new Uint8ClampedArray(data.length);
        const tempCtx = document.createElement('canvas').getContext('2d');
        const newImageData = tempCtx.createImageData(width, height);

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > transparentThreshold) {
                const pixelColor = { r: data[i], g: data[i + 1], b: data[i + 2] };
                const closestPaletteItem = this.findClosestPaletteColor(pixelColor, palette);
                if (closestPaletteItem && closestPaletteItem.color) {
                    newData[i] = closestPaletteItem.color.r;
                    newData[i + 1] = closestPaletteItem.color.g;
                    newData[i + 2] = closestPaletteItem.color.b;
                    newData[i + 3] = 255; // Force opaque for colored areas
                } else {
                    // Should not happen if palette is derived from these pixels
                    newData[i] = data[i];
                    newData[i + 1] = data[i + 1];
                    newData[i + 2] = data[i + 2];
                    newData[i + 3] = data[i + 3];
                }
            } else {
                // Transparent pixel, copy as is
                newData[i] = data[i];         // R
                newData[i + 1] = data[i + 1]; // G
                newData[i + 2] = data[i + 2]; // B
                newData[i + 3] = alpha;       // A
            }
        }
        newImageData.data.set(newData);
        return newImageData;
    }

    /**
     * 生成游戏网格（像素级别）
     * @param {ImageData} imageData - 处理后的图像数据 (opaque pixels mapped to palette, transparent pixels as is)
     * @param {Array} palette - 调色板
     * @param {string|number} gridSize - 网格大小（对于像素级别游戏忽略此参数）
     * @param {number} transparentThreshold - Alpha threshold for transparency
     * @param {boolean} forceAllTransparent - If true, mark all cells as transparent (for fully transparent images)
     * @returns {Array} 游戏网格数据
     */
    generateGameGrid(imageData, palette, gridSize, transparentThreshold = 128, forceAllTransparent = false) {
        const { width, height } = imageData;
        const data = imageData.data;

        console.log(`Generating pixel-level grid: ${width}x${height}, palette color count: ${palette.length}`);

        const grid = [];
        let validPixels = 0; // Non-transparent, colorable pixels
        let transparentPixels = 0;

        for (let row = 0; row < height; row++) {
            const gridRow = [];
            for (let col = 0; col < width; col++) {
                const pixelIndex = (row * width + col) * 4;
                
                if (forceAllTransparent || data[pixelIndex + 3] <= transparentThreshold) {
                    // Transparent pixel
                    gridRow.push({
                        row: row,
                        col: col,
                        x: col,
                        y: row,
                        width: 1,
                        height: 1,
                        isTransparent: true,
                        revealed: true, // Transparent cells are "revealed" by default
                        number: 0, // Special number for transparent
                        color: { r: 0, g: 0, b: 0, a: 0 } // Store as fully transparent black
                    });
                    transparentPixels++;
                } else {
                    // Opaque pixel, should be mapped to a palette color
                    const pixelColor = {
                        r: data[pixelIndex],
                        g: data[pixelIndex + 1],
                        b: data[pixelIndex + 2]
                    };

                    // Find the *exact* palette color entry (since imageData is already mapped)
                    // This assumes that the r,g,b values in `data` are now one of the palette colors.
                    const paletteItem = palette.find(pItem => 
                        pItem.color.r === pixelColor.r &&
                        pItem.color.g === pixelColor.g &&
                        pItem.color.b === pixelColor.b
                    );
                    
                    if (paletteItem && paletteItem.color) {
                        gridRow.push({
                            row: row,
                            col: col,
                            x: col,
                            y: row,
                            width: 1,
                            height: 1,
                            color: { ...paletteItem.color }, // Store a copy of the palette color
                            number: paletteItem.number,
                            revealed: false,
                            isTransparent: false,
                            pixelCount: 1 
                        });
                        validPixels++;
                    } else {
                        // This case should ideally not be reached if mapImageDataToPalette worked correctly
                        // and all opaque pixels were mapped.
                        // As a fallback, treat as transparent or a default non-interactive color.
                        console.warn('Pixel color not found in palette after mapping (should not happen):', pixelColor, 'Palette:', palette);
                        gridRow.push({
                            row: row,
                            col: col,
                            x: col,
                            y: row,
                            width: 1,
                            height: 1,
                            isTransparent: true, // Fallback to transparent
                            revealed: true,
                            number: 0,
                            color: { r: 0, g: 0, b: 0, a: 0 }
                        });
                        transparentPixels++;
                    }
                }
            }
            grid.push(gridRow);
        }

        console.log(`Grid generation completed: total pixels ${width * height}, valid (opaque) pixels ${validPixels}, transparent pixels ${transparentPixels}`);
        return grid;
    }

    /**
     * 找到最接近的调色板颜色
     * @param {object} pixelColor - 像素颜色
     * @param {Array} palette - 调色板
     * @returns {object} 最接近的调色板项
     */
    findClosestPaletteColor(pixelColor, palette) {
        if (!palette || palette.length === 0) {
            console.error('Palette is empty');
            return null;
        }

        let minDistance = Infinity;
        let closestItem = palette[0];
        
        for (const paletteItem of palette) {
            if (!paletteItem || !paletteItem.color) {
                console.warn('Invalid palette item:', paletteItem);
                continue;
            }
            
            const distance = Utils.colorDistance(pixelColor, paletteItem.color);
            if (distance < minDistance) {
                minDistance = distance;
                closestItem = paletteItem;
            }
        }
        
        return closestItem;
    }

    /**
     * 计算网格单元大小（像素级别游戏固定为1）
     * @param {number} width - 图片宽度
     * @param {number} height - 图片高度
     * @param {string|number} gridSize - 网格大小设置
     * @returns {number} 单元大小（固定为1，表示每个像素一个格子）
     */
    calculateCellSize(width, height, gridSize) {
        // 对于像素级别的游戏，每个像素都是一个格子
        return 1;
    }

    /**
     * 根据图片面积计算目标网格数量（像素级别游戏等于图片像素数）
     * @param {number} area - 图片面积
     * @returns {number} 目标网格数量（等于像素数）
     */
    getTargetCellCount(area) {
        // 对于像素级别游戏，目标网格数量就是像素数
        return area;
    }

    /**
     * 找到颜色数组中的主导颜色（像素级别不需要此函数，但保留兼容性）
     * @param {Array} colors - 颜色数组
     * @param {Array} palette - 调色板
     * @returns {object} 主导颜色信息
     */
    findDominantColor(colors, palette) {
        if (colors.length === 0) {
            return palette[0];
        }

        // 对于像素级别，直接返回第一个颜色对应的调色板项
        const color = colors[0];
        return this.findClosestPaletteColor(color, palette);
    }

    /**
     * 创建预览图像
     * @param {ImageData} imageData - 图像数据
     * @returns {string} 图像的Data URL
     */
    createPreviewImage(imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        
        return canvas.toDataURL();
    }

    /**
     * 验证图片文件
     * @param {File} file - 图片文件
     * @returns {object} 验证结果
     */
    validateImageFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        
        const result = {
            valid: true,
            errors: []
        };

        if (!file) {
            result.valid = false;
            result.errors.push('Please select a file');
            return result;
        }

        if (!allowedTypes.includes(file.type.toLowerCase())) {
            result.valid = false;
            result.errors.push('Unsupported file format, please select JPG, PNG, GIF, or WebP format images');
        }

        if (file.size > maxSize) {
            result.valid = false;
            result.errors.push('File size cannot exceed 10MB');
        }

        return result;
    }

    /**
     * 获取图片信息
     * @param {HTMLImageElement} img - 图片对象
     * @returns {object} 图片信息
     */
    getImageInfo(img) {
        return {
            width: img.naturalWidth,
            height: img.naturalHeight,
            aspectRatio: img.naturalWidth / img.naturalHeight,
            size: `${img.naturalWidth} × ${img.naturalHeight}`,
            area: img.naturalWidth * img.naturalHeight
        };
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.canvas) {
            this.canvas.width = 1;
            this.canvas.height = 1;
            this.ctx.clearRect(0, 0, 1, 1);
        }
    }
}

// 创建全局实例
const imageProcessor = new ImageProcessor(); 