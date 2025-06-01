/**
 * 主应用逻辑
 * 整合所有模块并处理用户交互
 */

class ColorByNumbersApp {
    constructor() {
        this.currentImage = null;
        this.isProcessing = false;
        
        this.initializeElements();
        this.initializeCanvas();
        this.setupEventListeners();
        this.setupGameEngine();
        
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
            closeModalBtn: document.getElementById('closeModalBtn')
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
    }

    /**
     * 设置游戏引擎回调
     */
    setupGameEngine() {
        gameEngine.on('progress', (stats) => {
            this.updateGameInfo(stats);
        });

        gameEngine.on('complete', (result) => {
            this.showSuccessModal(result);
        });

        gameEngine.on('cellFilled', (cell) => {
            this.updateLegend();
        });

        gameEngine.on('timeUpdate', (seconds) => {
            this.elements.gameTime.textContent = Utils.formatTime(seconds);
        });
    }

    /**
     * 处理文件上传
     * @param {File} file - 上传的文件
     */
    async handleFileUpload(file) {
        if (!file) return;

        const validation = imageProcessor.validateImageFile(file);
        if (!validation.valid) {
            Utils.showNotification(validation.errors.join(', '), 'error');
            return;
        }

        this.elements.fileName.textContent = file.name;

        try {
            this.currentImage = await imageProcessor.loadImageFromFile(file);
            Utils.showNotification('图片加载成功！正在生成游戏...', 'success');
            
            // 自动生成游戏
            await this.generateGame();
        } catch (error) {
            Utils.showNotification(error.message, 'error');
        }
    }

    /**
     * 生成游戏
     */
    async generateGame() {
        if (!this.currentImage || this.isProcessing) return;

        this.isProcessing = true;
        this.showLoading('正在处理图片，生成像素级填色游戏...');

        try {
            // 使用默认参数：16色，像素级精确处理
            const options = {
                colorCount: 16,        // 固定16色
                gridSize: 'pixel',     // 固定像素级精确
                algorithm: 'kmeans'
            };

            const gameData = await imageProcessor.processImage(this.currentImage, options);
            
            // 显示图片信息
            const imageInfo = imageProcessor.getImageInfo(this.currentImage);
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

        } catch (error) {
            Utils.showNotification(`游戏生成失败: ${error.message}`, 'error');
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
    showShareOptions() {
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
                                📥 下载高清版 (1000%)
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
                this.handleShareAction(action);
                shareModal.remove();
            }
        });
        
        document.body.appendChild(shareModal);
    }

    /**
     * 处理分享操作
     * @param {string} action - 分享操作类型
     */
    async handleShareAction(action) {
        try {
            switch (action) {
                case 'download-normal':
                    await this.downloadImage(1, '原尺寸');
                    break;
                    
                case 'download-hd':
                    await this.downloadImage(10, '高清版');
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
                    await this.copyImageToClipboard();
                    break;
                    
                case 'print':
                    this.printImage();
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
     * @param {number} scale - 缩放倍数
     * @param {string} sizeName - 尺寸名称
     */
    async downloadImage(scale, sizeName) {
        Utils.showNotification(`正在生成${sizeName}图片...`, 'info');
        
        try {
            const imageData = canvasRenderer.exportImage(scale);
            const fileName = `color-by-numbers-${sizeName}-${Date.now()}.png`;
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
     */
    async copyImageToClipboard() {
        try {
            const imageData = canvasRenderer.exportImage(2); // 2倍清晰度适合剪贴板
            
            // 将Data URL转换为Blob
            const response = await fetch(imageData);
            const blob = await response.blob();
            
            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
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
     */
    printImage() {
        try {
            const imageData = canvasRenderer.exportImage(5); // 5倍清晰度适合打印
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>像素填色作品</title>
                        <style>
                            body { margin: 0; padding: 20px; text-align: center; }
                            img { max-width: 100%; height: auto; }
                            h1 { font-family: Arial, sans-serif; color: #333; }
                        </style>
                    </head>
                    <body>
                        <h1>像素填色作品</h1>
                        <img src="${imageData}" alt="Color by Numbers Artwork">
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
        this.resetGame();
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
    });
}); 