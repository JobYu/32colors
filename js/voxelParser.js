/**
 * Voxel Parser Module
 * Parses .vox files (MagicaVoxel format) and converts to game data
 */

class VoxelParser {
    constructor() {
        this.defaultPalette = this._createDefaultPalette();
    }

    /**
     * Parse a .vox file and extract voxel data
     * @param {ArrayBuffer} buffer - The .vox file buffer
     * @returns {Object} Parsed voxel data
     */
    parseVoxFile(buffer) {
        const view = new DataView(buffer);
        let offset = 0;

        // Check VOX header
        const header = this._readString(view, offset, 4);
        if (header !== 'VOX ') {
            throw new Error('Invalid VOX file format');
        }
        offset += 4;

        // Read version
        const version = view.getUint32(offset, true);
        offset += 4;

        // Read MAIN chunk
        const mainChunk = this._readChunk(view, offset);
        offset = mainChunk.offset;

        // Parse chunks within MAIN
        const voxelData = this._parseChunks(mainChunk.children);

        return {
            size: voxelData.size,
            voxels: voxelData.voxels,
            palette: voxelData.palette || this.defaultPalette,
            version: version
        };
    }

    /**
     * Read a chunk from the buffer
     * @param {DataView} view - DataView of the buffer
     * @param {number} offset - Current offset
     * @returns {Object} Chunk data
     */
    _readChunk(view, offset) {
        // 检查是否有足够的数据来读取chunk header
        if (offset + 12 > view.byteLength) {
            throw new Error('Not enough data to read chunk header');
        }

        const id = this._readString(view, offset, 4);
        offset += 4;

        const contentSize = view.getUint32(offset, true);
        offset += 4;

        const childrenSize = view.getUint32(offset, true);
        offset += 4;

        const contentOffset = offset;
        const childrenOffset = offset + contentSize;

        // 验证数据边界
        if (contentOffset + contentSize > view.byteLength) {
            throw new Error(`Content extends beyond buffer: ${contentOffset + contentSize} > ${view.byteLength}`);
        }

        if (childrenOffset + childrenSize > view.byteLength) {
            throw new Error(`Children extends beyond buffer: ${childrenOffset + childrenSize} > ${view.byteLength}`);
        }

        const content = new DataView(view.buffer, contentOffset, contentSize);
        const children = new DataView(view.buffer, childrenOffset, childrenSize);

        return {
            id,
            content,
            children,
            offset: childrenOffset + childrenSize
        };
    }

    /**
     * Parse chunks to extract voxel data
     * @param {DataView} childrenView - Children chunks DataView
     * @returns {Object} Parsed data
     */
    _parseChunks(childrenView) {
        let offset = 0;
        const data = {
            size: null,
            voxels: [],
            palette: null
        };

        let iterations = 0;
        const maxIterations = 1000; // 防止无限循环

        while (offset < childrenView.byteLength && iterations < maxIterations) {
            iterations++;
            
            try {
                const chunk = this._readChunk(childrenView, offset);
                
                // 调试日志
                console.log(`[VoxelParser] Found chunk: ${chunk.id}, content size: ${chunk.content.byteLength}, children size: ${chunk.children.byteLength}, next offset: ${chunk.offset}`);

                // 验证offset是否有效增长
                if (chunk.offset <= offset) {
                    console.error('Chunk offset did not advance, breaking to prevent infinite loop');
                    break;
                }
                
                offset = chunk.offset;

                switch (chunk.id) {
                    case 'SIZE':
                        data.size = this._parseSize(chunk.content);
                        break;
                    case 'XYZI':
                        const voxels = this._parseVoxels(chunk.content);
                        data.voxels.push(...voxels);
                        break;
                    case 'RGBA':
                        data.palette = this._parsePalette(chunk.content);
                        break;
                    case 'PACK':
                        // Skip pack chunk for now (multiple models)
                        break;
                    default:
                        // Skip unknown chunks
                        console.log(`Skipping unknown chunk: ${chunk.id}`);
                        break;
                }
            } catch (error) {
                console.error('Error parsing chunk:', error);
                break;
            }
        }

        if (iterations >= maxIterations) {
            console.error('Maximum iterations reached, possible infinite loop detected');
        }

        // 如果没有找到SIZE chunk，但是有XYZI，需要一个默认或计算出的size
        if (!data.size && data.voxels.length > 0) {
            console.warn('[VoxelParser] SIZE chunk not found. Calculating size from voxels.');
            let maxX = 0, maxY = 0, maxZ = 0;
            data.voxels.forEach(v => {
                if (v.x > maxX) maxX = v.x;
                if (v.y > maxY) maxY = v.y;
                if (v.z > maxZ) maxZ = v.z;
            });
            data.size = { x: maxX + 1, y: maxY + 1, z: maxZ + 1 };
            console.log(`[VoxelParser] Calculated size:`, data.size);
        }

        return data;
    }

    /**
     * Parse SIZE chunk
     * @param {DataView} content - SIZE chunk content
     * @returns {Object} Size data
     */
    _parseSize(content) {
        return {
            x: content.getUint32(0, true),
            y: content.getUint32(4, true),
            z: content.getUint32(8, true)
        };
    }

    /**
     * Parse XYZI chunk (voxel data)
     * @param {DataView} content - XYZI chunk content
     * @returns {Array} Array of voxels
     */
    _parseVoxels(content) {
        const numVoxels = content.getUint32(0, true);
        const voxels = [];
        let offset = 4;

        for (let i = 0; i < numVoxels; i++) {
            const x = content.getUint8(offset++);
            const y = content.getUint8(offset++);
            const z = content.getUint8(offset++);
            const colorIndex = content.getUint8(offset++);

            voxels.push({ x, y, z, colorIndex });
        }

        return voxels;
    }

