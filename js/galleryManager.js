class GalleryManager {
    constructor(manifestPath = 'image_manifest.json') {
        this.manifestPath = manifestPath;
        this.manifest = null; // Store the loaded manifest
        this.allImages = []; // Will store all images with their details
        this.categories = {}; // Stores images grouped by folder category
        this.sizeCategories = { // Predefined size categories
            '16x16': [],
            '24x24': [],
            '32x32': [],
            '48x48': [],
            '64x64': [],
            'oversized': [] // For images larger than 64x64
        };
        this.initialized = false;
        this.onImageLoaded = null; // Callback function for when an image is loaded
        this.onCategoryComplete = null; // Callback function for when a category is complete
        this.loadingStats = {
            totalImages: 0,
            loadedImages: 0,
            failedImages: 0
        };
        this.initialLoadLimit = 4; // Load 4 images per category initially
    }

    /**
     * Fetches the image manifest and processes the image data.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;

        try {
            const response = await fetch(this.manifestPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch image manifest: ${response.statusText}`);
            }
            this.manifest = await response.json();
            
            // Mark as initialized immediately after manifest is loaded
            this.initialized = true;
            console.log('GalleryManager manifest loaded successfully.');
            
            // Don't process automatically, wait for explicit call
            this._prepareManifest();

        } catch (error) {
            console.error('Error initializing GalleryManager:', error);
            Utils.showNotification(`Gallery loading failed: ${error.message}`, 'error');
            // Potentially re-throw or handle more gracefully depending on app requirements
        }
    }

    /**
     * Prepares the manifest data but doesn't load images yet.
     * @private
     */
    _prepareManifest() {
        if (!this.manifest || !this.manifest.categories) {
            console.warn('Manifest is empty or has invalid format.');
            return;
        }

        // Count total images for progress tracking
        this.loadingStats.totalImages = 0;
        for (const category of this.manifest.categories) {
            this.categories[category.name] = {
                images: category.images,
                loadedCount: 0
            };
            if (category.images && Array.isArray(category.images)) {
                this.loadingStats.totalImages += category.images.length;
            }
        }
        console.log(`Manifest prepared. Total images to load: ${this.loadingStats.totalImages}`);
    }

    /**
     * Loads the initial set of images for each category.
     */
    async loadInitialSet() {
        console.log('Loading initial set of images...');
        for (const categoryName in this.categories) {
            await this._processCategoryProgressively(categoryName, this.initialLoadLimit);
        }
        console.log('Initial set loading process finished.');
    }

    /**
     * Loads all remaining images for all categories.
     */
    async loadRemainingImages() {
        console.log('Loading all remaining images...');
        for (const categoryName in this.categories) {
            // No limit, so it will load all remaining images.
            await this._processCategoryProgressively(categoryName); 
        }
        console.log('Remaining images loading process finished.');
    }

    /**
     * Checks if there are more images to load.
     * @returns {boolean}
     */
    hasMoreImagesToLoad() {
        return this.loadingStats.loadedImages < this.loadingStats.totalImages;
    }

    /**
     * Processes a single category progressively up to a given limit.
     * @param {string} categoryName - The name of the category to process.
     * @param {number|null} limit - The number of images to load. If null, loads all remaining.
     * @private
     */
    async _processCategoryProgressively(categoryName, limit = null) {
        const category = this.categories[categoryName];
        if (!category) return;
        
        const imagesToProcess = category.images;
        const startIndex = category.loadedCount;

        // Determine how many images to load in this batch
        const endIndex = limit ? Math.min(startIndex + limit, imagesToProcess.length) : imagesToProcess.length;

        if (startIndex >= endIndex) {
            // Nothing to load in this category
            return;
        }

        const categoryImagesLoaded = [];

        for (let i = startIndex; i < endIndex; i++) {
            const imageInfo = imagesToProcess[i];
            try {
                // Load image to get dimensions
                const imgElement = await imageProcessor.loadImageFromUrl(imageInfo.path);
                const dimensions = { width: imgElement.naturalWidth, height: imgElement.naturalHeight };
                
                const fullImageInfo = {
                    ...imageInfo,
                    folderCategory: categoryName,
                    dimensions: dimensions,
                    sizeCategory: this._getSizeCategory(dimensions)
                };

                // Add to all collections
                this.allImages.push(fullImageInfo);
                // This part needs adjustment if we are to filter by category later
                if (!this.sizeCategories[fullImageInfo.sizeCategory]) {
                    this.sizeCategories[fullImageInfo.sizeCategory] = [];
                }
                this.sizeCategories[fullImageInfo.sizeCategory].push(fullImageInfo);
                categoryImagesLoaded.push(fullImageInfo);

                // Update loading stats
                this.loadingStats.loadedImages++;
                category.loadedCount++;

                // Notify callback that an image was loaded
                if (this.onImageLoaded) {
                    this.onImageLoaded(fullImageInfo, categoryName, this.loadingStats);
                }

            } catch (error) {
                console.error(`Error loading image ${imageInfo.path} for dimension checking:`, error);
                this.loadingStats.failedImages++;
                // Continue with next image even if this one fails
            }
        }

        // Notify that this BATCH of images for the category is complete
        if (this.onCategoryComplete && categoryImagesLoaded.length > 0) {
            this.onCategoryComplete(categoryName, categoryImagesLoaded, this.loadingStats);
        }
    }

    /**
     * Sets callback function for when an image is loaded.
     * @param {Function} callback - Function(imageInfo, categoryName, loadingStats)
     */
    setOnImageLoadedCallback(callback) {
        this.onImageLoaded = callback;
    }

    /**
     * Sets callback function for when a category is complete.
     * @param {Function} callback - Function(categoryName, images, loadingStats)
     */
    setOnCategoryCompleteCallback(callback) {
        this.onCategoryComplete = callback;
    }

    /**
     * Gets current loading statistics.
     * @returns {object} Loading stats
     */
    getLoadingStats() {
        return { ...this.loadingStats };
    }

    /**
     * Determines the size category for an image based on its dimensions.
     * @param {object} dimensions - { width, height }
     * @returns {string} The size category key.
     * @private
     */
    _getSizeCategory(dimensions) {
        const { width, height } = dimensions;
        if (width === 16 && height === 16) return '16x16';
        if (width === 24 && height === 24) return '24x24';
        if (width === 32 && height === 32) return '32x32';
        if (width === 48 && height === 48) return '48x48';
        if (width === 64 && height === 64) return '64x64';
        if (width > 64 || height > 64) return 'oversized';
        // Fallback for non-standard sizes, could be a different category or 'oversized'
        return 'oversized'; 
    }

    /**
     * Gets all images, optionally filtered by folder category.
     * @param {string} [folderCategoryName] - Optional folder category name.
     * @returns {Array<object>}
     */
    getImagesByFolderCategory(folderCategoryName) {
        if (!this.initialized) {
            console.warn('GalleryManager not initialized. Call init() first.');
            return [];
        }
        if (folderCategoryName) {
            // Return only the loaded images for that category
            return this.allImages.filter(img => img.folderCategory === folderCategoryName);
        }
        return this.allImages;
    }

    /**
     * Gets all images, optionally filtered by size category.
     * @param {string} [sizeCategoryName] - Optional size category name (e.g., '16x16', 'oversized').
     * @returns {Array<object>}
     */
    getImagesBySizeCategory(sizeCategoryName) {
        if (!this.initialized) {
            console.warn('GalleryManager not initialized. Call init() first.');
            return [];
        }
        if (sizeCategoryName) {
            return this.sizeCategories[sizeCategoryName] || [];
        }
        // If no specific size category, maybe return all images or images grouped by size
        return this.allImages; // Or implement a getter for all sizeCategories
    }
    
    /**
     * Returns all folder category names.
     * @returns {Array<string>}
     */
    getFolderCategoryNames() {
        if (!this.initialized) return [];
        return Object.keys(this.categories);
    }

    /**
     * Returns all size category names.
     * @returns {Array<string>}
     */
    getSizeCategoryNames() {
        if (!this.initialized) return [];
        return Object.keys(this.sizeCategories);
    }


    /**
     * Gets a specific image by its path.
     * @param {string} imagePath
     * @returns {object | undefined} The image info or undefined if not found.
     */
    getImageByPath(imagePath) {
        if (!this.initialized) {
            console.warn('GalleryManager not initialized. Call init() first.');
            return undefined;
        }
        return this.allImages.find(img => img.path === imagePath);
    }


}

// Create a global instance (or manage it within your main app class)
const galleryManager = new GalleryManager(); 