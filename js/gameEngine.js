/**
 * 游戏引擎模块
 * 负责游戏逻辑、状态管理和进度追踪
 */

class GameEngine {
    constructor() {
        this.gameData = null;
        this.gameState = {
            isPlaying: false,
            isPaused: false,
            isCompleted: false,
            startTime: null,
            endTime: null,
            totalCells: 0,
            completedCells: 0,
            currentHint: null
        };
        
        this.timer = null;
        this.callbacks = {
            onProgress: null,
            onComplete: null,
            onCellFilled: null,
            onTimeUpdate: null
        };
        
        this.settings = {
            autoSave: true,
            saveInterval: 30000, // 30秒自动保存
            hintCooldown: 5000   // 提示冷却时间
        };
        
        this.lastHintTime = 0;
        this.autoSaveTimer = null;
    }

    /**
     * 初始化游戏
     * @param {object} gameData - 游戏数据
     */
    initGame(gameData) {
        this.gameData = Utils.deepClone(gameData);
        this.resetGameState();
        this.calculateTotalCells();
        
        // Initialize colorStats properly
        this.gameState.colorStats = []; // Ensure it's always an array
        if (this.gameData && this.gameData.palette && Array.isArray(this.gameData.palette)) {
            this.gameState.colorStats = this.gameData.palette.map(p => ({
                number: p.number,
                totalCells: (this.gameData.gameGrid ? this.gameData.gameGrid.flat().filter(c => c && !c.isTransparent && c.number === p.number).length : 0),
                completedCells: 0, // Initial state, will be updated by loadProgress or setGameAsCompleted
                completionRate: 0  // Initial state, will be updated by loadProgress or setGameAsCompleted
            }));
        }
        
        // Attempt to load saved progress
        this.loadProgress(); // This might update completedCells and completionRates in gameState and colorStats
        
        // Start auto-save
        if (this.settings.autoSave) {
            this.startAutoSave();
        }
        
        Utils.showNotification('Game initialization completed!', 'success');
    }

    /**
     * 重置游戏状态
     */
    resetGameState() {
        this.gameState = {
            isPlaying: false,
            isPaused: false,
            isCompleted: false,
            startTime: null,
            endTime: null,
            totalCells: 0,
            completedCells: 0,
            currentHint: null
        };
        
        this.stopTimer();
        this.clearAutoSave();
    }

    /**
     * 计算总单元格数量
     */
    calculateTotalCells() {
        if (!this.gameData) return;
        
        let total = 0;
        const { gameGrid } = this.gameData;
        
        for (let row = 0; row < gameGrid.length; row++) {
            for (let col = 0; col < gameGrid[row].length; col++) {
                const cell = gameGrid[row][col];
                // 只计算非透明的单元格，因为只有这些需要填色
                if (cell && !cell.isTransparent) {
                    total++;
                }
            }
        }
        
        this.gameState.totalCells = total;
        console.log(`[GameEngine Debug] Total fillable cells calculated: ${total}`);
    }

    /**
     * 开始游戏
     */
    startGame() {
        if (!this.gameData) {
            Utils.showNotification('Please generate a game first!', 'warning');
            return;
        }
        
        this.gameState.isPlaying = true;
        this.gameState.isPaused = false;
        
        if (!this.gameState.startTime) {
            this.gameState.startTime = Date.now();
        }
        
        this.startTimer();
        this.updateProgress();
        
        Utils.showNotification('Game started!', 'info');
    }

    /**
     * 暂停游戏
     */
    pauseGame() {
        this.gameState.isPaused = true;
        this.stopTimer();
        Utils.showNotification('Game paused', 'info');
    }

    /**
     * 恢复游戏
     */
    resumeGame() {
        this.gameState.isPaused = false;
        this.startTimer();
        Utils.showNotification('Game resumed', 'info');
    }

