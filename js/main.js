/**
 * 主应用逻辑
 * 整合所有模块并处理用户交互
 */

class ColorByNumbersApp {
    constructor() {
        this.currentImage = null;
        this.currentImageManifestPath = null; // Track built-in image path
        this.currentUploadedImageName = null; // Track uploaded image name
        this.isProcessing = false;
        this.FILE_INPUT_HINT_TEXT = '选择像素图片 (PNG/JPG格式，最大300×300像素，128色以内)';
        
        // 油漆桶工具状态
        this.bucketTool = {
            isActive: false,
            mode: 'flood' // 'flood' for flood fill
        };
        
        this.initializeElements();
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupGameEngine();
        this.initializeGallery();
        
        // 默认显示首页
        this.showHomePage();
    }

    /**
     * 初始化DOM元素引用
     */
    initializeElements() {
        // 输入元素
        this.elements = {
            imageLoader: document.getElementById('imageLoader'),
            fileName: document.getElementById('fileName'),
            
            // 画布和控制
            gameCanvas: document.getElementById('gameCanvas'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            zoomInBtn: document.getElementById('zoomInBtn'),
            zoomOutBtn: document.getElementById('zoomOutBtn'),
            
            // 进度和信息
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            legendContainer: document.getElementById('legendContainer'),
            totalAreas: document.getElementById('totalAreas'),
            completedAreas: document.getElementById('completedAreas'),
            remainingAreas: document.getElementById('remainingAreas'),
            gameTime: document.getElementById('gameTime'),
            
            // 游戏控制
            resetGameBtn: document.getElementById('resetGameBtn'),
            autoFillBtn: document.getElementById('autoFillBtn'),
            saveProgressBtn: document.getElementById('saveProgressBtn'),

            // 模态框
            successModal: document.getElementById('successModal'),
            shareBtn: document.getElementById('shareBtn'),
            newGameBtn: document.getElementById('newGameBtn'),
            closeModalBtn: document.getElementById('closeModalBtn'),

            // Gallery Elements
            builtInGalleryContainer: document.getElementById('builtInGalleryContainer'),
            folderCategoriesContainer: document.getElementById('folderCategoriesContainer'),
            userGalleryContainer: document.getElementById('userGalleryContainer'),
            filteredImagesContainer: document.getElementById('filteredImagesContainer'),
            sizeFilter: document.getElementById('sizeFilter'),

            // Page containers
            homePage: document.getElementById('homePage'),
            gamePage: document.getElementById('gamePage'),
            myGalleryPage: document.getElementById('myGalleryPage'),

            // Navigation elements
            homeNavBtn: document.getElementById('homeNavBtn'),
            galleryNavBtn: document.getElementById('galleryNavBtn'),
        };
    }

    /**
     * 初始化Canvas渲染器
     */
    initializeCanvas() {
        canvasRenderer = new CanvasRenderer(this.elements.gameCanvas);
        this.resizeCanvas();
        
        // 监听窗口大小变化
        window.addEventListener('resize', Utils.debounce(() => {
            this.resizeCanvas();
        }, 250));
    }

    /**
     * 调整画布大小
     */
    resizeCanvas() {
        const container = this.elements.gameCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        const width = Math.floor(rect.width - 4); // 减去边框
        // 为新布局优化高度计算，确保画布能充分利用可用空间
        const height = Math.floor(Math.max(300, rect.height - 4));
        
        canvasRenderer.setCanvasSize(width, height);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 文件上传
        this.elements.imageLoader.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // 画布控制
        this.elements.zoomInBtn.addEventListener('click', () => {
            canvasRenderer.zoom(); // 使用默认的1.4倍放大
        });

        this.elements.zoomOutBtn.addEventListener('click', () => {
            canvasRenderer.zoom(1 / canvasRenderer.settings.zoomFactor); // 缩小（1/1.4）
        });

        // 游戏控制
        this.elements.resetGameBtn.addEventListener('click', () => {
            this.resetGame();
        });

        this.elements.autoFillBtn.addEventListener('click', () => {
            this.toggleBucketTool();
        });

        this.elements.saveProgressBtn.addEventListener('click', () => {
            gameEngine.saveProgress();
        });

        // 画布点击事件
        this.elements.gameCanvas.addEventListener('cellClick', (e) => {
            this.handleCellClick(e.detail);
        });

        // 模态框事件
        this.elements.shareBtn.addEventListener('click', () => {
            this.shareGame();
        });

        this.elements.newGameBtn.addEventListener('click', () => {
            this.startNewGame();
        });

        this.elements.closeModalBtn.addEventListener('click', () => {
            this.hideSuccessModal();
        });

        // 点击模态框背景关闭
        this.elements.successModal.addEventListener('click', (e) => {
            if (e.target === this.elements.successModal) {
                this.hideSuccessModal();
            }
        });



        // Gallery filter event listener
        if (this.elements.sizeFilter) {
            this.elements.sizeFilter.addEventListener('change', () => {
                this.applyImageFilter();
            });
        }

        // Navigation event listeners
        if (this.elements.homeNavBtn) {
            this.elements.homeNavBtn.addEventListener('click', () => {
                this.showHomePage();
            });
        }

        if (this.elements.galleryNavBtn) {
            this.elements.galleryNavBtn.addEventListener('click', () => {
                this.showMyGalleryPage();
            });
        }
    }

    /**
     * 设置游戏引擎回调
     */
    setupGameEngine() {
        gameEngine.on('progress', (stats) => {
            this.updateGameInfo(stats);
        });

        gameEngine.on('complete', async (result) => {
            this.showSuccessModal(result);
            await this.saveCompletedArtwork(result);
            // Don't automatically render user gallery here since it's now on a separate page
        });

        gameEngine.on('cellFilled', (cell) => {
            this.updateLegend();
        });

        gameEngine.on('timeUpdate', (seconds) => {
            this.elements.gameTime.textContent = Utils.formatTime(seconds);
        });

        this.hideLoading();
        // Remove automatic user gallery rendering since it's now on a separate page
    }

    /**
     * 处理文件上传
     * @param {File} file - 上传的文件
     */
    async handleFileUpload(file) {
        if (!file) {
            this.currentUploadedImageName = null; // Ensure cleared if no file
            this.elements.fileName.textContent = this.FILE_INPUT_HINT_TEXT;
            return;
        }

        this.currentImageManifestPath = null; // Clear manifest path for uploaded files
        this.currentUploadedImageName = null; // Reset before attempting to set

        // 基本文件验证
        const validation = imageProcessor.validateImageFile(file);
        if (!validation.valid) {
            Utils.showNotification(validation.errors.join(', '), 'error');
            this.elements.fileName.textContent = this.FILE_INPUT_HINT_TEXT;
            this.resetFileInput();
            return;
        }

        // 检测GIF动图
        if (file.type === 'image/gif') {
            Utils.showNotification('暂不支持GIF动态图片，请选择PNG或JPG格式的像素图片', 'error');
            this.elements.fileName.textContent = this.FILE_INPUT_HINT_TEXT;
            this.resetFileInput();
            return;
        }

        this.elements.fileName.textContent = file.name;

        try {
            const loadedImage = await imageProcessor.loadImageFromFile(file);
            
            // 检查图片尺寸
            const imageInfo = imageProcessor.getImageInfo(loadedImage);
            if (imageInfo.width > 300 || imageInfo.height > 300) {
                Utils.showNotification(`图片尺寸过大 (${imageInfo.width}×${imageInfo.height})，请选择300×300像素以内的图片`, 'error');
                this.elements.fileName.textContent = this.FILE_INPUT_HINT_TEXT;
                this.resetFileInput();
                return;
            }

            this.currentUploadedImageName = file.name; // Store the uploaded file name
            this.currentImage = loadedImage; // Keep for potential other uses, but pass directly
            
            // 立即保存上传的图片到我的画廊
            await this.saveUploadedImageToGallery(loadedImage, file.name);
            
            Utils.showNotification('图片上传成功！正在生成游戏...', 'success');
            
            // 自动生成游戏
            await this.generateGame(loadedImage, file.name);
        } catch (error) {
            Utils.showNotification(error.message, 'error');
            // Reset to hint text on error
            this.elements.fileName.textContent = this.FILE_INPUT_HINT_TEXT;
            this.resetFileInput();
        }
    }

    /**
     * 重置文件输入框
     */
    resetFileInput() {
        if (this.elements.imageLoader) {
            this.elements.imageLoader.value = '';
        }
        this.currentUploadedImageName = null;
        this.currentImage = null;
    }

    /**
     * 保存上传的图片到我的画廊
     * @param {HTMLImageElement} imageElement - 加载的图片元素
     * @param {string} fileName - 文件名
     */
    async saveUploadedImageToGallery(imageElement, fileName) {
        try {
            // 获取图片尺寸信息
            const imageInfo = imageProcessor.getImageInfo(imageElement);
            
            // 生成缩略图（使用10倍缩放保持像素风格）
            const scaleFactor = Math.min(10, 150 / Math.max(imageInfo.width, imageInfo.height));
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = imageInfo.width * scaleFactor;
            tempCanvas.height = imageInfo.height * scaleFactor;
            tempCtx.imageSmoothingEnabled = false;
            tempCtx.drawImage(imageElement, 0, 0, tempCanvas.width, tempCanvas.height);
            
            const thumbnailDataUrl = tempCanvas.toDataURL();
            
            // 保存原图数据
            const originalImageDataUrl = imageElement.src;
            
            // 生成唯一ID
            const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const uploadedImageEntry = {
                id: uploadId,
                originalImageIdentifier: originalImageDataUrl, // 使用dataURL作为标识符
                name: fileName,
                dimensions: {
                    width: imageInfo.width,
                    height: imageInfo.height
                },
                thumbnailDataUrl: thumbnailDataUrl,
                originalImageDataUrl: originalImageDataUrl, // 保存原图
                uploadTimestamp: Date.now(),
                isCompleted: false, // 初始状态为未完成
                type: 'uploaded' // 标记为上传类型
            };

            // 获取现有的用户画廊数据
            let userGallery = Utils.storage.get('userGallery', []);
            
            // 检查是否已存在相同文件（基于文件名和尺寸）
            const existingIndex = userGallery.findIndex(item => 
                item.name === fileName && 
                item.dimensions.width === imageInfo.width && 
                item.dimensions.height === imageInfo.height &&
                item.type === 'uploaded'
            );
            
            if (existingIndex > -1) {
                // 替换现有条目
                userGallery[existingIndex] = uploadedImageEntry;
                Utils.showNotification(`图片 "${fileName}" 已更新到我的画廊`, 'info');
            } else {
                // 添加新条目到开头
                userGallery.unshift(uploadedImageEntry);
                Utils.showNotification(`图片 "${fileName}" 已保存到我的画廊`, 'success');
            }
            
            // 保存到localStorage
            Utils.storage.set('userGallery', userGallery);
            
        } catch (error) {
            console.error('Error saving uploaded image to gallery:', error);
            Utils.showNotification('保存图片到画廊失败', 'warning');
        }
    }

    /**
     * 生成游戏
     * @param {HTMLImageElement} imageToProcess - The image element to process.
     * @param {string} imageIdentifier - The name or path of the image for context.
     */
    async generateGame(imageToProcess, imageIdentifier) {
        // Debug log to check the source of the current image being processed
        console.log('[Debug] generateGame called. Processing image src:', imageToProcess ? imageToProcess.src.substring(0, 100) + '...' : 'null', 'Identifier:', imageIdentifier, 'isProcessing:', this.isProcessing);

        this._resetPreviousGameDisplay(); // Clear previous game state and UI

        if (!imageToProcess || this.isProcessing) {
            if (!imageToProcess) console.warn('generateGame aborted: No imageToProcess provided.');
            if (this.isProcessing) console.warn('generateGame aborted: Still processing a previous image.');
            return;
        }

        // Verify the image is loaded and has valid dimensions
        if (!imageToProcess.complete || !imageToProcess.naturalWidth || !imageToProcess.naturalHeight) {
            console.error('generateGame aborted: Image not properly loaded or has invalid dimensions');
            Utils.showNotification('图片加载失败，请重新选择', 'error');
            return;
        }

        this.isProcessing = true;
        this.showLoading('正在处理图片，生成像素级填色游戏...');

        try {
            // 使用默认参数：16色，像素级精确处理
            const options = {
                colorCount: 16,        // 固定16色
                gridSize: 'pixel',     // 固定像素级精确
                algorithm: 'kmeans'
            };

            console.log('[Debug] About to process image. Image dimensions:', imageToProcess.naturalWidth, 'x', imageToProcess.naturalHeight);
            const gameData = await imageProcessor.processImage(imageToProcess, options);
            console.log('[Debug] Image processing completed. Game grid dimensions:', gameData?.dimensions?.width, 'x', gameData?.dimensions?.height);
            
            // 显示图片信息
            const imageInfo = imageProcessor.getImageInfo(imageToProcess);
            const totalPixels = gameData.dimensions.width * gameData.dimensions.height;
            
            // 初始化游戏引擎
            console.log('[Debug] Initializing game engine with new game data');
            gameEngine.initGame(gameData);
            
            // 设置渲染器数据 - 使用gameEngine的数据确保同步
            console.log('[Debug] Setting renderer data');
            canvasRenderer.setGameData(gameEngine.getGameData());
            
            // 生成颜色图例
            console.log('[Debug] Generating legend with', gameData.palette.length, 'colors');
            this.generateLegend(gameData.palette);
            
            // 开始游戏
            console.log('[Debug] Starting game');
            gameEngine.startGame();
            
            Utils.showNotification(
                `像素级填色游戏生成成功！图片尺寸: ${gameData.dimensions.width}×${gameData.dimensions.height} (${totalPixels}个像素)`,
                'success',
                4000
            );
            this.showGamePage(); // Switch to game view

        } catch (error) {
            console.error('[Debug] Error in generateGame:', error);
            if (error.message === 'Image contains too many colors (max 128 allowed).') {
                Utils.showNotification('图片颜色种类过多 (最多允许128种)，请选择颜色较少的图片。', 'warning', 5000);
            } else {
                Utils.showNotification(`游戏生成失败: ${error.message}`, 'error');
            }
        } finally {
            this.isProcessing = false;
            this.hideLoading();
            console.log('[Debug] generateGame completed, isProcessing set to false');
        }
    }

    /**
     * 生成颜色图例
     * @param {Array} palette - 调色板
     */
    generateLegend(palette) {
        this.elements.legendContainer.innerHTML = '';
        
        palette.forEach(paletteItem => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.dataset.number = paletteItem.number;
            
            const colorSample = document.createElement('div');
            colorSample.className = 'color-sample';
            colorSample.style.backgroundColor = Utils.rgbToHex(
                paletteItem.color.r,
                paletteItem.color.g,
                paletteItem.color.b
            );
            
            const colorNumber = document.createElement('span');
            colorNumber.className = 'color-number';
            colorNumber.textContent = paletteItem.number;
            
            const colorCount = document.createElement('span');
            colorCount.className = 'color-count';
            colorCount.textContent = `${paletteItem.count}`;
            
            legendItem.appendChild(colorSample);
            legendItem.appendChild(colorNumber);
            legendItem.appendChild(colorCount);
            
            // 点击图例项高亮对应颜色
            legendItem.addEventListener('click', () => {
                this.toggleLegendHighlight(legendItem, paletteItem.number);
            });
            
            this.elements.legendContainer.appendChild(legendItem);
        });
    }

