/**
 * 主应用逻辑
 * 整合所有模块并处理用户交互
 */

class ColorByNumbersApp {
    constructor() {
        this.currentImage = null;
        this.currentImageManifestPath = null; // To store original path from manifest
        this.currentUploadedImageName = null; // To store name of uploaded file
        this.isProcessing = false;
        
        this.initializeElements();
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupGameEngine();
        this.initializeGallery();
        
        console.log('Color by Numbers App initialized');
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
            sizeCategoriesContainer: document.getElementById('sizeCategoriesContainer'),
            userGalleryContainer: document.getElementById('userGalleryContainer'),

            // Page containers
            homePage: document.getElementById('homePage'),
            gamePage: document.getElementById('gamePage'),

            // Game page specific elements (ensure these IDs are correct in your HTML)
            backToHomeBtn: document.getElementById('backToHomeBtn'), // New button
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
        const height = Math.floor(Math.max(400, rect.height - 4));
        
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
            canvasRenderer.zoom(); // 使用默认的1.2倍放大
        });

        this.elements.zoomOutBtn.addEventListener('click', () => {
            canvasRenderer.zoom(1 / canvasRenderer.settings.zoomFactor); // 缩小（1/1.2）
        });

        // 游戏控制
        this.elements.resetGameBtn.addEventListener('click', () => {
            this.resetGame();
        });

        this.elements.autoFillBtn.addEventListener('click', () => {
            this.showAutoFillOptions();
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

        // New button event listener
        if (this.elements.backToHomeBtn) { // Check if element exists
            this.elements.backToHomeBtn.addEventListener('click', () => {
                this.showHomePage();
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
            this.renderUserGallery();
        });

        gameEngine.on('cellFilled', (cell) => {
            this.updateLegend();
        });

        gameEngine.on('timeUpdate', (seconds) => {
            this.elements.gameTime.textContent = Utils.formatTime(seconds);
        });

        this.hideLoading();
        this.renderUserGallery();
    }

    /**
     * 处理文件上传
     * @param {File} file - 上传的文件
     */
    async handleFileUpload(file) {
        if (!file) {
            this.currentUploadedImageName = null; // Ensure cleared if no file
            return;
        }

        this.currentImageManifestPath = null; // Clear manifest path for uploaded files
        this.currentUploadedImageName = null; // Reset before attempting to set

        const validation = imageProcessor.validateImageFile(file);
        if (!validation.valid) {
            Utils.showNotification(validation.errors.join(', '), 'error');
            // currentUploadedImageName remains null
            return;
        }

        this.elements.fileName.textContent = file.name;
        this.currentUploadedImageName = file.name; // Store the uploaded file name

        try {
            const loadedImage = await imageProcessor.loadImageFromFile(file);
            this.currentImage = loadedImage; // Keep for potential other uses, but pass directly
            Utils.showNotification('图片加载成功！正在生成游戏...', 'success');
            
            // 自动生成游戏
            await this.generateGame(loadedImage, file.name);
        } catch (error) {
            Utils.showNotification(error.message, 'error');
        }
    }

    /**
     * 生成游戏
     * @param {HTMLImageElement} imageToProcess - The image element to process.
     * @param {string} imageIdentifier - The name or path of the image for context.
     */
    async generateGame(imageToProcess, imageIdentifier) {
        // Debug log to check the source of the current image being processed
        console.log('[Debug] generateGame called. Processing image src:', imageToProcess ? imageToProcess.src : 'null', 'Identifier:', imageIdentifier, 'isProcessing:', this.isProcessing);

        this._resetPreviousGameDisplay(); // Clear previous game state and UI

        if (!imageToProcess || this.isProcessing) {
            if (!imageToProcess) console.warn('generateGame aborted: No imageToProcess provided.');
            if (this.isProcessing) console.warn('generateGame aborted: Still processing a previous image.');
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

            const gameData = await imageProcessor.processImage(imageToProcess, options);
            
            // 显示图片信息
            const imageInfo = imageProcessor.getImageInfo(imageToProcess);
            const totalPixels = gameData.dimensions.width * gameData.dimensions.height;
            
            // 初始化游戏引擎
            gameEngine.initGame(gameData);
            
            // 设置渲染器数据 - 使用gameEngine的数据确保同步
            canvasRenderer.setGameData(gameEngine.getGameData());
            
            // 生成颜色图例
            this.generateLegend(gameData.palette);
            
            // 开始游戏
            gameEngine.startGame();
            
            Utils.showNotification(
                `像素级填色游戏生成成功！图片尺寸: ${gameData.dimensions.width}×${gameData.dimensions.height} (${totalPixels}个像素)`,
                'success',
                4000
            );
            this.showGamePage(); // Switch to game view

        } catch (error) {
            if (error.message === 'Image contains too many colors (max 128 allowed).') {
                Utils.showNotification('图片颜色种类过多 (最多允许128种)，请选择颜色较少的图片。', 'warning', 5000);
            } else {
                Utils.showNotification(`游戏生成失败: ${error.message}`, 'error');
            }
        } finally {
            this.isProcessing = false;
            this.hideLoading();
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
                            <button class="share-btn other-btn" data-action="save-clipboard">
                                📋 复制到剪贴板
                            </button>
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
                    
                case 'save-clipboard':
                    await this.copyImageToClipboard(artworkEntry);
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
     * 复制图片到剪贴板
     * @param {object} [artworkEntry=null] - Optional. The artwork entry for context.
     */
    async copyImageToClipboard(artworkEntry = null) {
        try {
            let imageBlob;
            if (artworkEntry && artworkEntry.completedImageDataUrl) {
                const response = await fetch(artworkEntry.completedImageDataUrl);
                imageBlob = await response.blob();
            } else if (canvasRenderer) {
                const currentImageData = canvasRenderer.exportImage(2); // 2倍清晰度适合剪贴板
                const response = await fetch(currentImageData);
                imageBlob = await response.blob();
            } else {
                throw new Error('无法获取图片数据');
            }
            
            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': imageBlob })
                ]);
                Utils.showNotification('图片已复制到剪贴板！', 'success');
            } else {
                throw new Error('浏览器不支持剪贴板API');
            }
        } catch (error) {
            Utils.showNotification('复制到剪贴板失败，请尝试下载功能', 'warning');
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

            if (artworkEntry && artworkEntry.completedImageDataUrl) {
                imageDataToPrint = artworkEntry.completedImageDataUrl;
                artworkTitle = artworkEntry.name || artworkTitle;
            } else if (canvasRenderer) {
                imageDataToPrint = canvasRenderer.exportImage(5); // 5倍清晰度适合打印
            } else {
                Utils.showNotification('没有可打印的图片', 'warning');
                return;
            }
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${artworkTitle}</title>
                        <style>
                            body { margin: 0; padding: 20px; text-align: center; }
                            img { max-width: 100%; height: auto; }
                            h1 { font-family: Arial, sans-serif; color: #333; }
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
        } catch (error) {
            Utils.showNotification('打印功能失败，请重试', 'error');
        }
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
            this.renderSizeCategories();
            // TODO: Add logic for user's completed gallery
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
     * 渲染图库的尺寸分类
     */
    renderSizeCategories() {
        if (!this.elements.sizeCategoriesContainer) return;
        this.elements.sizeCategoriesContainer.innerHTML = '<h3>By Size</h3>'; // Reset
        const sizeCategoryNames = galleryManager.getSizeCategoryNames();

        if (sizeCategoryNames.length === 0) {
            this.elements.sizeCategoriesContainer.innerHTML += '<p>No size categories found.</p>';
            return;
        }

        sizeCategoryNames.forEach(categoryName => {
            const images = galleryManager.getImagesBySizeCategory(categoryName);
            if (images.length > 0) { // Only render if there are images in this size category
                const categorySection = document.createElement('div');
                categorySection.className = 'gallery-category-section';
                categorySection.innerHTML = `<h4>${categoryName}</h4>`;
                
                const imagesContainer = document.createElement('div');
                imagesContainer.className = 'gallery-images-container';
                
                this.renderImagesToContainer(images, imagesContainer);
                
                categorySection.appendChild(imagesContainer);
                this.elements.sizeCategoriesContainer.appendChild(categorySection);
            }
        });
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

        const userCompletedPaths = Utils.storage.get('userCompletedGallery', [])
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
        
        // Optional: Clean up game state when returning to home
        if (gameEngine && typeof gameEngine.cleanup === 'function') {
            gameEngine.cleanup();
        }
        if (canvasRenderer && typeof canvasRenderer.cleanup === 'function') {
            canvasRenderer.cleanup();
        }
        // Reset file input display if needed
        if(this.elements.fileName) this.elements.fileName.textContent = '未选择文件';
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

        console.log("Switched to Home Page");
    }

    /**
     * Shows the Game Page view and hides the Home Page view.
     */
    showGamePage() {
        if (this.elements.homePage) this.elements.homePage.style.display = 'none';
        if (this.elements.gamePage) this.elements.gamePage.style.display = 'block'; // Or your game page default display
        
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

        if (this.currentImageManifestPath) {
            // Image came from the built-in gallery
            originalImageIdentifier = this.currentImageManifestPath;
            artworkName = galleryManager.getImageByPath(this.currentImageManifestPath)?.name || 'Untitled Gallery Image';
        } else {
            // Image was uploaded by the user
            originalImageIdentifier = this.currentImage.src; // This will be a dataURL for uploaded files
            if (this.currentUploadedImageName) {
                artworkName = this.currentUploadedImageName;
            } else {
                // Fallback if currentUploadedImageName is somehow not set
                console.warn("Saving uploaded artwork, but currentUploadedImageName is not set. Using fallback name.");
                artworkName = 'Untitled Uploaded File'; 
                // Optionally, try to get from UI as a last resort, but avoid "未选择文件"
                if (this.elements.fileName.textContent && this.elements.fileName.textContent !== '未选择文件' && this.elements.fileName.textContent.trim() !== '') {
                    artworkName = this.elements.fileName.textContent;
                }
            }
        }

        try {
            Utils.showNotification('Saving artwork to My Gallery...', 'info');
            // Ensure all cells are marked as revealed in a temporary copy for export, 
            // though gameEngine should have them revealed upon completion.
            // For safety, one might deep clone and force reveal, but exportImage should use current state.

            const completedImageDataUrl = canvasRenderer.exportImage(1); // 1x scale for full image
            
            // Generate a colored thumbnail (e.g., 10x of original, similar to built-in gallery but colored)
            // For this, we need to ensure the current gameData used by exportImage reflects completion.
            // The current canvasRenderer.exportImage() exports the current game state.
            // Let's make a smaller version using a scale factor, assuming 150px target width for thumbnail.
            let thumbnailScale = 10; // Default to 10x like built-in previews
            if (dimensions.width * 10 > 200) { // If 10x is wider than 200px, scale down for thumbnail
                thumbnailScale = 200 / dimensions.width;
            }
            const thumbnailDataUrl = canvasRenderer.exportImage(thumbnailScale);

            const artworkEntry = {
                id: `${Date.now()}-${originalImageIdentifier.slice(-20).replace(/[^a-zA-Z0-9]/g, '')}`,
                originalImageIdentifier: originalImageIdentifier, // Used for deduplication
                name: artworkName,
                dimensions: { ...dimensions },
                completedImageDataUrl: completedImageDataUrl,
                thumbnailDataUrl: thumbnailDataUrl,
                completionTimestamp: Date.now(),
                playTime: gameResult.playTime,
                palette: Utils.deepClone(palette) 
            };

            let userGallery = Utils.storage.get('userCompletedGallery', []);

            // Deduplication: Check if an artwork with the same originalImageIdentifier already exists
            const existingArtworkIndex = userGallery.findIndex(
                art => art.originalImageIdentifier === artworkEntry.originalImageIdentifier
            );

            if (existingArtworkIndex > -1) {
                // Replace existing entry with the new one (latest completion)
                userGallery.splice(existingArtworkIndex, 1, artworkEntry);
                Utils.showNotification(`作品 "${artworkName}" 已在我的画廊中更新!`, 'info');
            } else {
                // Add new artwork to the beginning
                userGallery.unshift(artworkEntry);
                Utils.showNotification(`作品 "${artworkName}" 已保存到我的画廊!`, 'success');
            }
            
            Utils.storage.set('userCompletedGallery', userGallery);

        } catch (error) {
            console.error('Error saving completed artwork:', error);
            Utils.showNotification('保存作品失败', 'error');
        }
    }

    /**
     * Renders the user's completed works gallery from localStorage.
     */
    renderUserGallery() {
        if (!this.elements.userGalleryContainer) return;
        this.elements.userGalleryContainer.innerHTML = '<h2>🌟 我的画廊</h2>'; // Reset header

        const userGallery = Utils.storage.get('userCompletedGallery', []);

        if (userGallery.length === 0) {
            this.elements.userGalleryContainer.innerHTML += '<p class="gallery-placeholder">您还没有完成任何作品。加油！</p>';
            return;
        }

        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'gallery-images-container'; // Reuse existing class for layout

        userGallery.forEach(artworkEntry => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item user-gallery-item'; // Add specific class if needed
            galleryItem.title = `${artworkEntry.name} (完成于: ${new Date(artworkEntry.completionTimestamp).toLocaleDateString()})`;
            // galleryItem.dataset.artworkId = artworkEntry.id; // For future interactions like delete

            const imgDisplay = document.createElement('img');
            imgDisplay.src = artworkEntry.thumbnailDataUrl; // Use the saved colored thumbnail
            // DO NOT add gallery-thumbnail-grayscale here
            imgDisplay.alt = artworkEntry.name;
            
            const nameLabel = document.createElement('span');
            nameLabel.textContent = artworkEntry.name;
            
            galleryItem.appendChild(imgDisplay);
            galleryItem.appendChild(nameLabel);
            
            galleryItem.addEventListener('click', () => this.handleUserGalleryItemClick(artworkEntry));
            imagesContainer.appendChild(galleryItem);
        });
        this.elements.userGalleryContainer.appendChild(imagesContainer);
    }

    /**
     * Handles clicking on an item in the user's completed gallery.
     * @param {object} artworkEntry - The artwork data from localStorage.
     */
    handleUserGalleryItemClick(artworkEntry) {
        // TODO: Implement actual sharing options modal or functionality
        Utils.showNotification(`选择了作品: "${artworkEntry.name}".`, 'info');
        this.showShareOptions(artworkEntry); // Ensure share options are shown
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
        // Reset UI elements
        if(this.elements.legendContainer) this.elements.legendContainer.innerHTML = '<p class="legend-placeholder">生成游戏后显示颜色对应关系</p>';
        if(this.elements.progressFill) this.elements.progressFill.style.width = '0%';
        if(this.elements.progressText) this.elements.progressText.textContent = '0%';
        if(this.elements.totalAreas) this.elements.totalAreas.textContent = '0';
        if(this.elements.completedAreas) this.elements.completedAreas.textContent = '0';
        if(this.elements.remainingAreas) this.elements.remainingAreas.textContent = '0';
        if(this.elements.gameTime) this.elements.gameTime.textContent = '00:00';

        // Reset canvas and its state
        if (canvasRenderer) {
            canvasRenderer.clearAndReset();
        }
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    const app = new ColorByNumbersApp();
    
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