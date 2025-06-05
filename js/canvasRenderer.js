/**
 * Canvas渲染器模块
 * 负责游戏画布的绘制和交互
 */

class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameData = null;
        
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
            minZoomForClick: 2,    // 降低最小点击缩放要求，适应像素级别
            maxZoom: 50,           // 像素模式最大缩放，支持查看单个像素细节
            gridModeMaxZoom: 25,   // 网格模式最大缩放，避免过度放大
            minZoom: 1,            // 最小100%缩放
            zoomFactor: 1.2,       // 每次点击放大20%
            gridModeThreshold: 12  // 12倍缩放时切换到网格模式（500% * 1.2^6 ≈ 12倍）
        };
        
        // 交互状态
        this.interaction = {
            isDragging: false,
            lastMousePos: { x: 0, y: 0 },
            highlightedNumber: null
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
        // const canvasRect = this.canvas.getBoundingClientRect(); // Not strictly needed if we default to 5x first
        
        // Set default 1000% (10x) zoom as the target
        let scale = 10; 
        
        // Optional: If 10x scale is too large to fit the image within the canvas view, 
        // then reduce scale to fit. This prevents extremely large images from being initially unusable.
        // Consider if this is desired, or if 10x should always be the rule.
        const maxFitScaleX = (this.canvas.width - 40) / dimensions.width; // 20px padding on each side
        const maxFitScaleY = (this.canvas.height - 40) / dimensions.height; // 20px padding on each side
        const maxFitScale = Math.min(maxFitScaleX, maxFitScaleY);

        if (scale > maxFitScale && maxFitScale > 0) { // only adjust if 10x is too big AND maxFitScale is valid
            // scale = maxFitScale; 
            // For now, let's always prioritize 10x. If it's too big, user can zoom out.
            // If you want it to always fit if 10x is too big, uncomment the line above.
        }
        
        // Ensure scale is not less than a minimum reasonable zoom, e.g., 1x, or 0.5x if images can be very large.
        scale = Math.max(this.settings.minZoom, scale); // settings.minZoom is 1 by default
                
        this.transform = {
            scale: scale,
            translateX: (this.canvas.width - dimensions.width * scale) / 2,
            translateY: (this.canvas.height - dimensions.height * scale) / 2
        };
        // No need to call this.render() here as setGameData, which calls resetView, will call render.
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
     * 主渲染函数
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

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.applyTransform();
        
        if (this.settings.showOriginal) {
            this.renderOriginalImage();
        } else {
            this.renderGameGrid();
        }
        
        this.ctx.restore();
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
        const { gameGrid, dimensions } = this.gameData;
        
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
            // Unrevealed, non-transparent cells
            this.ctx.fillStyle = 'rgba(220, 220, 220, 0.7)'; // Default placeholder for non-revealed
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
        
        // Highlight selected number
        if (this.interaction.highlightedNumber !== null && this.interaction.highlightedNumber === number && !revealed) {
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            this.ctx.fillRect(x, y, width, height);
        }
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
     * 检查是否可以点击填色（只有网格模式下才能点击）
     * @returns {boolean} 是否可以点击
     */
    canClick() {
        return this.isGridMode(); // 只有网格模式下才能点击填色
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 鼠标滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;
            
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom(factor, { x: centerX, y: centerY });
        });

        // 鼠标拖拽平移
        this.canvas.addEventListener('mousedown', (e) => {
            this.interaction.isDragging = true;
            this.interaction.lastMousePos = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (this.interaction.isDragging) {
                const deltaX = e.clientX - this.interaction.lastMousePos.x;
                const deltaY = e.clientY - this.interaction.lastMousePos.y;
                
                this.pan(deltaX, deltaY);
                
                this.interaction.lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });

        document.addEventListener('mouseup', () => {
            this.interaction.isDragging = false;
            this.canvas.style.cursor = 'crosshair';
        });

        // 点击填色
        this.canvas.addEventListener('click', (e) => {
            if (this.interaction.isDragging) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            const worldPos = this.screenToWorld(screenX, screenY);
            const cell = this.getCellAt(worldPos.x, worldPos.y);
            
            if (cell && this.canClick()) {
                // 触发填色事件
                const event = new CustomEvent('cellClick', { detail: cell });
                this.canvas.dispatchEvent(event);
            }
        });

        // 鼠标悬停
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.interaction.isDragging) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            
            const worldPos = this.screenToWorld(screenX, screenY);
            const cell = this.getCellAt(worldPos.x, worldPos.y);
            
            // 根据模式设置鼠标指针和提示
            if (this.isGridMode()) {
                // 网格模式：可以点击填色
                if (cell && !cell.revealed) {
                    this.canvas.style.cursor = 'pointer';
                    this.canvas.title = `点击填充颜色 - 数字 ${cell.number}`;
                } else if (cell && cell.revealed) {
                    this.canvas.style.cursor = 'default';
                    this.canvas.title = `已填充 - 数字 ${cell.number}`;
                } else {
                    this.canvas.style.cursor = 'crosshair';
                    this.canvas.title = '网格模式 - 可以点击填色';
                }
            } else {
                // 像素模式：只能查看，不能点击
                this.canvas.style.cursor = 'crosshair';
                if (cell && !cell.revealed) {
                    this.canvas.title = `像素模式 - 数字 ${cell.number} (放大到网格模式可填色)`;
                } else if (cell && cell.revealed) {
                    this.canvas.title = `像素模式 - 已填充数字 ${cell.number}`;
                } else {
                    this.canvas.title = '像素模式 - 放大到网格模式可填色';
                }
            }
        });
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

        console.log(`[CanvasRenderer] Export completed. Canvas size: ${exportCanvas.width}x${exportCanvas.height}`);
        return exportCanvas.toDataURL('image/png');
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
            // For unrevealed cells during export: current decision is to make them transparent.
            // If they needed a placeholder color, it would be drawn here.
            // For now, unrevealed non-transparent cells in an export will be transparent.
            // ctx.clearRect(x, y, width, height); // Or simply do nothing if canvas is already clear.
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
        this.gameData = null;
        this.interaction.highlightedNumber = null;
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