    /**
     * 重新开始游戏
     */
    restartGame() {
        if (!this.gameData) return;

        this.gameState = {
            isPlaying: true,
            isPaused: false,
            isCompleted: false,
            startTime: Date.now(),
            elapsedTime: 0,
            pauseTime: 0,
            completedCells: 0,
            totalCells: this.gameData.gameGrid.flat().filter(cell => cell && !cell.isTransparent).length,
            colorStats: this.gameData.palette.map(p => ({
                number: p.number,
                totalCells: this.gameData.gameGrid.flat().filter(c => c && !c.isTransparent && c.number === p.number).length,
                completedCells: 0,
                completionRate: 0
            }))
        };

        // Reset all cells to not revealed (unless transparent)
        this.gameData.gameGrid.forEach(row => {
            row.forEach(cell => {
                if (cell && !cell.isTransparent) {
                    cell.revealed = false;
                }
            });
        });

        this.startTimer();
        this.emit('progress', this.getGameStats());
        console.log('Game restarted');
    }

    /**
     * Sets the current game as completed, usually when loading a pre-completed artwork.
     * @param {number} playTime - The time taken to complete the game (in seconds).
     * @param {boolean} emitCompleteEvent - Whether to emit the complete event (default: true).
     */
    setGameAsCompleted(playTime = 0, emitCompleteEvent = true) {
        if (!this.gameData || !this.gameState) {
            console.warn("Cannot set game as completed: game data or state missing.");
            return;
        }

        this.gameState.isPlaying = false;
        this.gameState.isPaused = false;
        this.gameState.isCompleted = true;
        this.gameState.elapsedTime = playTime * 1000; // Convert seconds to ms
        this.stopTimer();

        // Mark all non-transparent cells as completed for stats
        this.gameState.completedCells = this.gameState.totalCells;
        this.gameState.colorStats.forEach(stat => {
            stat.completedCells = stat.totalCells;
            stat.completionRate = 100;
        });

        // Mark all grid cells as revealed (already done in main.js but good to ensure here too)
        this.gameData.gameGrid.forEach(row => {
            row.forEach(cell => {
                if (cell && !cell.isTransparent) {
                    cell.revealed = true;
                }
            });
        });
        
        this.emit('progress', this.getGameStats()); // Update UI with 100% progress
        
        // Only emit complete event if requested (e.g., when actually completing a game, not when viewing completed artwork)
        if (emitCompleteEvent) {
            this.emit('complete', {
                playTime: playTime,
                totalCells: this.gameState.totalCells,
                // ... other result details if needed ...
            });
        }
        
        console.log('Game set as completed.');
    }

    /**
     * 填充单元格
     * @param {object} cell - 要填充的单元格
     * @returns {boolean} 是否成功填充
     */
    fillCell(cell) {
        if (!cell || cell.revealed || !this.gameState.isPlaying || this.gameState.isPaused) {
            return false;
        }
        
        cell.revealed = true;
        this.gameState.completedCells++;
        
        // 触发回调
        if (this.callbacks.onCellFilled) {
            this.callbacks.onCellFilled(cell);
        }
        
        this.updateProgress();
        
        // 检查是否完成
        if (this.isGameCompleted()) {
            this.completeGame();
        }
        
        return true;
    }

    /**
     * 检查游戏是否完成
     * @returns {boolean} 是否完成
     */
    isGameCompleted() {
        return this.gameState.completedCells >= this.gameState.totalCells;
    }

    /**
     * 完成游戏
     */
    completeGame() {
        this.gameState.isCompleted = true;
        this.gameState.isPlaying = false;
        this.gameState.endTime = Date.now();
        
        this.stopTimer();
        this.clearAutoSave();
        
        const playTime = this.getPlayTime();
        const completionRate = 100;
        
        // 触发完成回调
        if (this.callbacks.onComplete) {
            this.callbacks.onComplete({
                playTime,
                completionRate,
                totalCells: this.gameState.totalCells
            });
        }
        
        // 清除保存的进度
        this.clearSavedProgress();
        
        Utils.showNotification('🎉 Congratulations on completing the game!', 'success', 5000);
    }

