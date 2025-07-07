/**
 * Canvas渲染器模块
 * 负责游戏画布的绘制和交互
 */

class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameData = null;
        this.bucketToolActive = false;
        
        // 变换状态
        this.transform = {
            scale: 1,
            translateX: 0,
            translateY: 0
        };
        
        // 渲染设置
        this.settings = {
            showGrid: true,
            showNumbers: true,
            showOriginal: false,
            minZoomForClick: 1.0,  // 降低最小点击缩放要求，桌面端1倍即可点击
            mobileMinZoomForClick: 0.8, // 移动端0.8倍即可点击
            maxZoom: 100,          // 大幅提高像素模式最大缩放，支持超精细查看
            gridModeMaxZoom: 60,   // 提高网格模式最大缩放
            minZoom: 0.5,          // 最小50%缩放，让用户可以看到更多内容
            zoomFactor: 1.5,       // 增加每次放大倍数到50%，更快达到高缩放
            gridModeThreshold: 12  // 12倍缩放时切换到网格模式（500% * 1.2^6 ≈ 12倍）
        };
        
        // 交互状态
        this.interaction = {
            isDragging: false,
            lastMousePos: { x: 0, y: 0 },
            highlightedNumber: null,
            // 移除hoveredCell和lastHoverCheck，因为不再需要悬停高亮
            // 触摸相关状态
            touches: [],
            lastTouchDistance: 0,
            lastTouchCenter: { x: 0, y: 0 },
            isTouchZooming: false,
            touchStartTime: 0,
            touchMoved: false
        };
        
        this.setupEventListeners();
    }

    /**
     * 设置游戏数据
     * @param {object} gameData - 游戏数据
     */
    setGameData(gameData) {
        this.gameData = gameData;
        this.resetView();
        this.render();
    }

    /**
     * 重置视图到初始状态（像素级别游戏需要更大的初始缩放）
     */
    resetView() {
        if (!this.gameData) return;
        
        const { dimensions } = this.gameData;
        
        // 根据设备类型设置合理的初始缩放，既要便于点击又要保持良好的视觉效果
        let scale;
        if (this.isMobileDevice()) {
            // 移动端：根据图片大小动态调整，平衡可见性和点击精度
            if (Math.max(dimensions.width, dimensions.height) <= 16) {
                scale = 12; // 小图片适度放大，便于点击
            } else if (Math.max(dimensions.width, dimensions.height) <= 32) {
                scale = 8;  // 中等图片适中放大
            } else if (Math.max(dimensions.width, dimensions.height) <= 64) {
                scale = 6;  // 较大图片适度放大
            } else {
                scale = 4;  // 大图片保证基本点击精度
            }
        } else {
            // 桌面端：适中的初始缩放
            if (Math.max(dimensions.width, dimensions.height) <= 16) {
                scale = 10; // 小图片适度放大
            } else if (Math.max(dimensions.width, dimensions.height) <= 32) {
                scale = 8;  // 中等图片适中放大
            } else if (Math.max(dimensions.width, dimensions.height) <= 64) {
                scale = 5;  // 较大图片适度放大
            } else {
                scale = 3;  // 大图片保证显示完整
            }
        }
        
        // 检查是否需要缩小以适应屏幕
        const maxFitScaleX = (this.canvas.width - 40) / dimensions.width;
        const maxFitScaleY = (this.canvas.height - 40) / dimensions.height;
        const maxFitScale = Math.min(maxFitScaleX, maxFitScaleY);

        if (scale > maxFitScale && maxFitScale > 0) {
            // 如果计算的缩放太大，使用适合屏幕的缩放
            const minClickScale = this.isMobileDevice() ? this.settings.mobileMinZoomForClick : this.settings.minZoomForClick;
            scale = Math.max(minClickScale, maxFitScale); // 确保达到最小点击缩放要求
        }
        
        // 确保缩放不小于最小值
        scale = Math.max(this.settings.minZoom, scale);
                
        this.transform = {
            scale: scale,
            translateX: (this.canvas.width - dimensions.width * scale) / 2,
            translateY: (this.canvas.height - dimensions.height * scale) / 2
        };
    }

    /**
     * 设置画布尺寸
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    setCanvasSize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.render();
    }

    /**
     * 主渲染函数（优化高缩放级别性能）
     */
    render() {
        if (!this.gameData) {
            this.renderEmptyState();
            return;
        }

        // 调试信息
        if (window.location.hostname === 'localhost') {
            console.log(`渲染缩放级别: ${this.transform.scale.toFixed(2)}x, 平移: (${this.transform.translateX.toFixed(1)}, ${this.transform.translateY.toFixed(1)})`);
        }

        // 使用requestAnimationFrame优化渲染性能
        if (this._renderFrame) {
            cancelAnimationFrame(this._renderFrame);
        }
        
        this._renderFrame = requestAnimationFrame(() => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.save();
            this.applyTransform();
            
            if (this.settings.showOriginal) {
                this.renderOriginalImage();
            } else {
                this.renderGameGrid();
            }
            
            this.ctx.restore();
            this._renderFrame = null;
        });
    }

    /**
     * 渲染空状态
     */
    renderEmptyState() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#6c757d';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            '选择图片并生成游戏开始填色',
            this.canvas.width / 2,
            this.canvas.height / 2
        );
    }

    /**
     * 应用变换
     */
    applyTransform() {
        this.ctx.translate(this.transform.translateX, this.transform.translateY);
        this.ctx.scale(this.transform.scale, this.transform.scale);
    }

    /**
     * 渲染原始图片
     */
    renderOriginalImage() {
        const { processedImageData, dimensions } = this.gameData;
        
        // 关闭抗锯齿，保持像素画的硬边缘效果
        this.ctx.imageSmoothingEnabled = false;
        
        // 创建临时画布来显示图像数据
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = dimensions.width;
        tempCanvas.height = dimensions.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 临时画布也关闭抗锯齿
        tempCtx.imageSmoothingEnabled = false;
        tempCtx.putImageData(processedImageData, 0, 0);
        
        this.ctx.drawImage(tempCanvas, 0, 0);
    }

    /**
     * 渲染游戏网格（像素级别 - 修复高缩放灰色问题）
     */
    renderGameGrid() {
        // 双重保险：在渲染前再次检查gameData是否存在，防止在异步调用中被清除
        if (!this.gameData) {
            console.warn('[CanvasRenderer] renderGameGrid called with null gameData. Aborting render.');
            return;
        }

        const { gameGrid, dimensions } = this.gameData;
        const { scale } = this.transform;
        
        // 绘制背景
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, dimensions.width, dimensions.height);
        
        // 计算当前视野范围（优化性能）
        const viewportBounds = this.getViewportBounds();
        
        // 调试信息：记录渲染的单元格数量
        let renderedCells = 0;
        
        // 只渲染视野范围内的像素（优化高缩放性能）
        const startRow = Math.max(0, Math.floor(viewportBounds.top));
        const endRow = Math.min(gameGrid.length, Math.ceil(viewportBounds.bottom + 1));
        const startCol = Math.max(0, Math.floor(viewportBounds.left));
        const endCol = Math.min(gameGrid[0]?.length || 0, Math.ceil(viewportBounds.right + 1));
        
        // 绘制网格单元
        for (let row = startRow; row < endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                if (gameGrid[row] && gameGrid[row][col]) {
                    const cell = gameGrid[row][col];
                    this.renderPixelCell(cell);
                    renderedCells++;
                }
            }
        }
        
        // 调试输出（只在开发环境下）
        if (window.location.hostname === 'localhost') {
            const mode = this.transform.scale >= this.settings.gridModeThreshold ? '网格模式' : '像素模式';
            console.log(`${mode} 缩放: ${this.transform.scale.toFixed(1)}x, 渲染了${renderedCells}个像素`);
        }
    }

    /**
     * 获取当前视野范围（世界坐标）
     */
    getViewportBounds() {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.canvas.width, this.canvas.height);
        
        return {
            left: topLeft.x,
            top: topLeft.y,
            right: bottomRight.x,
            bottom: bottomRight.y
        };
    }

    /**
     * 渲染单个像素单元（专门为像素级优化）
     * @param {object} cell - 网格单元数据
     */
    renderPixelCell(cell) {
        if (!cell) return;

        // If cell is marked as transparent, skip rendering it (it will show the canvas background or layers below)
        if (cell.isTransparent) {
            // We could explicitly clearRect here if needed, but often just skipping is enough
            // this.ctx.clearRect(cell.x, cell.y, cell.width, cell.height);
            return;
        }
        
        if (!cell.color) { // Check for color object specifically
             console.warn('Cell has no color object:', cell);
            return;
        }

        const { x, y, width, height, color, number, revealed } = cell;
        
        if (typeof color.r === 'undefined' || typeof color.g === 'undefined' || typeof color.b === 'undefined') {
            console.warn('无效的颜色数据:', color, 'in cell:', cell);
            return;
        }
        
        this.ctx.imageSmoothingEnabled = false;

        if (revealed) {
            // Use actual cell color, including its alpha if present (though palette colors are usually opaque)
            const alpha = (typeof color.a === 'number') ? color.a / 255 : 1;
            this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
            this.ctx.fillRect(x, y, width, height);
        } else {
            // Unrevealed, non-transparent cells - use grayscale version of original color
            let fillColor = 'rgba(220, 220, 220, 0.7)'; // Default fallback
            if (cell.originalColor && typeof cell.originalColor.r !== 'undefined') {
                // Calculate grayscale value from original color
                const grayscale = Utils.getGrayscale(cell.originalColor.r, cell.originalColor.g, cell.originalColor.b);
                fillColor = `rgba(${grayscale}, ${grayscale}, ${grayscale}, 0.8)`;
            }
            this.ctx.fillStyle = fillColor;
            this.ctx.fillRect(x, y, width, height);
            
            // Draw numbers only if enabled and scale is sufficient
            if (this.settings.showNumbers && this.shouldShowNumbers()) {
                if (this.isGridMode()) {
                    this.renderPixelNumber(cell);
                } else {
                    // For pixel mode, numbers might be too small or clutter display.
                    // Consider a different rendering or condition for pixel numbers if desired.
                    // this.renderPixelNumber(cell); // Or this.renderSimplePixelNumber(cell)
                }
            }
        }
        
        // Draw grid lines if in grid mode or high zoom in pixel mode
        if (this.settings.showGrid && (this.isGridMode() || this.transform.scale >= 5)) {
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            this.ctx.lineWidth = 1 / this.transform.scale; // Keep grid lines thin
            this.ctx.strokeRect(x, y, width, height);
        }
        
        // Highlight selected number (保留图例选择时的黄色高亮)
        if (this.interaction.highlightedNumber !== null && this.interaction.highlightedNumber === number && !revealed) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            this.ctx.fillRect(x, y, width, height);
        }

        // 移除悬停高亮效果 - 用户不希望看到绿色/蓝色方格
        // 点击应该直接生效，不需要悬停预览
    }

    /**
     * 渲染简化的像素数字（高缩放时使用，无白色描边）
     * @param {object} cell - 网格单元数据
     */
    renderSimplePixelNumber(cell) {
        const { x, y, width, height, number } = cell;
        
        // 根据当前缩放级别调整字体大小，使屏幕显示始终为12px
        const targetScreenSize = 12; // 目标屏幕显示大小
        const fontSize = targetScreenSize / this.transform.scale;
        
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.fillStyle = '#000000'; // 纯黑色，无描边
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 绘制数字（无描边），确保在网格中心
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        this.ctx.fillText(number.toString(), centerX, centerY);
    }

    /**
     * 渲染像素数字（优化版本）
     * @param {object} cell - 网格单元数据
     */
    renderPixelNumber(cell) {
        const { x, y, width, height, number } = cell;
        
        // 计算像素在屏幕上的实际大小
        const screenSize = width * this.transform.scale;
        
        // 只有当像素在屏幕上足够大时才显示数字
        if (screenSize < 24) return;
        
        // 根据当前缩放级别调整字体大小，使屏幕显示始终为12px
        const targetScreenSize = 12; // 目标屏幕显示大小
        const fontSize = targetScreenSize / this.transform.scale;
        
        this.ctx.font = `bold ${fontSize}px Arial`;
        this.ctx.fillStyle = '#333333';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 移除白色描边以简化数字显示
        // this.ctx.strokeStyle = '#ffffff';
        // this.ctx.lineWidth = Math.max(0.5, fontSize / 8);
        
        // 绘制数字（无描边）
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        // this.ctx.strokeText(number.toString(), centerX, centerY);
        this.ctx.fillText(number.toString(), centerX, centerY);
    }

    /**
     * 判断是否应该显示数字（像素级别）
     * @returns {boolean} 是否显示数字
     */
    shouldShowNumbers() {
        // 在网格模式时，让用户刚进入网格模式就能看到数字
        if (this.transform.scale >= this.settings.gridModeThreshold) {
            return this.transform.scale >= 12; // 网格模式阈值就开始显示数字
        }
        // 普通模式下需要更高的缩放才显示数字
        return this.transform.scale >= 10;
    }

    /**
     * 检查是否处于网格模式
     * @returns {boolean} 是否处于网格模式
     */
    isGridMode() {
        return this.transform.scale >= this.settings.gridModeThreshold;
    }

    /**
     * 缩放功能（添加网格模式缩放限制）
     * @param {number} factor - 缩放因子（默认使用设置中的缩放系数）
     * @param {object} center - 缩放中心点 {x, y}
     */
    zoom(factor = this.settings.zoomFactor, center = null) {
        // 根据当前模式确定最大缩放限制
        const currentMaxZoom = this.isGridMode() ? 
            this.settings.gridModeMaxZoom : 
            this.settings.maxZoom;
        
        const newScale = Utils.clamp(
            this.transform.scale * factor,
            this.settings.minZoom,
            currentMaxZoom
        );
        
        if (newScale === this.transform.scale) return;
        
        // 如果没有指定中心点，使用画布中心
        if (!center) {
            center = {
                x: this.canvas.width / 2,
                y: this.canvas.height / 2
            };
        }
        
        // 计算缩放前的世界坐标
        const worldX = (center.x - this.transform.translateX) / this.transform.scale;
        const worldY = (center.y - this.transform.translateY) / this.transform.scale;
        
        // 更新缩放
        this.transform.scale = newScale;
        
        // 调整平移以保持缩放中心不变
        this.transform.translateX = center.x - worldX * this.transform.scale;
        this.transform.translateY = center.y - worldY * this.transform.scale;
        
        this.render();
    }

    /**
     * 平移功能
     * @param {number} deltaX - X轴偏移
     * @param {number} deltaY - Y轴偏移
     */
    pan(deltaX, deltaY) {
        this.transform.translateX += deltaX;
        this.transform.translateY += deltaY;
        this.render();
    }

    /**
     * 将屏幕坐标转换为世界坐标
     * @param {number} screenX - 屏幕X坐标
     * @param {number} screenY - 屏幕Y坐标
     * @returns {object} 世界坐标 {x, y}
     */
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.transform.translateX) / this.transform.scale,
            y: (screenY - this.transform.translateY) / this.transform.scale
        };
    }

    /**
     * 获取指定坐标的网格单元（像素级别精确查找）
     * @param {number} worldX - 世界X坐标
     * @param {number} worldY - 世界Y坐标
     * @returns {object|null} 网格单元或null
     */
    getCellAt(worldX, worldY) {
        if (!this.gameData) return null;
        
        const { gameGrid } = this.gameData;
        
        // 对于像素级别的游戏，直接通过坐标计算对应的像素
        const col = Math.floor(worldX);
        const row = Math.floor(worldY);
        
        // 检查坐标是否在有效范围内
        if (row >= 0 && row < gameGrid.length && col >= 0 && col < gameGrid[row].length) {
            return gameGrid[row][col];
        }
        
        return null;
    }

    /**
     * 填充单元格
     * @param {object} cell - 要填充的单元格
     */
    fillCell(cell) {
        if (cell && !cell.revealed) {
            cell.revealed = true;
            this.render();
            return true;
        }
        return false;
    }

    /**
     * 高亮指定数字的所有单元格
     * @param {number} number - 要高亮的数字
     */
    highlightNumber(number) {
        this.interaction.highlightedNumber = number;
        this.render();
    }

    /**
     * 清除高亮
     */
    clearHighlight() {
        this.interaction.highlightedNumber = null;
        this.render();
    }

    /**
     * 更新鼠标样式
     * @param {object} cell - 当前悬停的格子
     */
    updateCursorStyle(cell) {
        if (this.interaction.isDragging) {
            this.canvas.style.cursor = 'grabbing';
        } else if (this.bucketToolActive) {
            // Bucket tool 激活时使用特殊光标
            this.canvas.style.cursor = 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTQgNEwxOCA4TDE2IDEwTDE0IDhMMTIgMTBMMTAgOEw4IDEwTDYgOEwxMCA0TDEyIDJaIiBzdHJva2U9IiMwMDAiIGZpbGw9IiNmZmYiLz4KPC9zdmc+") 12 12, pointer';
        } else if (cell) {
            // 有方格就显示pointer，去掉canClick检查
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    /**
     * 设置 bucket tool 状态
     * @param {boolean} active - 是否激活 bucket tool
     */
    setBucketToolActive(active) {
        this.bucketToolActive = active;
        this.updateCursorStyle(null);
    }

    /**
     * 切换网格显示
     */
    toggleGrid() {
        this.settings.showGrid = !this.settings.showGrid;
        this.render();
    }

    /**
     * 切换原图显示
     */
    toggleOriginal() {
        this.settings.showOriginal = !this.settings.showOriginal;
        this.render();
    }

    /**
     * 检查是否可以点击（像素级别降低点击要求）
     * @returns {boolean} 是否可以点击
     */
    canClick() {
        // 统一使用移动端的点击要求，让桌面端和移动端体验一致
        return this.transform.scale >= this.settings.mobileMinZoomForClick; // 0.8倍缩放即可点击
    }

    /**
     * 将浏览器事件坐标转换为Canvas绘图表面坐标
     * @param {MouseEvent | Touch} event - 鼠标或触摸事件对象
     * @returns {{x: number, y: number}} - 转换后的Canvas坐标
     */
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        
        // 计算显示尺寸和绘图表面尺寸的比例
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // 根据比例校正坐标
        const canvasX = (event.clientX - rect.left) * scaleX;
        const canvasY = (event.clientY - rect.top) * scaleY;
        
        return { x: canvasX, y: canvasY };
    }

    /**
     * 设置事件监听器 (已修复版本)
     */
    setupEventListeners() {
        // 鼠标滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // 使用辅助函数获取正确的缩放中心
            const center = this.getCanvasCoordinates(e);
            
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom(factor, center);
        });

        // 鼠标拖拽平移
        this.canvas.addEventListener('mousedown', (e) => {
            this.interaction.isDragging = true;
            // lastMousePos 应该存储原始的 clientX/Y，因为 pan 函数是基于屏幕像素的偏移
            this.interaction.lastMousePos = { x: e.clientX, y: e.clientY };
            this.updateCursorStyle(null);
        });

        // 注意：全局 mousemove 和 mouseup 不需要转换坐标，因为它们计算的是屏幕上的位移（delta）
        document.addEventListener('mousemove', (e) => {
            if (this.interaction.isDragging) {
                const deltaX = e.clientX - this.interaction.lastMousePos.x;
                const deltaY = e.clientY - this.interaction.lastMousePos.y;
                
                this.pan(deltaX, deltaY);
                
                this.interaction.lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });

        // 鼠标悬停检测（简化版 - 只更新光标样式）
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.interaction.isDragging) return;
            
            // 使用辅助函数获取正确的Canvas坐标
            const { x: canvasX, y: canvasY } = this.getCanvasCoordinates(e);
            
            const worldPos = this.screenToWorld(canvasX, canvasY);
            const cell = this.getSmartCellAt(worldPos.x, worldPos.y);
            
            this.updateCursorStyle(cell);
        });

        // 鼠标离开画布时清除状态
        this.canvas.addEventListener('mouseleave', () => {
            this.updateCursorStyle(null);
        });

        document.addEventListener('mouseup', () => {
            this.interaction.isDragging = false;
            this.updateCursorStyle(null);
        });

        // 点击填色
        this.canvas.addEventListener('click', (e) => {
            if (this.interaction.isDragging) return;
            
            // 使用辅助函数获取正确的点击坐标
            const { x: canvasX, y: canvasY } = this.getCanvasCoordinates(e);
            
            console.log(`[坐标转换] 屏幕坐标: (${e.clientX.toFixed(2)}, ${e.clientY.toFixed(2)})`);
            console.log(`[坐标转换] 校正后Canvas坐标: (${canvasX.toFixed(2)}, ${canvasY.toFixed(2)})`);
            console.log(`[坐标转换] Canvas尺寸: ${this.canvas.width}x${this.canvas.height}`);
            console.log(`[坐标转换] 变换状态: 缩放=${this.transform.scale.toFixed(2)}, 平移=(${this.transform.translateX.toFixed(2)}, ${this.transform.translateY.toFixed(2)})`);
            
            const worldPos = this.screenToWorld(canvasX, canvasY);
            console.log(`[坐标转换] 世界坐标: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
            
            const cell = this.getSmartCellAt(worldPos.x, worldPos.y);
            
            if (cell) {
                console.log(`[点击结果] 成功找到格子，准备填色...`);
                requestAnimationFrame(() => {
                    const event = new CustomEvent('cellClick', { detail: cell });
                    this.canvas.dispatchEvent(event);
                });
            } else {
                console.log(`[点击结果] ❌ 未找到可点击的格子`);
            }
        });

        // 添加移动端触摸支持
        this.setupTouchEvents();
    }

    /**
     * 设置触摸事件监听器 (已修复版本)
     */
    setupTouchEvents() {
        // 触摸开始
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            // 使用辅助函数转换每个触摸点的坐标
            this.interaction.touches = Array.from(e.touches).map(touch => {
                const { x, y } = this.getCanvasCoordinates(touch);
                return { id: touch.identifier, x, y };
            });

            this.interaction.touchStartTime = Date.now();
            this.interaction.touchMoved = false;

            if (this.interaction.touches.length === 1) {
                // 单指触摸 - 准备拖拽
                this.interaction.isDragging = true;
                // lastMousePos 存储的是转换后的Canvas坐标
                this.interaction.lastMousePos = {
                    x: this.interaction.touches[0].x,
                    y: this.interaction.touches[0].y
                };
            } else if (this.interaction.touches.length === 2) {
                // 双指触摸 - 准备缩放
                this.interaction.isTouchZooming = true;
                this.interaction.isDragging = false;
                
                const distance = this.getTouchDistance(this.interaction.touches[0], this.interaction.touches[1]);
                this.interaction.lastTouchDistance = distance;
                
                const center = this.getTouchCenter(this.interaction.touches[0], this.interaction.touches[1]);
                this.interaction.lastTouchCenter = center;
            }
        });

        // 触摸移动
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (this.interaction.touches.length === 0) return;

            // 转换当前所有触摸点的坐标
            const currentTouches = Array.from(e.touches).map(touch => {
                const { x, y } = this.getCanvasCoordinates(touch);
                return { id: touch.identifier, x, y };
            });

            // 统一移动端和桌面端的移动阈值，减少误判
            const moveThreshold = 15;
            if (currentTouches.length === 1 && this.interaction.touches.length === 1) {
                const deltaX = currentTouches[0].x - this.interaction.touches[0].x;
                const deltaY = currentTouches[0].y - this.interaction.touches[0].y;
                const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                if (moveDistance > moveThreshold) {
                    this.interaction.touchMoved = true;
                }
            } else {
                this.interaction.touchMoved = true;
            }

            if (currentTouches.length === 1 && this.interaction.isDragging) {
                // 单指拖拽
                const deltaX = currentTouches[0].x - this.interaction.lastMousePos.x;
                const deltaY = currentTouches[0].y - this.interaction.lastMousePos.y;
                
                // pan 函数需要的是屏幕像素的偏移，但由于我们所有的触摸坐标都已转换，
                // 这里的 delta 是在Canvas坐标系下的。为了简化，我们直接用它来平移，
                // 但需要注意，如果Canvas被严重拉伸，拖拽速度可能会感觉不一致。
                // 一个更精确的方法是重新计算屏幕像素的delta，但当前方法通常足够好。
                this.pan(deltaX, deltaY);
                
                this.interaction.lastMousePos = { x: currentTouches[0].x, y: currentTouches[0].y };

            } else if (currentTouches.length === 2 && this.interaction.touches.length === 2) {
                // 双指缩放
                const distance = this.getTouchDistance(currentTouches[0], currentTouches[1]);
                const center = this.getTouchCenter(currentTouches[0], currentTouches[1]);
                
                if (this.interaction.isTouchZooming && this.interaction.lastTouchDistance > 0) {
                    const scaleFactor = distance / this.interaction.lastTouchDistance;
                    this.zoom(scaleFactor, center);
                    
                    const centerDeltaX = center.x - this.interaction.lastTouchCenter.x;
                    const centerDeltaY = center.y - this.interaction.lastTouchCenter.y;
                    this.pan(centerDeltaX, centerDeltaY);
                }
                
                this.interaction.lastTouchDistance = distance;
                this.interaction.lastTouchCenter = center;
            }

            // 更新触摸点记录（注意：这里我们不需要再次转换，因为currentTouches已经是转换后的）
            // this.interaction.touches = currentTouches; 
            // 实际上，我们需要原始的触摸点来计算下一次的移动，所以应该更新为原始的触摸点
            // 但为了逻辑一致性，我们继续使用转换后的坐标
            this.interaction.touches = currentTouches;
        });

        // 触摸结束
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            const touchDuration = Date.now() - this.interaction.touchStartTime;
            const wasQuickTap = touchDuration < 500 && !this.interaction.touchMoved;

            // touchend 事件的 e.touches 是空的，我们需要用 e.changedTouches
            if (wasQuickTap && e.changedTouches.length === 1) {
                // 快速点击 - 填色
                const touch = e.changedTouches[0];
                const { x: canvasX, y: canvasY } = this.getCanvasCoordinates(touch);
                
                const worldPos = this.screenToWorld(canvasX, canvasY);
                const cell = this.getSmartCellAt(worldPos.x, worldPos.y);
                
                if (cell) {
                    requestAnimationFrame(() => {
                        const event = new CustomEvent('cellClick', { detail: cell });
                        this.canvas.dispatchEvent(event);
                    });
                }
            }

            // 重置状态
            this.interaction.isDragging = false;
            this.interaction.isTouchZooming = false;
            // e.touches 在 touchend 时会变少，我们通过 e.touches.length 来判断是否完全结束
            if (e.touches.length === 0) {
                this.interaction.touches = [];
                this.interaction.lastTouchDistance = 0;
                this.interaction.touchMoved = false;
            }
        });

        this.canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            // 重置所有交互状态
            this.interaction.isDragging = false;
            this.interaction.isTouchZooming = false;
            this.interaction.touches = [];
            this.interaction.lastTouchDistance = 0;
            this.interaction.touchMoved = false;
        });
    }

    /**
     * 计算两个触摸点之间的距离
     */
    getTouchDistance(touch1, touch2) {
        const dx = touch2.x - touch1.x;
        const dy = touch2.y - touch1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 计算两个触摸点的中心
     */
    getTouchCenter(touch1, touch2) {
        return {
            x: (touch1.x + touch2.x) / 2,
            y: (touch1.y + touch2.y) / 2
        };
    }

    /**
     * 智能点击检测 - 根据缩放级别选择最佳检测策略
     * @param {number} x - 世界坐标X
     * @param {number} y - 世界坐标Y
     * @returns {object} 单元格数据
     */
    getSmartCellAt(x, y) {
        if (!this.gameData || !this.gameData.gameGrid) return null;
        
        console.log(`[点击检测] 世界坐标: (${x.toFixed(2)}, ${y.toFixed(2)}), 缩放: ${this.transform.scale.toFixed(2)}`);
        
        // 首先尝试精确匹配
        let cell = this.getCellAt(x, y);
        if (cell) {
            console.log(`[点击检测] ✅ 精确匹配成功: 格子(${cell.col}, ${cell.row}), 数字: ${cell.number}, 已填充: ${cell.revealed}`);
            return cell;
        }
        
        // 统一移动端和桌面端的点击检测算法
        const scale = this.transform.scale;
        const needsExpansion = scale < 2.5; // 使用移动端的阈值
        
        if (!needsExpansion) {
            console.log(`[点击检测] ❌ 缩放级别${scale.toFixed(2)}足够高，无精确匹配，不使用扩展搜索`);
            return null;
        }
        
        console.log(`[点击检测] 🔍 开始扩展搜索...`);
        
        // 统一使用移动端的扩展搜索范围
        const maxOffset = 1.2;
        const searchPoints = [
            { dx: 0, dy: 0 },           // 再次检查中心点
            { dx: -maxOffset, dy: 0 },
            { dx: maxOffset, dy: 0 },
            { dx: 0, dy: -maxOffset },
            { dx: 0, dy: maxOffset },
            { dx: -maxOffset, dy: -maxOffset },
            { dx: maxOffset, dy: -maxOffset },
            { dx: -maxOffset, dy: maxOffset },
            { dx: maxOffset, dy: maxOffset }
        ];
        
        for (const point of searchPoints) {
            const testX = x + point.dx;
            const testY = y + point.dy;
            cell = this.getCellAt(testX, testY);
            if (cell) {
                console.log(`[点击检测] ✅ 扩展搜索找到: 格子(${cell.col}, ${cell.row}), 数字: ${cell.number}, 测试坐标(${testX.toFixed(2)}, ${testY.toFixed(2)}), 偏移(${point.dx}, ${point.dy})`);
                return cell;
            }
        }
        
        console.log(`[点击检测] ❌ 扩展搜索也未找到有效格子`);
        return null;
    }

    /**
     * 获取指定坐标的单元格（扩大的点击区域，适用于移动端）
     * @param {number} x - 世界坐标X
     * @param {number} y - 世界坐标Y
     * @returns {object} 单元格数据
     */
    getCellAtWithExpandedHitArea(x, y) {
        if (!this.gameData || !this.gameData.gameGrid) return null;
        
        const { gameGrid } = this.gameData;
        
        // 改进点击区域计算：低缩放时扩大点击区域，高缩放时保持精确度
        // 统一使用移动端的基础扩展半径
        const baseRadius = 3.0;
        
        // 缩放因子：低缩放级别：使用较大的扩展区域
        let scaleFactor;
        if (this.transform.scale < 2) {
            // 低缩放级别：使用较大的扩展区域
            scaleFactor = Math.max(1.5, 3.0 / this.transform.scale);
        } else if (this.transform.scale < 5) {
            // 中等缩放级别：逐渐减少扩展区域
            scaleFactor = 1.5 - (this.transform.scale - 2) * 0.1;
        } else {
            // 高缩放级别：使用较小但仍然有效的扩展区域
            scaleFactor = Math.max(0.8, 1.0);
        }
        
        const expandRadius = baseRadius * scaleFactor;
        
        // 首先尝试精确匹配
        let cell = this.getCellAt(x, y);
        if (cell) return cell;
        
        // 如果没有精确匹配，尝试周围区域
        if (expandRadius > 0) {
            // 按距离优先级搜索，先搜索最近的格子
            const searchPoints = [];
            const maxRadius = Math.ceil(expandRadius);
            
            for (let dy = -maxRadius; dy <= maxRadius; dy++) {
                for (let dx = -maxRadius; dx <= maxRadius; dx++) {
                    if (dx === 0 && dy === 0) continue; // 已经检查过精确位置
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= expandRadius) {
                        searchPoints.push({ dx, dy, distance });
                    }
                }
            }
            
            // 按距离排序，优先检查最近的点
            searchPoints.sort((a, b) => a.distance - b.distance);
            
            for (const point of searchPoints) {
                cell = this.getCellAt(x + point.dx, y + point.dy);
                if (cell) return cell;
            }
        }
        
        return null;
    }

    /**
     * 检测是否为移动设备
     */
    isMobileDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * 获取当前变换状态
     * @returns {object} 变换状态
     */
    getTransform() {
        return { ...this.transform };
    }

    /**
     * 设置变换状态
     * @param {object} transform - 变换状态
     */
    setTransform(transform) {
        this.transform = transform;
        this.render();
    }

    /**
     * 导出当前游戏画面为图片
     * @param {number} scale - 导出图片的缩放比例
     * @param {boolean} showGrid - 是否显示网格线
     * @returns {string} Data URL of the exported image
     */
    exportImage(scale = 1, showGrid = false) {
        if (!this.gameData) {
            console.error('No game data to export.');
            return null;
        }

        console.log(`[CanvasRenderer] Exporting image with scale=${scale}, showGrid=${showGrid}`);

        const { dimensions } = this.gameData;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = dimensions.width * scale;
        exportCanvas.height = dimensions.height * scale;
        
        const exportCtx = exportCanvas.getContext('2d');

        // CRITICAL: Ensure canvas is cleared with transparency, not default opaque white
        exportCtx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Apply scaling
        exportCtx.scale(scale, scale);

        // Render the game grid onto the export canvas
        // Make sure to use a version of render that respects transparency
        this.renderFullGameGrid(exportCtx, true, showGrid, scale); // Pass scale for grid line width calculation

        // 重置变换，确保水印在正确的坐标系中绘制，不受缩放影响
        exportCtx.setTransform(1, 0, 0, 1, 0, 0);
        
        // 在此处添加水印
        this.addWatermark(exportCtx, exportCanvas.width, exportCanvas.height);

        console.log(`[CanvasRenderer] Export completed. Canvas size: ${exportCanvas.width}x${exportCanvas.height}`);
        return exportCanvas.toDataURL('image/png');
    }

    /**
     * 在指定的Canvas上下文上添加水印
     * @param {CanvasRenderingContext2D} ctx - 要添加水印的画布上下文
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    addWatermark(ctx, width, height) {
        const watermarkText = '32colors.com';
        
        // 动态计算字体大小，基于画布宽度的2.5%，最小不小于10px
        const fontSize = Math.max(10, width * 0.025);
        ctx.font = `bold ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
        
        // 设置水印颜色和透明度
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        
        // 设置文本对齐方式，从右下角开始绘制
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        // 计算边距，基于字体大小
        const margin = fontSize * 0.5;
        
        // 绘制水印
        ctx.fillText(watermarkText, width - margin, height - margin);
    }

    /**
     * 渲染完整的游戏网格到指定的上下文（用于导出）
     * @param {CanvasRenderingContext2D} ctx - 目标画布的2D上下文
     * @param {boolean} isExporting - Flag to indicate if this is for export (to handle transparency)
     * @param {boolean} showGrid - 是否显示网格线
     * @param {number} exportScale - 导出缩放比例，用于调整网格线宽度
     */
    renderFullGameGrid(ctx, isExporting = false, showGrid = false, exportScale = 1) {
        const { gameGrid, dimensions } = this.gameData;

        // If not exporting, we might draw a white background first (as currently done in renderGameGrid)
        // For exporting with transparency, we skip this.
        if (!isExporting) {
            ctx.fillStyle = '#ffffff'; // Default background if not exporting transparently
            ctx.fillRect(0, 0, dimensions.width, dimensions.height);
        }

        for (let row = 0; row < gameGrid.length; row++) {
            for (let col = 0; col < gameGrid[0].length; col++) {
                if (gameGrid[row] && gameGrid[row][col]) {
                    const cell = gameGrid[row][col];
                    this.renderPixelCellForExport(ctx, cell, isExporting, showGrid, exportScale);
                }
            }
        }
    }

    /**
     * 渲染单个像素单元到指定的上下文（用于导出）
     * @param {CanvasRenderingContext2D} ctx - 目标画布的2D上下文
     * @param {object} cell - 网格单元数据
     * @param {boolean} isExporting - Flag to indicate if this is for export (always true here)
     * @param {boolean} showGrid - 是否显示网格线
     * @param {number} exportScale - 导出缩放比例，用于调整网格线宽度
     */
    renderPixelCellForExport(ctx, cell, isExporting = true, showGrid = false, exportScale = 1) { // isExporting is effectively always true here
        if (!cell) return;

        if (cell.isTransparent) {
            // For export, explicitly make it transparent by clearing or doing nothing if canvas is already clear
            // If the main export canvas was cleared with transparent, doing nothing here is fine.
            // ctx.clearRect(cell.x, cell.y, cell.width, cell.height); 
            return;
        }

        if (!cell.color || typeof cell.color.r === 'undefined') {
            console.warn('Invalid cell for export:', cell);
            return;
        }      

        const { x, y, width, height, color, revealed } = cell;
        
        ctx.imageSmoothingEnabled = false;

        if (revealed) {
            // Use the cell's stored color. If it has an alpha channel, respect it.
            // Palette colors from quantizer are usually opaque (a=255 or undefined).
            // If original image had alpha, it's now in cell.color.a from ImageProcessor
            const alpha = (typeof color.a === 'number') ? color.a / 255 : 1;
            ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
            ctx.fillRect(x, y, width, height);
        } else {
            // For unrevealed cells during export: use grayscale version like in main render
            let fillColor = 'rgba(220, 220, 220, 0.7)'; // Default fallback
            if (cell.originalColor && typeof cell.originalColor.r !== 'undefined') {
                // Calculate grayscale value from original color
                const grayscale = Utils.getGrayscale(cell.originalColor.r, cell.originalColor.g, cell.originalColor.b);
                fillColor = `rgba(${grayscale}, ${grayscale}, ${grayscale}, 0.8)`;
            }
            ctx.fillStyle = fillColor;
            ctx.fillRect(x, y, width, height);
        }
        
        // Draw grid lines if showGrid is enabled
        if (showGrid) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'; // 15% opacity as requested
            
            // Use fixed 0.1px line width as requested by user
            ctx.lineWidth = 0.1;
            ctx.strokeRect(x, y, width, height);
            
            // Debug: Log grid drawing details for first few cells
            if (x < 3 && y < 3) {
                const actualPixelSize = width * exportScale;
                console.log(`[CanvasRenderer] Grid cell (${x}, ${y}): pixelSize=${actualPixelSize}px, lineWidth=0.1px, exportScale=${exportScale}, coverage=${((0.2/actualPixelSize)*100).toFixed(1)}%`);
            }
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 清理待执行的渲染帧
        if (this._renderFrame) {
            cancelAnimationFrame(this._renderFrame);
            this._renderFrame = null;
        }
        
        this.gameData = null;
        this.interaction.highlightedNumber = null;
        // 移除hoveredCell清理，因为不再需要
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Clears game data, resets transform and interaction state, and renders an empty state.
     */
    clearAndReset() {
        this.gameData = null;
        this.interaction.highlightedNumber = null;
        this.transform = {
            scale: 1,
            translateX: 0,
            translateY: 0
        };
        this.renderEmptyState(); // This already clears the canvas
    }
}

// 创建全局实例（将在main.js中初始化）
let canvasRenderer = null; 