    /**
     * 切换图例高亮
     * @param {HTMLElement} legendItem - 图例项元素
     * @param {number} number - 颜色数字
     */
    toggleLegendHighlight(legendItem, number) {
        const isHighlighted = legendItem.classList.contains('highlighted');
        
        // 清除所有高亮
        this.elements.legendContainer.querySelectorAll('.legend-item').forEach(item => {
            item.classList.remove('highlighted');
        });
        
        if (!isHighlighted) {
            legendItem.classList.add('highlighted');
            canvasRenderer.highlightNumber(number);
        } else {
            canvasRenderer.clearHighlight();
        }
    }

    /**
     * 更新图例显示
     */
    updateLegend() {
        const colorStats = gameEngine.getColorStats();
        
        colorStats.forEach(stat => {
            const legendItem = this.elements.legendContainer.querySelector(
                `[data-number="${stat.number}"]`
            );
            
            if (legendItem) {
                const colorCount = legendItem.querySelector('.color-count');
                const remaining = stat.totalCells - stat.completedCells;
                colorCount.textContent = remaining > 0 ? remaining.toString() : '✓';
                
                if (remaining === 0) {
                    legendItem.style.opacity = '0.6';
                }
            }
        });
    }

    /**
     * 处理单元格点击
     * @param {object} cell - 被点击的单元格
     */
    handleCellClick(cell) {
        // 检查是否使用油漆桶工具
        if (this.bucketTool.isActive) {
            this.bucketFill(cell);
            return;
        }
        
        // 普通单元格填充
        const result = gameEngine.fillCell(cell);
        
        if (result) {
            // gameEngine.fillCell 已经设置了 cell.revealed = true
            // 只需要重新渲染画布即可
            canvasRenderer.render();
        } else {
            console.log('Failed to fill cell - possible reasons: already revealed, game not playing, or game paused');
        }
    }

    /**
     * 更新游戏信息
     * @param {object} stats - 游戏统计信息
     */
    updateGameInfo(stats) {
        this.elements.totalAreas.textContent = stats.totalCells;
        this.elements.completedAreas.textContent = stats.completedCells;
        this.elements.remainingAreas.textContent = stats.remainingCells;
        
        this.elements.progressFill.style.width = `${stats.completionRate}%`;
        this.elements.progressText.textContent = `${stats.completionRate}%`;
    }

    /**
     * 重置游戏
     */
    resetGame() {
        if (confirm('确定要重新开始游戏吗？当前进度将会丢失。')) {
            gameEngine.restartGame();
            canvasRenderer.render();
            this.updateLegend();
            
            // 确保更新游戏信息
            const stats = gameEngine.getGameStats();
            this.updateGameInfo(stats);
        }
    }

