class GalleryManager {
    constructor(manifestPath = 'image_manifest.json') {
        this.manifestPath = manifestPath;
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
            const manifest = await response.json();
            await this._processManifest(manifest);
            this.initialized = true;
            console.log('GalleryManager initialized successfully.');
            Utils.showNotification('Gallery loaded successfully!', 'success');
        } catch (error) {
            console.error('Error initializing GalleryManager:', error);
            Utils.showNotification(`Gallery loading failed: ${error.message}`, 'error');
            // Potentially re-throw or handle more gracefully depending on app requirements
        }
    }

    /**
     * Processes the manifest data and populates internal image lists.
     * It also fetches image dimensions for size-based categorization.
     * @param {object} manifest - The parsed JSON manifest.
     * @private
     */
    async _processManifest(manifest) {
        if (!manifest || !manifest.categories) {
            console.warn('Manifest is empty or has invalid format.');
            return;
        }

        for (const category of manifest.categories) {
            this.categories[category.name] = [];
            if (category.images && Array.isArray(category.images)) {
                for (const imageInfo of category.images) {
                    try {
                        // Load image to get dimensions
                        const imgElement = await imageProcessor.loadImageFromUrl(imageInfo.path);
                        const dimensions = { width: imgElement.naturalWidth, height: imgElement.naturalHeight };
                        
                        const fullImageInfo = {
                            ...imageInfo,
                            folderCategory: category.name,
                            dimensions: dimensions,
                            sizeCategory: this._getSizeCategory(dimensions)
                        };

                        this.allImages.push(fullImageInfo);
                        this.categories[category.name].push(fullImageInfo);
                        this.sizeCategories[fullImageInfo.sizeCategory].push(fullImageInfo);

                    } catch (error) {
                        console.error(`Error loading image ${imageInfo.path} for dimension checking:`, error);
                        // Decide if you want to skip this image or add it without dimension info
                    }
                }
            }
        }
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
            return this.categories[folderCategoryName] || [];
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