    /**
     * Parse RGBA chunk (color palette)
     * @param {DataView} content - RGBA chunk content
     * @returns {Array} Color palette
     */
    _parsePalette(content) {
        const palette = [];
        for (let i = 0; i < 256; i++) {
            const offset = i * 4;
            const r = content.getUint8(offset);
            const g = content.getUint8(offset + 1);
            const b = content.getUint8(offset + 2);
            const a = content.getUint8(offset + 3);
            
            palette.push({
                r: r,
                g: g,
                b: b,
                a: a,
                hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
                id: i + 1 // VOX palette indices start at 1
            });
        }
        return palette;
    }

    /**
     * Convert voxel data to 3D game format
     * @param {Object} voxelData - Parsed voxel data
     * @returns {Object} 3D Game-ready voxel data
     */
    convertToGameData(voxelData) {
        const { size, voxels, palette } = voxelData;
        
        // 验证尺寸以防止浏览器崩溃
        if (!size || size.x <= 0 || size.y <= 0 || size.z <= 0) {
            throw new Error('Invalid voxel size data');
        }
        
        // 限制最大尺寸以防止内存耗尽
        const maxSize = 256; // 限制最大尺寸为256x256x256
        if (size.x > maxSize || size.y > maxSize || size.z > maxSize) {
            throw new Error(`Voxel model too large: ${size.x}x${size.y}x${size.z}. Maximum size is ${maxSize}x${maxSize}x${maxSize}`);
        }
        
        console.log(`Creating 3D grid with size: ${size.x}x${size.y}x${size.z}`);
        
        // 安全地创建3D网格
        const grid3D = [];
        for (let z = 0; z < size.z; z++) {
            grid3D[z] = [];
            for (let y = 0; y < size.y; y++) {
                grid3D[z][y] = new Array(size.x).fill(null);
            }
        }

        // Fill the 3D grid with voxel data
        voxels.forEach(voxel => {
            if (voxel.x < size.x && voxel.y < size.y && voxel.z < size.z) {
                grid3D[voxel.z][voxel.y][voxel.x] = voxel.colorIndex;
            }
        });

        // Collect used colors and create voxel cells
        const usedColors = new Set();
        const voxelCells = [];
        
        for (let z = 0; z < size.z; z++) {
            for (let y = 0; y < size.y; y++) {
                for (let x = 0; x < size.x; x++) {
                    const colorIndex = grid3D[z][y][x];
                    if (colorIndex !== null) {
                        usedColors.add(colorIndex);
                        voxelCells.push({
                            x: x,
                            y: y,
                            z: z,
                            colorIndex: colorIndex,
                            filled: false,
                            visible: true
                        });
                    }
                }
            }
        }

        // Create color palette with only used colors
        const usedPalette = palette
            .filter((color, index) => usedColors.has(index + 1))
            .map((color, idx) => ({
                ...color,
                id: idx + 1,
                originalIndex: color.id
            }));

        // Remap color indices to sequential numbers
        const colorRemap = {};
        usedPalette.forEach((color, idx) => {
            colorRemap[color.originalIndex] = idx + 1;
        });

        // Update voxel cells with remapped colors
        voxelCells.forEach(cell => {
            cell.number = colorRemap[cell.colorIndex];
            cell.targetColor = colorRemap[cell.colorIndex];
        });

        // Update palette indices
        usedPalette.forEach(color => {
            color.id = colorRemap[color.originalIndex];
        });

        return {
            dimensions: size,
            voxels: voxelCells,
            grid3D: grid3D,
            palette: usedPalette,
            metadata: {
                originalSize: size,
                voxelCount: voxels.length,
                type: 'voxel3D',
                totalVoxels: voxelCells.length
            }
        };
    }

    /**
     * Read string from DataView
     * @param {DataView} view - DataView
     * @param {number} offset - Offset
     * @param {number} length - String length
     * @returns {string} Read string
     */
    _readString(view, offset, length) {
        const chars = [];
        for (let i = 0; i < length; i++) {
            chars.push(String.fromCharCode(view.getUint8(offset + i)));
        }
        return chars.join('');
    }

    /**
     * Create default MagicaVoxel palette
     * @returns {Array} Default palette
     */
    _createDefaultPalette() {
        const defaultColors = [
            0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff,
            0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff,
            // ... (all 256 default colors)
        ];

        return defaultColors.map((color, index) => {
            const r = (color >>> 24) & 0xFF;
            const g = (color >>> 16) & 0xFF;
            const b = (color >>> 8) & 0xFF;
            const a = color & 0xFF;
            
            return {
                r: r,
                g: g,
                b: b,
                a: a,
                hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
                id: index + 1
            };
        });
    }

    /**
     * Load and parse a .vox file from URL
     * @param {string} url - URL to the .vox file
     * @returns {Promise<Object>} Parsed voxel data
     */
    async loadFromUrl(url) {
        try {
            console.log(`Loading VOX file from: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            console.log(`VOX file loaded, size: ${arrayBuffer.byteLength} bytes`);
            
            if (arrayBuffer.byteLength === 0) {
                throw new Error('VOX file is empty');
            }
            
            return this.parseVoxFile(arrayBuffer);
        } catch (error) {
            console.error('Error loading VOX file:', error);
            throw new Error(`Failed to load VOX file: ${error.message}`);
        }
    }

    /**
     * Load and parse a .vox file from File object
     * @param {File} file - File object
     * @returns {Promise<Object>} Parsed voxel data
     */
    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const voxelData = this.parseVoxFile(e.target.result);
                    resolve(voxelData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('File reading failed'));
            reader.readAsArrayBuffer(file);
        });
    }
}