    /**
     * 显示自动填充选项
     */
    showAutoFillOptions() {
        const colorStats = gameEngine.getColorStats();
        const uncompletedColors = colorStats.filter(stat => stat.completionRate < 100);
        
        if (uncompletedColors.length === 0) {
            Utils.showNotification('所有颜色都已完成！', 'info');
            return;
        }
        
        // 创建选择界面，直接显示颜色编号
        const options = uncompletedColors.map(stat => 
            `颜色编号 ${stat.number} (剩余 ${stat.totalCells - stat.completedCells} 个)`
        );
        
        // 获取所有可用的颜色编号
        const availableNumbers = uncompletedColors.map(stat => stat.number);
        
        const choice = prompt(`选择要自动填充的颜色编号:\n${options.join('\n')}\n\n请输入颜色编号 (${availableNumbers.join('、')}):`);
        
        if (choice) {
            const colorNumber = parseInt(choice);
            const selectedColor = uncompletedColors.find(stat => stat.number === colorNumber);
            
            if (selectedColor) {
                gameEngine.autoFillNumber(selectedColor.number);
                canvasRenderer.render();
                this.updateLegend();
                Utils.showNotification(`已自动填充颜色编号 ${selectedColor.number}`, 'success');
            } else {
                Utils.showNotification(`请输入有效的颜色编号 (${availableNumbers.join('、')})`, 'warning');
            }
        }
    }

    /**
     * 显示成功模态框
     * @param {object} result - 完成结果
     */
    showSuccessModal(result) {
        this.elements.successModal.classList.add('show');
        
        // 更新模态框内容
        const modalContent = this.elements.successModal.querySelector('.modal-content p');
        modalContent.textContent = `用时 ${Utils.formatTime(result.playTime)}，完成了 ${result.totalCells} 个区域的填色！`;
    }

    /**
     * 隐藏成功模态框
     */
    hideSuccessModal() {
        this.elements.successModal.classList.remove('show');
    }

    /**
     * 分享游戏
     */
    shareGame() {
        try {
            // 创建分享选项界面
            this.showShareOptions();
        } catch (error) {
            Utils.showNotification('分享功能出错，请重试', 'error');
        }
    }

    /**
     * 显示分享选项
     */
    showShareOptions(artworkEntry = null) {
        // 创建分享选项模态框
        const shareModal = document.createElement('div');
        shareModal.className = 'modal show';
        shareModal.style.zIndex = '10000';
        
        shareModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>分享作品</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="share-options">
                        <div class="share-section">
                            <h4>下载选项</h4>
                            <button class="share-btn download-btn" data-action="download-normal">
                                📥 下载原尺寸
                            </button>
                            <button class="share-btn download-btn" data-action="download-hd">
                                📥 下载高清版
                            </button>
                            <button class="share-btn download-btn" data-action="download-hd-grid">
                                📥 下载高清版（带网格）
                            </button>
                        </div>
                        
                        <div class="share-section">
                            <h4>社交媒体分享</h4>
                            <button class="share-btn social-btn" data-action="share-twitter">
                                🐦 分享到 Twitter
                            </button>
                            <button class="share-btn social-btn" data-action="share-facebook">
                                📘 分享到 Facebook
                            </button>
                            <button class="share-btn social-btn" data-action="share-weibo">
                                🔴 分享到微博
                            </button>
                            <button class="share-btn social-btn" data-action="copy-link">
                                🔗 复制分享链接
                            </button>
                        </div>
                        
                        <div class="share-section">
                            <h4>其他选项</h4>
                            <button class="share-btn other-btn" data-action="print">
                                🖨️ 打印作品
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加分享选项样式
        if (!document.getElementById('share-modal-styles')) {
            const styles = document.createElement('style');
            styles.id = 'share-modal-styles';
            styles.textContent = `
                .share-options { padding: 10px 0; }
                .share-section { margin-bottom: 20px; }
                .share-section h4 { 
                    margin: 0 0 10px 0; 
                    color: #333; 
                    font-size: 14px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                }
                .share-btn {
                    display: block;
                    width: 100%;
                    padding: 12px 16px;
                    margin: 8px 0;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    background: #fff;
                    color: #333;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }
                .share-btn:hover {
                    border-color: #007bff;
                    background: #f8f9ff;
                    transform: translateY(-1px);
                }
                .download-btn:hover { border-color: #28a745; background: #f8fff8; }
                .social-btn:hover { border-color: #17a2b8; background: #f8fffe; }
                .other-btn:hover { border-color: #ffc107; background: #fffef8; }
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .close-btn:hover { color: #333; }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                .modal-header h3 { margin: 0; color: #333; }
            `;
            document.head.appendChild(styles);
        }
        
        // 添加事件监听器
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) {
                shareModal.remove();
            }
            
