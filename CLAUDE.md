# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a pixel-level digital coloring game where users upload images that are automatically converted into clickable pixel coloring grids. Each pixel becomes a numbered coloring area with a corresponding color legend.

## Architecture

### Core Modules

- **main.js**: Main application orchestrator (`ColorByNumbersApp` class) - handles UI, file uploads, gallery management, and coordinates between modules
- **gameEngine.js**: Game logic and state management (`GameEngine` class) - tracks progress, saves/loads games, handles completion
- **imageProcessor.js**: Image loading and processing (`ImageProcessor` class) - converts images to game grids, handles color quantization
- **canvasRenderer.js**: Canvas rendering and interaction - handles zoom, pan, click detection, and visual rendering
- **colorQuantizer.js**: Color palette generation algorithms (K-means, median cut)
- **galleryManager.js**: Built-in image gallery management with progressive loading
- **utils.js**: Helper functions and storage utilities

### Key Data Flow

1. User uploads image → `imageProcessor.processImage()` → generates `gameData` object with palette and grid
2. `gameEngine.initGame(gameData)` → initializes game state and starts timer
3. `canvasRenderer.setGameData()` → renders interactive grid with zoom/pan
4. User clicks cells → `gameEngine.fillCell()` → updates progress and re-renders
5. Completion → saves to `userGallery` in localStorage

### Storage Structure

- **userGallery** (localStorage): Array of completed/uploaded artworks
  - `type: 'uploaded'` - User uploaded images
  - `type: 'builtin-completed'` - Completed built-in gallery images
  - Stores thumbnails, completion data, and original images as dataURLs

## Development Commands

### Frontend (Pure HTML/CSS/JS)
```bash
# Serve locally (any method)
python -m http.server 8000
npx http-server
# Or open index.html directly in browser
```

### Backend Server (Optional CORS proxy)
```bash
cd server
npm install
npm start      # Runs on http://localhost:3000
npm run dev    # Development with nodemon
```

### Testing
- Open browser console and use `window.app.testGridExport()` to test grid export
- Check browser dev tools → Application → Local Storage for debugging user gallery

## Key Implementation Details

### Image Processing Pipeline
1. **Validation**: Max 300×300px, 128 colors, PNG/JPG only
2. **Color Quantization**: Uses K-means clustering or direct color extraction for pixel art
3. **Transparency Handling**: Alpha threshold 128, transparent pixels become non-interactive
4. **Grid Generation**: 1:1 pixel mapping, each pixel becomes a numbered cell

### Game Mechanics
- **Progress Tracking**: Real-time completion percentage and color-by-color stats
- **Auto-save**: Every 30 seconds during active gameplay
- **Bucket Tool**: Flood-fill adjacent same-color areas
- **Zoom Levels**: Up to 5000% for precise pixel interaction
- **Completion**: Triggers modal with share/download options

### Gallery System
- **Built-in Gallery**: Progressive loading from `image_manifest.json`
- **User Gallery**: Persistent storage in localStorage
- **Categories**: Images organized by folder structure and size (8x8, 16x16, etc.)
- **Visual States**: Grayscale for uncompleted, color for completed images

## File Structure

```
├── index.html              # Main entry point
├── css/
│   ├── style.css          # Main styles
│   └── responsive.css     # Mobile/tablet layouts
├── js/
│   ├── main.js            # App orchestration
│   ├── gameEngine.js      # Game logic
│   ├── imageProcessor.js  # Image handling
│   ├── canvasRenderer.js  # Canvas rendering
│   ├── colorQuantizer.js  # Color algorithms
│   ├── galleryManager.js  # Gallery loading
│   └── utils.js           # Utilities
├── assets/
│   ├── icons/             # UI icons
│   └── sample-images/     # Built-in gallery images
├── server/                # Optional Node.js proxy
│   ├── server.js
│   └── package.json
└── image_manifest.json    # Gallery image definitions
```

## Browser Compatibility
- Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- Uses modern ES6+ features, Canvas API, and localStorage
- Responsive design with mobile-first approach