    /**
     * 获取提示
     * @returns {object|null} 提示信息
     */
    getHint() {
        const now = Date.now();
        if (now - this.lastHintTime < this.settings.hintCooldown) {
            const remaining = Math.ceil((this.settings.hintCooldown - (now - this.lastHintTime)) / 1000);
            Utils.showNotification(`Hint cooling down, please wait ${remaining} seconds`, 'warning');
            return null;
        }
        
        if (!this.gameData || this.gameState.isCompleted) {
            return null;
        }
        
        // 找到未填充的单元格
        const unfilledCells = [];
        const { gameGrid } = this.gameData;
        
        for (let row = 0; row < gameGrid.length; row++) {
            for (let col = 0; col < gameGrid[row].length; col++) {
                const cell = gameGrid[row][col];
                if (cell && !cell.revealed) {
                    unfilledCells.push(cell);
                }
            }
        }
        
        if (unfilledCells.length === 0) {
            return null;
        }
        
        // 随机选择一个单元格作为提示
        const hintCell = unfilledCells[Math.floor(Math.random() * unfilledCells.length)];
        this.gameState.currentHint = hintCell;
        this.lastHintTime = now;
        
        Utils.showNotification(`Hint: Look for number ${hintCell.number}`, 'info');
        
        return hintCell;
    }

    /**
     * 清除当前提示
     */
    clearHint() {
        this.gameState.currentHint = null;
    }

    /**
     * 自动填充指定数字的所有单元格
     * @param {number} number - 要填充的数字
     * @returns {number} 填充的单元格数量
     */
    autoFillNumber(number) {
        if (!this.gameData || this.gameState.isCompleted) {
            return 0;
        }
        
        let filledCount = 0;
        const { gameGrid } = this.gameData;
        
        for (let row = 0; row < gameGrid.length; row++) {
            for (let col = 0; col < gameGrid[row].length; col++) {
                const cell = gameGrid[row][col];
                if (cell && !cell.revealed && cell.number === number) {
                    if (this.fillCell(cell)) {
                        filledCount++;
                    }
                }
            }
        }
        
        if (filledCount > 0) {
            Utils.showNotification(`Auto-filled ${filledCount} areas with number ${number}`, 'success');
        }
        
        return filledCount;
    }

    /**
     * 获取游戏统计信息
     * @returns {object} 统计信息
     */
    getGameStats() {
        const completionRate = this.gameState.totalCells > 0 
            ? Math.round((this.gameState.completedCells / this.gameState.totalCells) * 100)
            : 0;
        
        return {
            totalCells: this.gameState.totalCells,
            completedCells: this.gameState.completedCells,
            remainingCells: this.gameState.totalCells - this.gameState.completedCells,
            completionRate: completionRate,
            playTime: this.getPlayTime(),
            isCompleted: this.gameState.isCompleted
        };
    }

    /**
     * 获取游戏时间
     * @returns {number} 游戏时间（秒）
     */
    getPlayTime() {
        if (!this.gameState.startTime) return 0;
        
        const endTime = this.gameState.endTime || Date.now();
        return Math.floor((endTime - this.gameState.startTime) / 1000);
    }

    /**
     * 更新进度
     */
    updateProgress() {
        const stats = this.getGameStats();
        
        if (this.callbacks.onProgress) {
            this.callbacks.onProgress(stats);
        }
    }

    /**
     * 开始计时器
     */
    startTimer() {
        this.stopTimer();
        this.timer = setInterval(() => {
            if (this.callbacks.onTimeUpdate) {
                this.callbacks.onTimeUpdate(this.getPlayTime());
            }
        }, 1000);
    }

    /**
     * 停止计时器
     */
    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * 保存游戏进度
     */
    saveProgress() {
        if (!this.gameData) return;
        
        const saveData = {
            gameData: this.gameData,
            gameState: this.gameState,
            timestamp: Date.now()
        };
        
        Utils.storage.set('colorByNumbers_progress', saveData);
        Utils.showNotification('Progress saved', 'success');
    }