            const action = e.target.dataset.action;
            if (action) {
                this.handleShareAction(action, artworkEntry);
                shareModal.remove();
            }
        });
        
        document.body.appendChild(shareModal);
    }

    /**
     * 处理分享操作
     * @param {string} action - 分享操作类型
     * @param {object} [artworkEntry=null] - Optional. The artwork entry for context.
     */
    async handleShareAction(action, artworkEntry = null) {
        try {
            let imageDataToUse;
            let imageName = 'color-by-numbers';

            if (artworkEntry && artworkEntry.completedImageDataUrl) {
                imageDataToUse = artworkEntry.completedImageDataUrl;
                imageName = artworkEntry.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || imageName;
            } else if (canvasRenderer && gameEngine && gameEngine.getGameData()) {
                // Fallback to current game canvas if no specific artwork entry is provided (e.g. sharing during game)
                // This part is for the original share button in the success modal if not sharing from user gallery
            } else {
                Utils.showNotification('没有可分享的图片数据', 'warning');
                return;
            }

            switch (action) {
                case 'download-normal':
                    // If sharing from user gallery, completedImageDataUrl is already 1x
                    // If from current game, exportImage(1) gets 1x.
                    imageDataToUse = artworkEntry ? artworkEntry.completedImageDataUrl : canvasRenderer.exportImage(1);
                    await this.downloadImage(imageDataToUse, `${imageName}-original.png`, '原尺寸');
                    break;
                    
                case 'download-hd':
                    let hdScaleFactor = 8; // Default for > 64x64
                    const imageWidth = artworkEntry ? artworkEntry.dimensions.width : (gameEngine.gameData ? gameEngine.gameData.dimensions.width : 0);

                    if (imageWidth > 0) {
                        hdScaleFactor = this.getHdScaleFactor(imageWidth);
                    }
                    
                    if (artworkEntry) {
                        // For saved artworks, we upscale the stored 1x `completedImageDataUrl`
                        const imageHeight = artworkEntry.dimensions.height; // Get height as well
                        // hdScaleFactor is already calculated above based on artworkEntry.dimensions.width

                        const targetWidth = imageWidth * hdScaleFactor;
                        const targetHeight = imageHeight * hdScaleFactor;
                        
                        try {
                            imageDataToUse = await Utils.upscaleImageDataUrl(artworkEntry.completedImageDataUrl, targetWidth, targetHeight);
                            await this.downloadImage(imageDataToUse, `${imageName}-hd-upscaled-${hdScaleFactor}x.png`, `高清放大版 (${hdScaleFactor}x)`);
                        } catch (upscaleError) {
                            console.error('Error upscaling saved artwork:', upscaleError);
                            Utils.showNotification('放大已保存作品失败', 'error');
                            // Fallback to downloading the 1x version if upscaling fails
                            imageDataToUse = artworkEntry.completedImageDataUrl;
                            await this.downloadImage(imageDataToUse, `${imageName}-completed-1x.png`, '已保存作品 (1x)');
                        }
                    } else if (canvasRenderer && gameEngine && gameEngine.getGameData()) {
                        // For current game, generate a fresh HD export with dynamic scale
                        imageDataToUse = canvasRenderer.exportImage(hdScaleFactor);
                        await this.downloadImage(imageDataToUse, `${imageName}-hd-${hdScaleFactor}x.png`, `高清版 (${hdScaleFactor}x)`);
                    } else {
                        Utils.showNotification('无法生成高清版图片', 'warning');
                        return;
                    }
                    break;
                    
                case 'download-hd-grid':
                    let hdGridScaleFactor = 8; // Default for > 64x64
                    const imageGridWidth = artworkEntry ? artworkEntry.dimensions.width : (gameEngine.gameData ? gameEngine.gameData.dimensions.width : 0);

                    if (imageGridWidth > 0) {
                        hdGridScaleFactor = this.getHdScaleFactor(imageGridWidth);
                    }
                    
                    // Check if current game is loaded and can generate grid version
                    if (canvasRenderer && gameEngine && gameEngine.getGameData()) {
                        // For current game, generate a fresh HD export with dynamic scale and grid
                        imageDataToUse = canvasRenderer.exportImage(hdGridScaleFactor, true); // showGrid = true
                        await this.downloadImage(imageDataToUse, `${imageName}-hd-grid-${hdGridScaleFactor}x.png`, `高清带网格版 (${hdGridScaleFactor}x)`);
                    } else if (artworkEntry) {
                        // For saved artworks, temporarily recreate the game to generate grid version
                        Utils.showNotification('正在生成带网格的高清版本...', 'info');
                        
                        try {
                            // Store current game state if exists
                            const currentGameData = gameEngine ? gameEngine.getGameData() : null;
                            
                            // Load the image and recreate game data temporarily
                            const img = new Image();
                            img.onload = async () => {
                                try {
                                    // Generate temporary game data from the stored image
                                    const tempGameData = await imageProcessor.processImage(img, artworkEntry.dimensions.width);
                                    
                                    // Temporarily set game data to renderer
                                    if (canvasRenderer) {
                                        canvasRenderer.setGameData(tempGameData);
                                        
                                        // Mark all cells as revealed to show completed artwork
                                        tempGameData.gameGrid.forEach(row => {
                                            row.forEach(cell => {
                                                if (cell) cell.revealed = true;
                                            });
                                        });
                                        
                                        // Generate grid version
                                        const gridImageData = canvasRenderer.exportImage(hdGridScaleFactor, true);
                                        
                                        // Restore original game data if it existed
                                        if (currentGameData) {
                                            canvasRenderer.setGameData(currentGameData);
                                        } else {
                                            canvasRenderer.clearAndReset();
                                        }
                                        
                                        // Download the generated image
                                        await this.downloadImage(gridImageData, `${imageName}-hd-grid-${hdGridScaleFactor}x.png`, `高清带网格版 (${hdGridScaleFactor}x)`);
                                        
                                    } else {
                                        Utils.showNotification('渲染器未初始化', 'error');
                                    }
                                } catch (error) {
                                    console.error('Error generating grid version:', error);
                                    Utils.showNotification('生成带网格版本失败，请重试', 'error');
                                }
                            };
                            
                            img.onerror = () => {
                                Utils.showNotification('图片加载失败', 'error');
                            };
                            
                            // Load from the original image or completed image
                            img.src = artworkEntry.originalImageDataUrl || artworkEntry.completedImageDataUrl;
                            
                        } catch (error) {
                            console.error('Error processing grid download:', error);
                            Utils.showNotification('生成带网格版本失败，请重试', 'error');
                        }
                    } else {
                        Utils.showNotification('无法生成高清带网格版图片', 'warning');
                        return;
                    }
                    break;
                    
                case 'share-twitter':
                    this.shareToTwitter();
                    break;
                    
                case 'share-facebook':
                    this.shareToFacebook();
                    break;
                    
                case 'share-weibo':
                    this.shareToWeibo();
                    break;
                    
                case 'copy-link':
                    this.copyShareLink();
                    break;
                    
                case 'print':
                    this.printImage(artworkEntry);
                    break;
                    
                default:
                    console.warn('Unknown share action:', action);
            }
        } catch (error) {
            console.error('Share action error:', error);
            Utils.showNotification('操作失败，请重试', 'error');
        }
    }

    /**
     * 下载图片
     * @param {string} imageData - Data URL of the image
     * @param {string} fileName - Desired file name
     * @param {string} sizeName - Size description for notification
     */
    async downloadImage(imageData, fileName, sizeName) {
        Utils.showNotification(`正在生成${sizeName}图片...`, 'info');
        
        try {
            // const imageData = canvasRenderer.exportImage(scale); // Old way
            // Utils.downloadFile(imageData, fileName); // Directly use provided imageData
            Utils.downloadFile(imageData, fileName);
            Utils.showNotification(`${sizeName}作品已下载！`, 'success');
        } catch (error) {
            Utils.showNotification(`${sizeName}下载失败，请重试`, 'error');
        }
    }

    /**
     * 分享到Twitter
     */
    shareToTwitter() {
        const text = encodeURIComponent('我完成了一幅像素级填色作品！🎨 #ColorByNumbers #PixelArt');
        const url = encodeURIComponent(window.location.href);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        window.open(twitterUrl, '_blank');
    }

    /**
     * 分享到Facebook
     */
    shareToFacebook() {
        const url = encodeURIComponent(window.location.href);
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        window.open(facebookUrl, '_blank');
    }

    /**
     * 分享到微博
     */
    shareToWeibo() {
        const text = encodeURIComponent('我完成了一幅像素级填色作品！🎨');
        const url = encodeURIComponent(window.location.href);
        const weiboUrl = `https://service.weibo.com/share/share.php?title=${text}&url=${url}`;
        window.open(weiboUrl, '_blank');
    }

    /**
     * 复制分享链接
     */
    async copyShareLink() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            Utils.showNotification('分享链接已复制到剪贴板！', 'success');
        } catch (error) {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = window.location.href;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Utils.showNotification('分享链接已复制到剪贴板！', 'success');
        }
    }

    /**
     * 打印图片
     * @param {object} [artworkEntry=null] - Optional. The artwork entry for context.
     */
    printImage(artworkEntry = null) {
        try {
            let imageDataToPrint;
            let artworkTitle = '像素填色作品';

            // Always try to use canvasRenderer to generate grid version if available
            if (canvasRenderer && gameEngine && gameEngine.getGameData()) {
                // Current game is loaded, use renderer with grid with higher scale for printing
                const gameData = gameEngine.getGameData();
                const printScale = Math.max(20, this.getHdScaleFactor(gameData.dimensions.width) * 1.5);
                imageDataToPrint = canvasRenderer.exportImage(printScale, true); // High resolution with grid for printing
                if (artworkEntry) {
                    artworkTitle = artworkEntry.name || artworkTitle;
                }
                this.executePrint(imageDataToPrint, artworkTitle);
            } else if (artworkEntry) {
                // For saved artworks, temporarily recreate the game to generate grid version
                Utils.showNotification('正在生成带网格的打印版本...', 'info');
                
                try {
                    // Store current game state if exists
                    const currentGameData = gameEngine ? gameEngine.getGameData() : null;
                    artworkTitle = artworkEntry.name || artworkTitle;
                    
                    // Load the image and recreate game data temporarily
                    const img = new Image();
                    img.onload = async () => {
                        try {
                            // Generate temporary game data from the stored image
                            const tempGameData = await imageProcessor.processImage(img, artworkEntry.dimensions.width);
                            
                            // Temporarily set game data to renderer
                            if (canvasRenderer) {
                                canvasRenderer.setGameData(tempGameData);
                                
                                // Mark all cells as revealed to show completed artwork
                                tempGameData.gameGrid.forEach(row => {
                                    row.forEach(cell => {
                                        if (cell) cell.revealed = true;
                                    });
                                });
                                
                                // Generate grid version for printing with higher scale for visibility
                                const printScale = Math.max(20, this.getHdScaleFactor(artworkEntry.dimensions.width) * 1.5);
                                const printImageData = canvasRenderer.exportImage(printScale, true);
                                
                                // Restore original game data if it existed
                                if (currentGameData) {
                                    canvasRenderer.setGameData(currentGameData);
                                } else {
                                    canvasRenderer.clearAndReset();
                                }
                                
                                // Execute print
                                this.executePrint(printImageData, artworkTitle);
                                
                            } else {
                                Utils.showNotification('渲染器未初始化', 'error');
                            }
                        } catch (error) {
                            console.error('Error generating print version:', error);
                            Utils.showNotification('生成打印版本失败，请重试', 'error');
                        }
                    };
                    
                    img.onerror = () => {
                        Utils.showNotification('图片加载失败', 'error');
                    };
                    
                    // Load from the original image or completed image
                    img.src = artworkEntry.originalImageDataUrl || artworkEntry.completedImageDataUrl;
                    
                } catch (error) {
                    console.error('Error processing print:', error);
                    Utils.showNotification('生成打印版本失败，请重试', 'error');
                }
            } else {
                Utils.showNotification('没有可打印的图片', 'warning');
                return;
            }
        } catch (error) {
            Utils.showNotification('打印功能失败，请重试', 'error');
        }
    }

    /**
     * 执行实际的打印操作
     * @param {string} imageDataToPrint - 图片数据URL
     * @param {string} artworkTitle - 作品标题
     */
    executePrint(imageDataToPrint, artworkTitle) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>${artworkTitle}</title>
                    <style>
                        @page { margin: 0; }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            text-align: center;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                        }
                        img { 
                            width: 100vw; 
                            height: 100vh; 
                            object-fit: contain;
                            max-width: none;
                            max-height: none;
                        }
                        h1 { 
                            font-family: Arial, sans-serif; 
                            color: #333; 
                            position: absolute;
                            top: 10px;
                            left: 50%;
                            transform: translateX(-50%);
                            margin: 0;
                            font-size: 16px;
                            background: rgba(255, 255, 255, 0.8);
                            padding: 5px 10px;
                            border-radius: 3px;
                        }
                        p {
                            position: absolute;
                            bottom: 10px;
                            left: 50%;
                            transform: translateX(-50%);
                            margin: 0;
                            font-size: 12px;
                            background: rgba(255, 255, 255, 0.8);
                            padding: 5px 10px;
                            border-radius: 3px;
                        }
                    </style>
                </head>
                <body>
                    <h1>${artworkTitle}</h1>
                    <img src="${imageDataToPrint}" alt="${artworkTitle}">
                    <p>制作时间: ${new Date().toLocaleString()}</p>
                </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
        
        Utils.showNotification('打印窗口已打开！', 'success');
    }

    /**
     * 开始新游戏
     */
    startNewGame() {
        this.hideSuccessModal();
        this.showHomePage(); 
    }

    /**
     * 显示加载状态
     * @param {string} message - 加载消息
     */
    showLoading(message = '加载中...') {
        this.elements.loadingOverlay.classList.add('show');
        const loadingText = this.elements.loadingOverlay.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        this.elements.loadingOverlay.classList.remove('show');
    }

    /**
     * 清理资源
     */
    cleanup() {
        gameEngine.cleanup();
        canvasRenderer.cleanup();
        imageProcessor.cleanup();
    }

    /**
     * 初始化图库
     */
    async initializeGallery() {
        this.showLoading('Loading image gallery...');
        await galleryManager.init();
        if (galleryManager.initialized) {
            this.renderFolderCategories();
            this.initializeSizeFilter();
            this.renderAllBuiltInImages(); // Show all images by default
        }
        this.hideLoading();
    }

    /**
     * 渲染图库的文件夹分类
     */
    renderFolderCategories() {
        if (!this.elements.folderCategoriesContainer) return;
        this.elements.folderCategoriesContainer.innerHTML = '<h3>By Category</h3>'; // Reset
        const folderCategoryNames = galleryManager.getFolderCategoryNames();

        if (folderCategoryNames.length === 0) {
            this.elements.folderCategoriesContainer.innerHTML += '<p>No categories found.</p>';
            return;
        }

        folderCategoryNames.forEach(categoryName => {
            const categorySection = document.createElement('div');
            categorySection.className = 'gallery-category-section';
            categorySection.innerHTML = `<h4>${Utils.capitalizeFirstLetter(categoryName)}</h4>`; // Assuming Utils.capitalizeFirstLetter exists or add it
            
            const imagesContainer = document.createElement('div');
            imagesContainer.className = 'gallery-images-container';
            
            const images = galleryManager.getImagesByFolderCategory(categoryName);
            this.renderImagesToContainer(images, imagesContainer);
            
            categorySection.appendChild(imagesContainer);
            this.elements.folderCategoriesContainer.appendChild(categorySection);
        });
    }

    /**
     * 初始化尺寸筛选器
     */
    initializeSizeFilter() {
        if (!this.elements.sizeFilter) return;
        
        // Clear existing options except the first one
        this.elements.sizeFilter.innerHTML = '<option value="all">所有尺寸</option>';
        
        const sizeCategoryNames = galleryManager.getSizeCategoryNames();
        sizeCategoryNames.forEach(categoryName => {
            const option = document.createElement('option');
            option.value = categoryName;
            option.textContent = categoryName;
            this.elements.sizeFilter.appendChild(option);
        });
    }

    /**
     * 渲染所有内置图库图片
     */
    renderAllBuiltInImages() {
        if (!this.elements.filteredImagesContainer) return;
        
        this.elements.filteredImagesContainer.innerHTML = '<h3>所有图片</h3>';
        
        // Get all images from all folder categories
        const allImages = [];
        const folderCategoryNames = galleryManager.getFolderCategoryNames();
        
        folderCategoryNames.forEach(categoryName => {
            const images = galleryManager.getImagesByFolderCategory(categoryName);
            allImages.push(...images);
        });
        
        if (allImages.length > 0) {
            const imagesContainer = document.createElement('div');
            imagesContainer.className = 'gallery-images-container';
            this.renderImagesToContainer(allImages, imagesContainer);
            this.elements.filteredImagesContainer.appendChild(imagesContainer);
        } else {
            this.elements.filteredImagesContainer.innerHTML += '<p>没有找到图片。</p>';
        }
    }

    /**
     * 应用图片筛选
     */
    applyImageFilter() {
        if (!this.elements.sizeFilter || !this.elements.filteredImagesContainer) return;
        
        const selectedSize = this.elements.sizeFilter.value;
        
        if (selectedSize === 'all') {
            this.renderAllBuiltInImages();
            return;
        }
        
        // Filter by selected size category
        this.elements.filteredImagesContainer.innerHTML = `<h3>${selectedSize}</h3>`;
        
        const filteredImages = galleryManager.getImagesBySizeCategory(selectedSize);
        
        if (filteredImages.length > 0) {
            const imagesContainer = document.createElement('div');
            imagesContainer.className = 'gallery-images-container';
            this.renderImagesToContainer(filteredImages, imagesContainer);
            this.elements.filteredImagesContainer.appendChild(imagesContainer);
        } else {
            this.elements.filteredImagesContainer.innerHTML += '<p>该尺寸分类中没有图片。</p>';
        }
    }

    /**
     * Helper to render image items to a given container.
     * @param {Array<object>} images - Array of image info objects from GalleryManager
     * @param {HTMLElement} container - The HTML element to append images to
     */
    renderImagesToContainer(images, container) {
        if (images.length === 0) {
            container.innerHTML = '<p style="font-style: italic; font-size: 0.9em;">No images in this category.</p>';
            return;
        }

        const userCompletedPaths = Utils.storage.get('userGallery', [])
                                          .filter(artwork => artwork.type === 'builtin-completed')
                                          .map(artwork => artwork.originalImageIdentifier);

        images.forEach(async imageInfo => { // Made async to handle image loading for thumbnails
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';
            galleryItem.dataset.imagePath = imageInfo.path;
            galleryItem.title = `${imageInfo.name} (${imageInfo.dimensions.width}x${imageInfo.dimensions.height})`;

            const imgDisplay = document.createElement('img');
            
            // Check if the image is from the built-in gallery (not user's own completed gallery section)
            // and if it has been completed by the user.
            const isUserGallerySection = container.closest('#userGalleryContainer');
            const hasBeenCompletedByUser = userCompletedPaths.includes(imageInfo.path);

            // Only add grayscale if it's in the built-in gallery section AND hasn't been completed
            if (!isUserGallerySection && !hasBeenCompletedByUser) {
                imgDisplay.classList.add('gallery-thumbnail-grayscale'); 
            } // Else, (it's in user gallery OR it's built-in but completed) -> show in color

            try {
                // Create a 1000% zoomed, pixel-perfect thumbnail using canvas
                const originalImg = await imageProcessor.loadImageFromUrl(imageInfo.path);
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                const scaleFactor = 10;
                tempCanvas.width = imageInfo.dimensions.width * scaleFactor;
                tempCanvas.height = imageInfo.dimensions.height * scaleFactor;
                
                tempCtx.imageSmoothingEnabled = false; // Crucial for pixel-perfect scaling
                tempCtx.drawImage(originalImg, 0, 0, tempCanvas.width, tempCanvas.height);
                
                imgDisplay.src = tempCanvas.toDataURL();
            } catch (error) {
                console.error(`Failed to create thumbnail for ${imageInfo.path}:`, error);
                imgDisplay.src = imageInfo.path; // Fallback to original path if thumbnail fails
                imgDisplay.alt = `${imageInfo.name} (thumbnail failed to load)`;
            }
            
            imgDisplay.alt = imageInfo.name; // Alt text
            
            const nameLabel = document.createElement('span');
            nameLabel.textContent = imageInfo.name;
            
            galleryItem.appendChild(imgDisplay);
            galleryItem.appendChild(nameLabel);
            
            galleryItem.addEventListener('click', () => this.handleGalleryImageClick(imageInfo.path));
            container.appendChild(galleryItem);
        });
    }

    /**
     * 处理画廊图片点击事件
     * @param {string} imagePath - 被点击图片的路径
     */
    async handleGalleryImageClick(imagePath) {
        if (this.isProcessing) {
            console.log('[Debug] handleGalleryImageClick skipped: isProcessing is true for imagePath:', imagePath);
            return;
        }
        console.log('[Debug] handleGalleryImageClick started for imagePath:', imagePath);
        this.showLoading('Loading selected image...');
        try {
            const userCompletedGallery = Utils.storage.get('userCompletedGallery', []);
            const completedEntry = userCompletedGallery.find(art => art.originalImageIdentifier === imagePath);

            this.currentUploadedImageName = null; // Clear for gallery images
            this.currentImageManifestPath = imagePath; // Store the original manifest path
            
            console.log('[Debug] handleGalleryImageClick: About to load image for path:', imagePath);
            const loadedImage = await imageProcessor.loadImageFromUrl(imagePath);
            this.currentImage = loadedImage; // Keep for potential other uses, but pass directly
            console.log('[Debug] handleGalleryImageClick: Image loaded. src (first 100 chars):', loadedImage ? loadedImage.src.substring(0, 100) : 'null', 'for path:', imagePath);

            const imageNameForNotification = galleryManager.getImageByPath(imagePath)?.name || loadedImage.name || 'Image';

            if (completedEntry) {
                Utils.showNotification(`Loading completed: ${imageNameForNotification}...`, 'info');
                console.log('[Debug] handleGalleryImageClick: Calling generateCompletedGameView for completed entry. Image path:', imagePath, 'Loaded image src (first 100):', loadedImage.src.substring(0,100));
                await this.generateCompletedGameView(loadedImage, completedEntry, imagePath);
            } else {
                Utils.showNotification(`Selected: ${imageNameForNotification}. Generating game...`, 'info');
                console.log('[Debug] handleGalleryImageClick: Calling generateGame for new game. Image path:', imagePath, 'Loaded image src (first 100):', loadedImage.src.substring(0,100));
                await this.generateGame(loadedImage, imagePath); 
            }
        } catch (error) {
            Utils.showNotification(`Error loading gallery image: ${error.message}`, 'error');
            console.error("Error in handleGalleryImageClick:", error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Generates the game view for an already completed artwork.
     * @param {HTMLImageElement} imageToProcess - The loaded HTMLImageElement.
     * @param {object} artworkEntry - The artwork entry from user's completed gallery.
     * @param {string} imageIdentifier - The path or name for context.
     */
    async generateCompletedGameView(imageToProcess, artworkEntry, imageIdentifier) {
        if (!imageToProcess || this.isProcessing) return;

        this._resetPreviousGameDisplay(); // Clear previous game state and UI

        this.isProcessing = true;
        this.showLoading('Preparing completed artwork view...');

        try {
            const options = {
                colorCount: 16, // Always use 16 colors for reprocessing, ignore saved palette length
                gridSize: 'pixel',
                algorithm: 'kmeans' // Or determine from artworkEntry if stored
            };

            // Reprocess the image to get the original gameGrid structure
            const gameData = await imageProcessor.processImage(imageToProcess, options);

            // Mark all non-transparent cells as revealed
            if (gameData.gameGrid) {
                for (const row of gameData.gameGrid) {
                    for (const cell of row) {
                        if (cell && !cell.isTransparent) {
                            cell.revealed = true;
                        }
                    }
                }
            }
            
            // Initialize game engine with this fully revealed gameData
            gameEngine.initGame(gameData);
            
            // Set renderer data
            canvasRenderer.setGameData(gameEngine.getGameData());
            
            // Generate legend (will show all counts as 0 or '✓')
            this.generateLegend(gameData.palette);
            
            // Manually set game state to completed in gameEngine
            // This requires gameEngine to have a method to set a game as complete or load such state.
            // For now, we can simulate the stats of a completed game.
            gameEngine.setGameAsCompleted(artworkEntry.playTime || 0, false); // Don't emit complete event to avoid modal popup
            
            // Update game info to reflect completion
            this.updateGameInfo(gameEngine.getGameStats());
            this.updateLegend(); // Ensure legend shows completed state
            
            Utils.showNotification(
                `Displaying completed artwork: ${artworkEntry.name}`,
                'success',
                4000
            );
            this.showGamePage();

        } catch (error) {
            Utils.showNotification(`Failed to display completed artwork: ${error.message}`, 'error');
            console.error("Error in generateCompletedGameView:", error);
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    /**
     * Shows the Home Page view and hides the Game Page view.
     */
    showHomePage() {
        if (this.elements.homePage) this.elements.homePage.style.display = 'block'; // Or your default display type e.g. 'flex', 'grid'
        if (this.elements.gamePage) this.elements.gamePage.style.display = 'none';
        if (this.elements.myGalleryPage) this.elements.myGalleryPage.style.display = 'none';
        
        // Update navigation state
        this.updateNavigation('home');
        
        // Optional: Clean up game state when returning to home
        if (gameEngine && typeof gameEngine.cleanup === 'function') {
            gameEngine.cleanup();
        }
        if (canvasRenderer && typeof canvasRenderer.cleanup === 'function') {
            canvasRenderer.cleanup();
        }
        // Reset file input display to original hint text
        if(this.elements.fileName) this.elements.fileName.textContent = this.FILE_INPUT_HINT_TEXT;
        this.currentImage = null;
        this.currentUploadedImageName = null; // Clear stored uploaded file name
        // Clear legend and game info if they are not part of gamePage div and get repopulated
        if(this.elements.legendContainer) this.elements.legendContainer.innerHTML = '<p class="legend-placeholder">生成游戏后显示颜色对应关系</p>';
        if(this.elements.progressFill) this.elements.progressFill.style.width = '0%';
        if(this.elements.progressText) this.elements.progressText.textContent = '0%';
        if(this.elements.totalAreas) this.elements.totalAreas.textContent = '0';
        if(this.elements.completedAreas) this.elements.completedAreas.textContent = '0';
        if(this.elements.remainingAreas) this.elements.remainingAreas.textContent = '0';
        if(this.elements.gameTime) this.elements.gameTime.textContent = '00:00';

        // 刷新图库显示以反映最新的完成状态
        this.refreshGalleryDisplay();

        console.log("Switched to Home Page");
    }

    /**
     * 刷新图库显示以反映最新的完成状态
     */
    refreshGalleryDisplay() {
        // 刷新文件夹分类显示
        if (galleryManager && galleryManager.initialized) {
            this.renderFolderCategories();
            
            // 刷新筛选后的图片显示（如果当前有筛选）
            if (this.elements.sizeFilter && this.elements.sizeFilter.value === 'all') {
                this.renderAllBuiltInImages();
            } else {
                this.applyImageFilter();
            }
        }
        
        console.log('[Debug] Gallery display refreshed');
    }

    /**
     * Shows the My Gallery Page view and hides other page views.
     */
    showMyGalleryPage() {
        if (this.elements.homePage) this.elements.homePage.style.display = 'none';
        if (this.elements.gamePage) this.elements.gamePage.style.display = 'none';
        if (this.elements.myGalleryPage) this.elements.myGalleryPage.style.display = 'block';
        
        // Update navigation state
        this.updateNavigation('gallery');
        
        // 清理无效的画廊条目
        this.cleanupInvalidGalleryEntries();
        
        // Render the user gallery
        this.renderUserGallery();
        
        console.log("Switched to My Gallery Page");
    }

    /**
     * Shows the Game Page view and hides the Home Page view.
     */
    showGamePage() {
        if (this.elements.homePage) this.elements.homePage.style.display = 'none';
        if (this.elements.gamePage) this.elements.gamePage.style.display = 'block'; // Or your game page default display
        if (this.elements.myGalleryPage) this.elements.myGalleryPage.style.display = 'none';
        
        // Update navigation - no specific active state for game page
        this.updateNavigation(null);
        
        // 多重确保滚动到页面顶部（特别是移动设备）
        this._scrollToTop();
        
        // Ensure canvas is resized correctly now that it's visible
        this.resizeCanvas(); 
        
        // Explicitly reset the view again now that canvas has correct dimensions
        if (canvasRenderer) {
            canvasRenderer.resetView(); 
        }

        // Render game if data is ready
        if (canvasRenderer && gameEngine && gameEngine.getGameData()) {
            canvasRenderer.render();
        }
        console.log("Switched to Game Page");
    }

    /**
     * 确保页面滚动到顶部（移动端优化）
     * @private
     */
    _scrollToTop() {
        // 方法1: 立即滚动到顶部
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        
        // 方法2: 使用window.scrollTo (兼容性更好)
        if (window.scrollTo) {
            window.scrollTo(0, 0);
        }
        
        // 方法3: 平滑滚动 (现代浏览器)
        try {
            window.scrollTo({
                top: 0,
                left: 0,
                behavior: 'smooth'
            });
        } catch (e) {
            // 降级处理
            window.scrollTo(0, 0);
        }
        
        // 方法4: 使用短延迟确保在移动设备上生效
        setTimeout(() => {
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            if (window.scrollTo) {
                window.scrollTo(0, 0);
            }
        }, 50);
        
        // 方法5: 再次确保（解决某些移动浏览器的延迟问题）
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 200);
        
        console.log('[Debug] Scrolled to top for mobile optimization');
    }

    /**
     * Updates the navigation button states
     * @param {string} activePage - 'home', 'gallery', or null
     */
    updateNavigation(activePage) {
        if (this.elements.homeNavBtn) {
            this.elements.homeNavBtn.classList.toggle('active', activePage === 'home');
        }
        if (this.elements.galleryNavBtn) {
            this.elements.galleryNavBtn.classList.toggle('active', activePage === 'gallery');
        }
    }

    /**
     * Saves the completed artwork to localStorage.
     * @param {object} gameResult - The result object from gameEngine.on('complete')
     */
    async saveCompletedArtwork(gameResult) {
        if (!gameEngine.gameData || !this.currentImage) {
            console.error("Cannot save artwork: game data or current image is missing.");
            return;
        }

        const { dimensions, palette } = gameEngine.gameData;
        
        let artworkName;
        let originalImageIdentifier;
        let isUploadedImage = false;

        if (this.currentImageManifestPath) {
            // Image came from the built-in gallery
            originalImageIdentifier = this.currentImageManifestPath;
            artworkName = galleryManager.getImageByPath(this.currentImageManifestPath)?.name || 'Untitled Gallery Image';
        } else {
            // Image was uploaded by the user
            originalImageIdentifier = this.currentImage.src; // This will be a dataURL for uploaded files
            isUploadedImage = true;
            if (this.currentUploadedImageName) {
                artworkName = this.currentUploadedImageName;
            } else {
                console.warn("Saving uploaded artwork, but currentUploadedImageName is not set. Using fallback name.");
                artworkName = 'Untitled Uploaded File'; 
                if (this.elements.fileName.textContent && this.elements.fileName.textContent !== '未选择文件' && this.elements.fileName.textContent.trim() !== '') {
                    artworkName = this.elements.fileName.textContent;
                }
            }
        }

        try {
            Utils.showNotification('Saving artwork...', 'info');
            
            const completedImageDataUrl = canvasRenderer.exportImage(1); // 1x scale for full image
            
            // Generate thumbnail
            let thumbnailScale = 10; // Default to 10x like built-in previews
            if (dimensions.width * 10 > 200) { 
                thumbnailScale = 200 / dimensions.width;
            }
            const thumbnailDataUrl = canvasRenderer.exportImage(thumbnailScale);

            if (isUploadedImage) {
                // Update the existing uploaded image entry in userGallery
                let userGallery = Utils.storage.get('userGallery', []);
                const existingIndex = userGallery.findIndex(item => 
                    item.originalImageIdentifier === originalImageIdentifier && 
                    item.type === 'uploaded'
                );
                
                if (existingIndex > -1) {
                    // Update existing uploaded image entry
                    userGallery[existingIndex] = {
                        ...userGallery[existingIndex],
                        isCompleted: true,
                        completedImageDataUrl: completedImageDataUrl,
                        thumbnailDataUrl: thumbnailDataUrl, // Update with colored version
                        completionTimestamp: Date.now(),
                        playTime: gameResult.playTime,
                        palette: Utils.deepClone(palette)
                    };
                    
                    Utils.storage.set('userGallery', userGallery);
                    Utils.showNotification(`作品 "${artworkName}" 完成并已更新！`, 'success');
                } else {
                    console.warn('Could not find uploaded image in userGallery to update completion status');
                }
            } else {
                // Handle built-in gallery images (keep existing logic)
                const artworkEntry = {
                    id: `${Date.now()}-${originalImageIdentifier.slice(-20).replace(/[^a-zA-Z0-9]/g, '')}`,
                    originalImageIdentifier: originalImageIdentifier,
                    name: artworkName,
                    dimensions: { ...dimensions },
                    completedImageDataUrl: completedImageDataUrl,
                    thumbnailDataUrl: thumbnailDataUrl,
                    completionTimestamp: Date.now(),
                    playTime: gameResult.playTime,
                    palette: Utils.deepClone(palette),
                    type: 'builtin-completed' // Mark as completed built-in
                };

                let userGallery = Utils.storage.get('userGallery', []);
                
                // Deduplication for built-in images
                const existingArtworkIndex = userGallery.findIndex(
                    art => art.originalImageIdentifier === artworkEntry.originalImageIdentifier &&
                           art.type === 'builtin-completed'
                );

                if (existingArtworkIndex > -1) {
                    userGallery.splice(existingArtworkIndex, 1, artworkEntry);
                    Utils.showNotification(`作品 "${artworkName}" 已在我的画廊中更新!`, 'info');
                } else {
                    userGallery.unshift(artworkEntry);
                    Utils.showNotification(`作品 "${artworkName}" 已保存到我的画廊!`, 'success');
                }
                
                Utils.storage.set('userGallery', userGallery);
            }

        } catch (error) {
            console.error('Error saving completed artwork:', error);
            Utils.showNotification('保存作品失败', 'error');
        }
    }

    /**
     * Renders the user's gallery from localStorage (includes uploaded images and completed built-in images).
     */
    renderUserGallery() {
        if (!this.elements.userGalleryContainer) return;
        this.elements.userGalleryContainer.innerHTML = '';

        const userGallery = Utils.storage.get('userGallery', []);

        if (userGallery.length === 0) {
            this.elements.userGalleryContainer.innerHTML += '<p class="gallery-placeholder">您还没有上传或完成任何作品。</p>';
            return;
        }

        // Separate uploaded and completed built-in images
        const uploadedImages = userGallery.filter(item => item.type === 'uploaded');
        const completedBuiltIns = userGallery.filter(item => item.type === 'builtin-completed');

        // Render uploaded images section
        if (uploadedImages.length > 0) {
            const uploadedSection = document.createElement('div');
            uploadedSection.className = 'gallery-category-section';
            uploadedSection.innerHTML = '<h3>📤 我上传的图片</h3>';
            
            const uploadedContainer = document.createElement('div');
            uploadedContainer.className = 'gallery-images-container';
            
            uploadedImages.forEach(imageEntry => {
                const galleryItem = this.createUserGalleryItem(imageEntry);
                uploadedContainer.appendChild(galleryItem);
            });
            
            uploadedSection.appendChild(uploadedContainer);
            this.elements.userGalleryContainer.appendChild(uploadedSection);
        }

        // Render completed built-in images section
        if (completedBuiltIns.length > 0) {
            const completedSection = document.createElement('div');
            completedSection.className = 'gallery-category-section';
            completedSection.innerHTML = '<h3>✅ 已完成的内置图片</h3>';
            
            const completedContainer = document.createElement('div');
            completedContainer.className = 'gallery-images-container';
            
            completedBuiltIns.forEach(imageEntry => {
                const galleryItem = this.createUserGalleryItem(imageEntry);
                completedContainer.appendChild(galleryItem);
            });
            
            completedSection.appendChild(completedContainer);
            this.elements.userGalleryContainer.appendChild(completedSection);
        }
    }

    /**
     * Creates a gallery item element for user gallery
     * @param {object} imageEntry - The image entry from userGallery
     * @returns {HTMLElement} The gallery item element
     */
    createUserGalleryItem(imageEntry) {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item user-gallery-item';
        
        // Add completion status class
        if (imageEntry.isCompleted) {
            galleryItem.classList.add('completed');
        } else {
            galleryItem.classList.add('incomplete');
        }
        
        const completionDate = imageEntry.completionTimestamp ? 
            new Date(imageEntry.completionTimestamp).toLocaleDateString() : '';
        const uploadDate = new Date(imageEntry.uploadTimestamp).toLocaleDateString();
        
        let titleText = `${imageEntry.name} (${imageEntry.dimensions.width}×${imageEntry.dimensions.height})`;
        if (imageEntry.isCompleted) {
            titleText += ` - 已完成 (${completionDate})`;
        } else {
            titleText += ` - 未完成 (上传于: ${uploadDate})`;
        }
        
        galleryItem.title = titleText;

        const imgDisplay = document.createElement('img');
        imgDisplay.src = imageEntry.thumbnailDataUrl;
        imgDisplay.alt = imageEntry.name;
        
        // Add visual indicator for completion status
        // 已完成的图片应该显示彩色，不添加灰度滤镜
        // if (!imageEntry.isCompleted) {
        //     imgDisplay.classList.add('gallery-thumbnail-grayscale');
        // }
        
        const nameLabel = document.createElement('span');
        nameLabel.textContent = imageEntry.name;
        
        galleryItem.appendChild(imgDisplay);
        galleryItem.appendChild(nameLabel);
        
        // 为上传的图片添加删除按钮
        if (imageEntry.type === 'uploaded') {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = '删除此图片';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止触发图片点击事件
                this.handleDeleteUserGalleryItem(imageEntry);
            });
            galleryItem.appendChild(deleteBtn);
        }
        
        galleryItem.addEventListener('click', () => this.handleUserGalleryItemClick(imageEntry));
        
        return galleryItem;
    }

    /**
     * Handles clicking on an item in the user's completed gallery.
     * @param {object} artworkEntry - The artwork data from localStorage.
     */
    async handleUserGalleryItemClick(artworkEntry) {
        if (this.isProcessing) {
            console.log('[Debug] handleUserGalleryItemClick skipped: isProcessing is true');
            return;
        }

        console.log('[Debug] handleUserGalleryItemClick started for:', artworkEntry.name);
        this.showLoading('Loading image...');

        try {
            // Set current image context
            this.currentUploadedImageName = artworkEntry.name;
            this.currentImageManifestPath = null; // Clear for uploaded images

            if (artworkEntry.type === 'uploaded') {
                // Handle uploaded images
                const loadedImage = await imageProcessor.loadImageFromDataUrl(artworkEntry.originalImageDataUrl);
                this.currentImage = loadedImage;

                if (artworkEntry.isCompleted) {
                    // Show completed version
                    Utils.showNotification(`Loading completed artwork: ${artworkEntry.name}`, 'info');
                    await this.generateCompletedGameView(loadedImage, artworkEntry, artworkEntry.name);
                } else {
                    // Start new game for incomplete uploaded image
                    Utils.showNotification(`Starting game for: ${artworkEntry.name}`, 'info');
                    await this.generateGame(loadedImage, artworkEntry.name);
                }
            } else if (artworkEntry.type === 'builtin-completed') {
                // Handle completed built-in images - show share options
                Utils.showNotification(`Selected completed artwork: ${artworkEntry.name}`, 'info');
                this.showShareOptions(artworkEntry);
            }

        } catch (error) {
            Utils.showNotification(`Error loading image: ${error.message}`, 'error');
            console.error("Error in handleUserGalleryItemClick:", error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Calculates the appropriate HD scaling factor based on image width.
     * @param {number} width - The width of the image.
     * @returns {number} The scale factor.
     */
    getHdScaleFactor(width) {
        if (width <= 16) return 40; // 4000%
        if (width <= 24) return 30; // 3000%
        if (width <= 32) return 30; // 3000%
        if (width <= 48) return 20; // 2000%
        if (width <= 64) return 20; // 2000%
        return 8; // 800% for > 64x64
    }

    /**
     * Resets UI elements related to the game display before a new game starts.
     */
    _resetPreviousGameDisplay() {
        console.log('[Debug] _resetPreviousGameDisplay called - clearing all previous game state');
        
        // Clear gameEngine first to prevent conflicts
        if (gameEngine) {
            gameEngine.cleanup();
        }
        
        // Clear canvasRenderer and force clear canvas
        if (canvasRenderer) {
            canvasRenderer.clearAndReset();
            // Force clear the canvas with white background to ensure no artifacts remain
            const canvas = canvasRenderer.canvas;
            const ctx = canvasRenderer.ctx;
            if (canvas && ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
        
        // Reset all UI elements
        if(this.elements.legendContainer) this.elements.legendContainer.innerHTML = '<p class="legend-placeholder">生成游戏后显示颜色对应关系</p>';
        if(this.elements.progressFill) this.elements.progressFill.style.width = '0%';
        if(this.elements.progressText) this.elements.progressText.textContent = '0%';
        if(this.elements.totalAreas) this.elements.totalAreas.textContent = '0';
        if(this.elements.completedAreas) this.elements.completedAreas.textContent = '0';
        if(this.elements.remainingAreas) this.elements.remainingAreas.textContent = '0';
        if(this.elements.gameTime) this.elements.gameTime.textContent = '00:00';

        // Clear any saved progress to prevent interference
        if (gameEngine && typeof gameEngine.clearSavedProgress === 'function') {
            gameEngine.clearSavedProgress();
        }
        
        console.log('[Debug] _resetPreviousGameDisplay completed');
    }

    /**
     * 测试网格导出功能
     */
    testGridExport() {
        if (canvasRenderer && gameEngine && gameEngine.getGameData()) {
            console.log('[Test] Testing grid export...');
            const testImage = canvasRenderer.exportImage(2, true);
            if (testImage) {
                console.log('[Test] Grid export successful, image length:', testImage.length);
                // 创建一个临时链接来下载测试图片
                const link = document.createElement('a');
                link.href = testImage;
                link.download = 'test-grid-export.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Utils.showNotification('测试网格导出完成，请检查下载的图片', 'success');
            } else {
                console.log('[Test] Grid export failed');
                Utils.showNotification('网格导出测试失败', 'error');
            }
        } else {
            Utils.showNotification('请先加载一个游戏再测试', 'warning');
        }
    }

    /**
     * 切换油漆桶工具
     */
    toggleBucketTool() {
        if (!gameEngine || !gameEngine.getGameData()) {
            Utils.showNotification('请先加载游戏！', 'warning');
            return;
        }

        this.bucketTool.isActive = !this.bucketTool.isActive;
        
        if (this.bucketTool.isActive) {
            this.elements.autoFillBtn.classList.add('bucket-active');
            this.elements.autoFillBtn.textContent = '🪣 油漆桶 (激活)';
            Utils.showNotification('油漆桶已激活！点击格子填充相邻同颜色区域', 'info', 3000);
            
            // 改变画布光标样式
            if (canvasRenderer && canvasRenderer.canvas) {
                canvasRenderer.canvas.style.cursor = 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTQgNEwxOCA4TDE2IDEwTDE0IDhMMTIgMTBMMTAgOEw4IDEwTDYgOEwxMCA0TDEyIDJaIiBzdHJva2U9IiMwMDAiIGZpbGw9IiNmZmYiLz4KPC9zdmc+") 12 12, pointer';
            }
        } else {
            this.elements.autoFillBtn.classList.remove('bucket-active');
            this.elements.autoFillBtn.textContent = '🪣 油漆桶';
            Utils.showNotification('油漆桶已停用', 'info');
            
            // 恢复默认光标样式
            if (canvasRenderer && canvasRenderer.canvas) {
                canvasRenderer.canvas.style.cursor = 'crosshair';
            }
        }
    }

    /**
     * 使用油漆桶填充相邻同颜色区域
     * @param {object} startCell - 起始单元格
     */
    bucketFill(startCell) {
        if (!startCell || startCell.revealed || !this.bucketTool.isActive) {
            return;
        }

        const targetNumber = startCell.number;
        const gameData = gameEngine.getGameData();
        const { gameGrid } = gameData;
        
        // 找到所有相邻的相同数字未填充单元格
        const cellsToFill = this.findConnectedCells(startCell, targetNumber, gameGrid);
        
        if (cellsToFill.length === 0) {
            Utils.showNotification('没有找到相邻的同颜色区域', 'warning');
            return;
        }

        // 填充所有找到的单元格
        let filledCount = 0;
        cellsToFill.forEach(cell => {
            if (gameEngine.fillCell(cell)) {
                filledCount++;
            }
        });

        if (filledCount > 0) {
            Utils.showNotification(`油漆桶填充了 ${filledCount} 个区域`, 'success');
            canvasRenderer.render();
        }

        // 填充后自动停用油漆桶
        this.bucketTool.isActive = false;
        this.elements.autoFillBtn.classList.remove('bucket-active');
        this.elements.autoFillBtn.textContent = '🪣 油漆桶';
        
        // 恢复默认光标
        if (canvasRenderer && canvasRenderer.canvas) {
            canvasRenderer.canvas.style.cursor = 'crosshair';
        }
    }

    /**
     * 查找相邻的相同数字单元格（使用广度优先搜索）
     * @param {object} startCell - 起始单元格
     * @param {number} targetNumber - 目标数字
     * @param {Array} gameGrid - 游戏网格
     * @returns {Array} 相邻的同数字单元格数组
     */
    findConnectedCells(startCell, targetNumber, gameGrid) {
        const visited = new Set();
        const result = [];
        const queue = [startCell];
        
        // 方向数组：上、下、左、右
        const directions = [
            [-1, 0], [1, 0], [0, -1], [0, 1]
        ];

        while (queue.length > 0) {
            const cell = queue.shift();
            const cellKey = `${cell.row}-${cell.col}`;
            
            if (visited.has(cellKey)) continue;
            visited.add(cellKey);
            
            // 检查是否符合条件：相同数字且未填充
            if (cell.number === targetNumber && !cell.revealed && !cell.isTransparent) {
                result.push(cell);
                
                // 检查相邻单元格
                directions.forEach(([dr, dc]) => {
                    const newRow = cell.row + dr;
                    const newCol = cell.col + dc;
                    
                    if (newRow >= 0 && newRow < gameGrid.length && 
                        newCol >= 0 && newCol < gameGrid[0].length) {
                        const neighborCell = gameGrid[newRow][newCol];
                        if (neighborCell && !visited.has(`${newRow}-${newCol}`)) {
                            queue.push(neighborCell);
                        }
                    }
                });
            }
        }
        
        return result;
    }

    /**
     * 处理删除用户画廊中的图片
     * @param {object} imageEntry - 要删除的图片条目
     */
    handleDeleteUserGalleryItem(imageEntry) {
        // 确认删除
        const confirmMessage = `确定要删除图片 "${imageEntry.name}" 吗？\n${imageEntry.isCompleted ? '已完成的作品' : '未完成的作品'}将被永久删除。`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            // 获取现有的用户画廊数据
            let userGallery = Utils.storage.get('userGallery', []);
            
            // 找到并删除对应的条目
            const indexToDelete = userGallery.findIndex(item => 
                item.id === imageEntry.id && item.type === 'uploaded'
            );
            
            if (indexToDelete > -1) {
                userGallery.splice(indexToDelete, 1);
                Utils.storage.set('userGallery', userGallery);
                
                Utils.showNotification(`图片 "${imageEntry.name}" 已删除`, 'success');
                
                // 重新渲染用户画廊
                this.renderUserGallery();
            } else {
                Utils.showNotification('删除失败：找不到对应的图片记录', 'error');
            }
        } catch (error) {
            console.error('Error deleting user gallery item:', error);
            Utils.showNotification('删除失败：发生错误', 'error');
        }
    }

    /**
     * 清理用户画廊中的无效条目
     */
    cleanupInvalidGalleryEntries() {
        try {
            let userGallery = Utils.storage.get('userGallery', []);
            const originalLength = userGallery.length;
            
            // 过滤掉无效的条目
            userGallery = userGallery.filter(item => {
                // 检查必要字段是否存在
                if (!item.id || !item.name || !item.type) {
                    console.log('Removing invalid gallery item (missing required fields):', item);
                    return false;
                }
                
                // 检查尺寸是否有效
                if (item.type === 'uploaded' && item.dimensions) {
                    if (item.dimensions.width > 300 || item.dimensions.height > 300) {
                        console.log('Removing oversized gallery item:', item.name, item.dimensions);
                        return false;
                    }
                }
                
                return true;
            });
            
            // 如果有清理的条目，保存更新后的画廊
            if (userGallery.length !== originalLength) {
                Utils.storage.set('userGallery', userGallery);
                const cleanedCount = originalLength - userGallery.length;
                console.log(`Cleaned up ${cleanedCount} invalid gallery entries`);
                Utils.showNotification(`已清理 ${cleanedCount} 个无效的画廊条目`, 'info');
            }
        } catch (error) {
            console.error('Error cleaning up gallery entries:', error);
        }
    }
}

// 全局测试函数（可在浏览器控制台调用）
window.testGridExport = function() {
    if (window.app) {
        window.app.testGridExport();
    } else {
        console.error('App not initialized');
    }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ColorByNumbersApp();
    
    // 全局错误处理
    window.addEventListener('error', (e) => {
        console.error('Application error:', e.error);
        Utils.showNotification('发生了一个错误，请刷新页面重试', 'error');
    });
    
    // 页面卸载时清理资源
    window.addEventListener('beforeunload', () => {
        app.cleanup();
        // If auto-saving progress, ensure it's saved before unload if game is active.
        if (gameEngine && gameEngine.gameState && gameEngine.gameState.isPlaying) {
            gameEngine.saveProgress();
        }
    });
}); 