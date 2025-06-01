/**
 * 图像处理模块
 * 负责图片加载、处理和网格生成
 */

class ImageProcessor {
    constructor() {
        this.maxImageSize = 800; // 最大处理尺寸
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * 从文件加载图片
     * @param {File} file - 图片文件
     * @returns {Promise<HTMLImageElement>} 加载的图片
     */
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('请选择有效的图片文件'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
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
                reject(new Error('请输入有效的图片URL'));
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous'; // 尝试跨域
            
            img.onload = () => resolve(img);
            img.onerror = () => {
                // 如果跨域失败，尝试通过代理加载
                this.loadImageThroughProxy(url)
                    .then(resolve)
                    .catch(reject);
            };
            
            img.src = url;
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
                throw new Error('代理加载失败');
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
                    reject(new Error('代理图片加载失败'));
                };
                img.src = objectUrl;
            });
        } catch (error) {
            throw new Error(`无法加载图片: ${error.message}`);
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
            colorCount = 24,
            gridSize = 'auto',
            algorithm = 'kmeans'
        } = options;

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

            // 颜色量化
            let quantizeResult;
            if (algorithm === 'median-cut') {
                quantizeResult = colorQuantizer.medianCutQuantize(imageData, colorCount);
            } else if (algorithm === 'simple') {
                quantizeResult = colorQuantizer.simpleQuantize(imageData, 8);
            } else {
                quantizeResult = colorQuantizer.kMeansQuantize(imageData, colorCount);
            }

            // 生成游戏网格
            const gameGrid = this.generateGameGrid(
                quantizeResult.quantizedData,
                quantizeResult.palette,
                gridSize
            );

            return {
                originalImage: img,
                processedImageData: quantizeResult.quantizedData,
                palette: quantizeResult.palette,
                gameGrid: gameGrid,
                dimensions: dimensions
            };

        } catch (error) {
            throw new Error(`图片处理失败: ${error.message}`);
        }
    }

    /**
     * 生成游戏网格（像素级别）
     * @param {ImageData} imageData - 处理后的图像数据
     * @param {Array} palette - 调色板
     * @param {string|number} gridSize - 网格大小（对于像素级别游戏忽略此参数）
     * @returns {Array} 游戏网格数据
     */
    generateGameGrid(imageData, palette, gridSize) {
        const { width, height } = imageData;
        const data = imageData.data;

        console.log(`生成像素级网格: ${width}x${height}, 调色板颜色数量: ${palette.length}`);

        // 每个像素都是一个游戏格子
        const grid = [];
        let validPixels = 0;
        let totalPixels = 0;

        for (let row = 0; row < height; row++) {
            const gridRow = [];
            for (let col = 0; col < width; col++) {
                const pixelIndex = (row * width + col) * 4;
                totalPixels++;
                
                // 检查像素是否透明
                if (data[pixelIndex + 3] > 128) { // 非透明像素
                    const pixelColor = {
                        r: data[pixelIndex],
                        g: data[pixelIndex + 1],
                        b: data[pixelIndex + 2]
                    };

                    // 找到最接近的调色板颜色
                    const closestPaletteItem = this.findClosestPaletteColor(pixelColor, palette);
                    
                    if (closestPaletteItem && closestPaletteItem.color) {
                        gridRow.push({
                            row: row,
                            col: col,
                            x: col,
                            y: row,
                            width: 1,
                            height: 1,
                            color: closestPaletteItem.color,
                            number: closestPaletteItem.number,
                            revealed: false,
                            pixelCount: 1
                        });
                        validPixels++;
                    } else {
                        console.warn('找不到匹配的调色板颜色:', pixelColor);
                        gridRow.push(null);
                    }
                } else {
                    // 透明像素
                    gridRow.push(null);
                }
            }
            grid.push(gridRow);
        }

        console.log(`网格生成完成: 总像素 ${totalPixels}, 有效像素 ${validPixels}`);
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
            console.error('调色板为空');
            return null;
        }

        let minDistance = Infinity;
        let closestItem = palette[0];
        
        for (const paletteItem of palette) {
            if (!paletteItem || !paletteItem.color) {
                console.warn('无效的调色板项:', paletteItem);
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
            result.errors.push('请选择一个文件');
            return result;
        }

        if (!allowedTypes.includes(file.type.toLowerCase())) {
            result.valid = false;
            result.errors.push('不支持的文件格式，请选择 JPG、PNG、GIF 或 WebP 格式的图片');
        }

        if (file.size > maxSize) {
            result.valid = false;
            result.errors.push('文件大小不能超过 10MB');
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