    /**
     * 加载游戏进度
     */
    loadProgress() {
        const saveData = Utils.storage.get('colorByNumbers_progress');
        
        if (saveData && saveData.gameData && saveData.gameState) {
            // 检查保存时间（超过24小时的存档可能过期）
            const hoursSinceLastSave = (Date.now() - saveData.timestamp) / (1000 * 60 * 60);
            
            if (hoursSinceLastSave < 24) {
                this.gameData = saveData.gameData;
                this.gameState = { ...this.gameState, ...saveData.gameState };
                
                // 重新计算完成的单元格数量
                this.recalculateProgress();
                
                Utils.showNotification('Saved progress loaded', 'info');
                return true;
            } else {
                // 清除过期的存档
                this.clearSavedProgress();
            }
        }
        
        return false;
    }

    /**
     * 重新计算进度
     */
    recalculateProgress() {
        if (!this.gameData) return;
        
        let completed = 0;
        const { gameGrid } = this.gameData;
        
        for (let row = 0; row < gameGrid.length; row++) {
            for (let col = 0; col < gameGrid[row].length; col++) {
                const cell = gameGrid[row][col];
                // 只计算非透明且已填充的单元格
                if (cell && !cell.isTransparent && cell.revealed) {
                    completed++;
                }
            }
        }
        
        this.gameState.completedCells = completed;
        console.log(`[GameEngine Debug] Recalculated progress: ${completed} completed cells`);
    }

    /**
     * 清除保存的进度
     */
    clearSavedProgress() {
        Utils.storage.remove('colorByNumbers_progress');
    }

    /**
     * 开始自动保存
     */
    startAutoSave() {
        this.clearAutoSave();
        this.autoSaveTimer = setInterval(() => {
            if (this.gameState.isPlaying && !this.gameState.isCompleted) {
                this.saveProgress();
            }
        }, this.settings.saveInterval);
    }

    /**
     * 清除自动保存
     */
    clearAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Emits an event by calling the registered callback.
     * @param {string} event - The name of the event to emit.
     * @param {any} data - The data to pass to the event callback.
     */
    emit(event, data) {
        const callbackName = `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
        if (this.callbacks[callbackName] && typeof this.callbacks[callbackName] === 'function') {
            this.callbacks[callbackName](data);
        } else {
            // console.warn(`No callback registered for event: ${event} or callback is not a function.`);
        }
    }

    /**
     * 设置回调函数
     * @param {string} event - 事件名称
     * @param {function} callback - 回调函数
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty(`on${event.charAt(0).toUpperCase()}${event.slice(1)}`)) {
            this.callbacks[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`] = callback;
        }
    }

    /**
     * 获取颜色统计信息
     * @returns {Array} 颜色统计数组
     */
    getColorStats() {
        if (!this.gameData) return [];
        
        const { palette, gameGrid } = this.gameData;
        const colorStats = palette.map(paletteItem => ({
            ...paletteItem,
            totalCells: 0,
            completedCells: 0,
            completionRate: 0
        }));
        
        // 统计每种颜色的单元格数量
        for (let row = 0; row < gameGrid.length; row++) {
            for (let col = 0; col < gameGrid[row].length; col++) {
                const cell = gameGrid[row][col];
                // 只统计非透明单元格
                if (cell && !cell.isTransparent) {
                    const colorStat = colorStats.find(stat => stat.number === cell.number);
                    if (colorStat) {
                        colorStat.totalCells++;
                        if (cell.revealed) {
                            colorStat.completedCells++;
                        }
                    }
                }
            }
        }
        
        // 计算完成率
        colorStats.forEach(stat => {
            stat.completionRate = stat.totalCells > 0 
                ? Math.round((stat.completedCells / stat.totalCells) * 100)
                : 0;
        });
        
        return colorStats.sort((a, b) => b.completionRate - a.completionRate);
    }

    /**
     * 导出游戏数据
     * @returns {object} 导出的数据
     */
    exportGameData() {
        return {
            gameData: this.gameData,
            gameState: this.gameState,
            stats: this.getGameStats(),
            colorStats: this.getColorStats(),
            exportTime: Date.now()
        };
    }

    /**
     * 获取当前游戏数据
     * @returns {object} 当前游戏数据
     */
    getGameData() {
        return this.gameData;
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.stopTimer();
        this.clearAutoSave();
        this.gameData = null;
        this.resetGameState();
    }
}

// 创建全局实例
const gameEngine = new GameEngine(); 