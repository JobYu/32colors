/**
 * 工具函数模块
 * 提供项目中常用的辅助函数
 */

const Utils = {
    /**
     * 将RGB值转换为十六进制颜色
     * @param {number} r - 红色值 (0-255)
     * @param {number} g - 绿色值 (0-255)
     * @param {number} b - 蓝色值 (0-255)
     * @returns {string} 十六进制颜色字符串
     */
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    /**
     * 将十六进制颜色转换为RGB值
     * @param {string} hex - 十六进制颜色字符串
     * @returns {object} RGB对象 {r, g, b}
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    /**
     * 计算RGB颜色的灰度值
     * @param {number} r - 红色值
     * @param {number} g - 绿色值
     * @param {number} b - 蓝色值
     * @returns {number} 灰度值
     */
    getGrayscale(r, g, b) {
        return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    },

    /**
     * 计算两个颜色之间的欧几里得距离
     * @param {object} color1 - 第一个颜色 {r, g, b}
     * @param {object} color2 - 第二个颜色 {r, g, b}
     * @returns {number} 颜色距离
     */
    colorDistance(color1, color2) {
        const dr = color1.r - color2.r;
        const dg = color1.g - color2.g;
        const db = color1.b - color2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    },

    /**
     * 限制数值在指定范围内
     * @param {number} value - 要限制的值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 限制后的值
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * 生成指定范围内的随机整数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 随机整数
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * 防抖函数
     * @param {function} func - 要防抖的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {function} 防抖后的函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 节流函数
     * @param {function} func - 要节流的函数
     * @param {number} limit - 时间限制（毫秒）
     * @returns {function} 节流后的函数
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * 格式化时间为 MM:SS 格式
     * @param {number} seconds - 秒数
     * @returns {string} 格式化的时间字符串
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * 检查是否为有效的图片URL
     * @param {string} url - 要检查的URL
     * @returns {boolean} 是否为有效图片URL
     */
    isValidImageUrl(url) {
        const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;
        if (typeof url !== 'string') return false;

        // Handle data URLs
        if (url.startsWith('data:image/')) {
            return true;
        }

        // For relative paths (like local assets) or full URLs, just check extension.
        // The Image object itself will fail to load if the path is truly invalid.
        return imageExtensions.test(url);
    },

    /**
     * 获取图片文件的类型
     * @param {File} file - 图片文件
     * @returns {string} 文件类型
     */
    getImageType(file) {
        const type = file.type.toLowerCase();
        if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg';
        if (type.includes('png')) return 'png';
        if (type.includes('gif')) return 'gif';
        if (type.includes('webp')) return 'webp';
        if (type.includes('bmp')) return 'bmp';
        return 'unknown';
    },

    /**
     * 创建下载链接
     * @param {string} data - 数据URL或Blob URL
     * @param {string} filename - 文件名
     */
    downloadFile(data, filename) {
        const link = document.createElement('a');
        link.href = data;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * 显示通知消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型 ('success', 'error', 'warning', 'info')
     * @param {number} duration - 显示时长（毫秒）
     */
    showNotification(message, type = 'info', duration = 3000) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加样式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease'
        });

        // 设置背景颜色
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // 添加到页面
        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);

        // 自动隐藏
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, duration);
    },

    /**
     * Capitalizes the first letter of a string.
     * @param {string} string - The input string.
     * @returns {string} The string with the first letter capitalized.
     */
    capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    /**
     * localStorage wrapper for easy getting/setting of JSON data.
     */
    storage: {
        get(key, defaultValue = null) {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            try {
                return JSON.parse(item);
            } catch (e) {
                console.error(`Error parsing localStorage item "${key}":`, e);
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error(`Error setting localStorage item "${key}":`, e);
                // Potentially handle quota exceeded error
                Utils.showNotification('无法保存到本地存储，可能已满。', 'error');
            }
        },
        remove(key) {
            localStorage.removeItem(key);
        }
    },

    /**
     * Simple deep clone function for objects and arrays.
     * @param {*} obj - The object or array to clone.
     * @returns {*} The deep cloned object or array.
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => Utils.deepClone(item));
        }

        const cloned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = Utils.deepClone(obj[key]);
            }
        }
        return cloned;
    },

    /**
     * Upscales an existing image data URL using nearest-neighbor scaling.
     * @param {string} imageDataUrl - The data URL of the image to upscale.
     * @param {number} targetWidth - The desired target width.
     * @param {number} targetHeight - The desired target height.
     * @returns {Promise<string>} A promise that resolves with the data URL of the upscaled image.
     */
    async upscaleImageDataUrl(imageDataUrl, targetWidth, targetHeight) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = targetWidth;
                tempCanvas.height = targetHeight;
                const tempCtx = tempCanvas.getContext('2d');

                // Ensure nearest-neighbor scaling
                tempCtx.imageSmoothingEnabled = false;
                // For Firefox and older browsers, these might be needed for crisper edges
                tempCtx.mozImageSmoothingEnabled = false;
                tempCtx.webkitImageSmoothingEnabled = false;
                tempCtx.msImageSmoothingEnabled = false;

                tempCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
                resolve(tempCanvas.toDataURL());
            };
            img.onerror = (err) => {
                console.error('Failed to load image for upscaling:', err);
                reject('Failed to load image for upscaling');
            };
            img.src = imageDataUrl;
        });
    }
};

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
} 