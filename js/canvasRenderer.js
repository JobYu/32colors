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
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // 设置默认500%缩放
        const defaultScale = 5; // 500%
        
        // 计算适合画布的最大缩放比例
        const maxScaleX = (canvasRect.width - 40) / dimensions.width;
        const maxScaleY = (canvasRect.height - 40) / dimensions.height;
        const maxFitScale = Math.min(maxScaleX, maxScaleY);
        
        // 选择合适的缩放级别：默认500%，但不超过能完全显示的最大缩放
        let scale = Math.min(defaultScale, maxFitScale);
        scale = Math.max(1, scale); // 最小100%
        
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
        if (!cell || !cell.color) {
            return;
        }
        
        const { x, y, width, height, color, number, revealed } = cell;
        
        // 确保颜色数据完整
        if (typeof color.r === 'undefined' || typeof color.g === 'undefined' || typeof color.b === 'undefined') {
            console.warn('无效的颜色数据:', color, 'in cell:', cell);
            return;
        }
        
        // 设置像素不抗锯齿，确保清晰的像素边缘
        this.ctx.imageSmoothingEnabled = false;
        
        // 根据缩放级别决定渲染模式
        const isHighZoom = this.transform.scale >= this.settings.gridModeThreshold; // 使用设置中的阈值
        
        if (!isHighZoom) {
            // 低缩放：正常显示像素颜色
            if (revealed) {
                // 已填充：显示原始颜色
                this.ctx.fillStyle = Utils.rgbToHex(color.r, color.g, color.b);
            } else {
                // 未填充：显示带有颜色提示的灰度
                const gray = Utils.getGrayscale(color.r, color.g, color.b);
                const enhancedGray = Math.max(80, Math.min(180, gray));
                this.ctx.fillStyle = `rgb(${enhancedGray}, ${enhancedGray}, ${enhancedGray})`;
            }
            this.ctx.fillRect(x, y, width, height);
        } else {
            // 高缩放：只显示已填充的像素，未填充保持透明/白色
            if (revealed) {
                this.ctx.fillStyle = Utils.rgbToHex(color.r, color.g, color.b);
                this.ctx.fillRect(x, y, width, height);
            }
            // 未填充的像素不绘制背景，保持白色背景
        }
        
        // 高亮显示
        if (this.interaction.highlightedNumber === number && !revealed) {
            this.ctx.fillStyle = 'rgba(33, 150, 243, 0.4)';
            this.ctx.fillRect(x, y, width, height);
        }
        
        // 绘制网格线（在高缩放时必须显示）
        if (this.settings.showGrid && (isHighZoom || (this.transform.scale >= 8 && this.transform.scale <= 100))) {
            this.ctx.strokeStyle = isHighZoom ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.2)';
            this.ctx.lineWidth = isHighZoom ? 2 / this.transform.scale : 1 / this.transform.scale;
            this.ctx.strokeRect(x, y, width, height);
        }
        
        // 绘制数字（在高缩放时简化显示）
        if (this.settings.showNumbers && !revealed && this.shouldShowNumbers()) {
            if (isHighZoom) {
                this.renderSimplePixelNumber(cell);
            } else {
                this.renderPixelNumber(cell);
            }
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
        
        // 添加文字描边以提高可读性，描边宽度也需要根据缩放调整
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = Math.max(0.5, fontSize / 8);
        
        // 绘制数字
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        this.ctx.strokeText(number.toString(), centerX, centerY);
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
        this.transform = { ...transform };
        this.render();
    }

    /**
     * 导出当前画布为图片
     * @param {number} scale - 导出缩放倍数（默认1为当前尺寸，10为1000%放大）
     * @returns {string} 图片的Data URL
     */
    exportImage(scale = 1) {
        if (!this.gameData) {
            return this.canvas.toDataURL();
        }

        const { dimensions } = this.gameData;
        
        // 创建高分辨率画布
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');
        
        // 设置导出画布尺寸
        exportCanvas.width = dimensions.width * scale;
        exportCanvas.height = dimensions.height * scale;
        
        // 关闭抗锯齿以保持像素画效果
        exportCtx.imageSmoothingEnabled = false;
        
        // 绘制白色背景
        exportCtx.fillStyle = '#ffffff';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        // 缩放画布以实现高分辨率渲染
        exportCtx.scale(scale, scale);
        
        // 渲染完整的游戏网格（不受视窗限制）
        this.renderFullGameGrid(exportCtx);
        
        return exportCanvas.toDataURL('image/png');
    }

    /**
     * 渲染完整的游戏网格（用于导出）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     */
    renderFullGameGrid(ctx) {
        const { gameGrid, dimensions } = this.gameData;
        
        // 渲染所有像素单元格（不受视窗限制）
        for (let row = 0; row < gameGrid.length; row++) {
            for (let col = 0; col < gameGrid[row].length; col++) {
                const cell = gameGrid[row][col];
                if (cell) {
                    this.renderPixelCellForExport(ctx, cell);
                }
            }
        }
    }

    /**
     * 为导出渲染像素单元格
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {object} cell - 单元格数据
     */
    renderPixelCellForExport(ctx, cell) {
        const x = cell.col;
        const y = cell.row;
        
        // 绘制单元格背景（已填充显示颜色，未填充显示淡灰色）
        if (cell.revealed) {
            // 已填充：显示实际颜色
            ctx.fillStyle = Utils.rgbToHex(cell.color.r, cell.color.g, cell.color.b);
        } else {
            // 未填充：显示淡灰色
            ctx.fillStyle = '#f0f0f0';
        }
        
        ctx.fillRect(x, y, 1, 1);
        
        // 绘制细网格线（在高分辨率下清晰可见）
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 0.02; // 细线，适合高分辨率
        ctx.strokeRect(x, y, 1, 1);
        
        // 在未填充的单元格中绘制数字（如果足够大）
        if (!cell.revealed) {
            ctx.fillStyle = '#666666';
            ctx.font = '0.5px Arial'; // 相对于单元格的字体大小
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cell.number.toString(), x + 0.5, y + 0.5);
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
}

// 创建全局实例（将在main.js中初始化）
let canvasRenderer = null; 