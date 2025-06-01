[简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md)

# Color by Numbers - Pixel-level Digital Coloring Game

A web-based interactive pixel-level digital coloring game where users can upload images. The system automatically converts images into a pixel-level digital coloring game. Each pixel is a clickable coloring area.

## 🎨 Features

### Core Features
- **Image Import**: Supports local file upload
- **Pixel-level Precision**: Each pixel is an independent, clickable coloring area
- **Intelligent Color Quantization**: Automatically simplifies complex images into a manageable color palette
- **High Magnification Display**: Automatically magnifies 500%-800% at the start of the game for easy pixel-level coloring
- **Interactive Coloring**: Click pixel areas to color, supports zoom and pan
- **Real-time Progress**: Displays coloring progress and completion status
- **Color Legend**: Shows the correspondence between numbers and colors

### Interactive Experience
- **Extreme Zoom**: Supports up to 5000% zoom to view single pixel details
- **Precise Clicking**: Pixel-level precise click detection and coloring
- **Smart Display**: Automatically shows/hides pixel numbers and borders based on zoom level
- **Panning Function**: Drag to move the canvas view
- **Progress Tracking**: Real-time display of completion progress
- **Reset Function**: One-click restart game

### Pixel-level Game Characteristics
- **1:1 Pixel Mapping**: Each pixel of the original image corresponds to one coloring cell in the game
- **Precise Coloring**: Pixel-level accuracy, perfectly restoring the original image

## 🛠️ Tech Stack

### Frontend Technologies
- **HTML5**: Page structure and Canvas drawing
- **CSS3**: Modern UI design and responsive layout
- **JavaScript (ES6+)**: Core game logic and interaction
- **Canvas API**: Image processing and game rendering

### Core Algorithms
- **Color Quantization**: K-means clustering and median cut algorithms
- **Image Processing**: Pixel data analysis and color space conversion
- **Coordinate Transformation**: Precise coordinate mapping under zoom and pan states

## 📁 Project Structure

```
pixel-study/
├── index.html              # Main page
├── css/
│   ├── style.css           # Main stylesheet
│   └── responsive.css      # Responsive styles
├── js/
│   ├── main.js             # Main application logic
│   ├── imageProcessor.js   # Image processing module
│   ├── gameEngine.js       # Game engine
│   ├── canvasRenderer.js   # Canvas renderer
│   ├── colorQuantizer.js   # Color quantization algorithm
│   └── utils.js            # Utility functions
├── assets/
│   ├── icons/              # Icon resources
│   └── sample-images/      # Sample images
├── server/                 # Optional backend proxy
│   ├── server.js           # Node.js server
│   └── package.json        # Backend dependencies
└── README.md               # Project description
```

## 🚀 Quick Start

### Method 1: Direct Run (Recommended)
1. Clone or download the project locally.
2. Open `index.html` with a modern browser.
3. Start enjoying the digital coloring game!

### Method 2: Run with a Local Server
```bash
# Start a local server using Python
python -m http.server 8000

# Or use Node.js
npx http-server

# Then visit http://localhost:8000
```

### Method 3: Enable Backend Proxy (to solve CORS issues)
```bash
cd server
npm install
npm start

# The backend will run at http://localhost:3000
```

## 🎮 Usage Instructions

1. **Import Image**
   - Click "Choose File" to upload a local image (small images like 8x8 to 64x64 pixels are recommended).

2. **Generate Pixel Coloring Game**
   - The system will automatically process the image and generate a pixel-level coloring game.
   - The game will automatically zoom to 500%-800% for easier operation.

3. **Start Coloring**
   - Each pixel is a clickable coloring area.
   - Use the mouse wheel to zoom in/out and see pixel details (up to 5000%).
   - Click on the numbers in the gray pixels to color them.
   - Refer to the color legend on the right to understand the number-to-color mapping.

4. **Game Controls**
   - Drag to pan the canvas view.
   - Use control buttons to reset or view the original image.
   - Pixel numbers will be displayed when the zoom level is high enough.

## 🌟 Advanced Features

### Algorithm Optimization
- **Intelligent Color Selection**: Color quantization based on visual importance.
- **Adaptive Grid**: Adjusts grid density based on image complexity.
- **Performance Optimization**: Web Workers for handling large images.

### User Experience
- **Progress Saving**: Local storage for game progress.
- **Multiple Difficulties**: Easy, Medium, Hard modes.
- **Sharing Function**: Export completed artwork.

## 🐛 Troubleshooting

### Common Issues
1. **Image Fails to Load**: Try using a local file.
2. **CORS Error**: Enable the backend proxy server.
3. **Performance Issues**: Try using smaller images or reducing the number of colors.

### Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🤝 Contribution Guide

Issues and Pull Requests are welcome!

1. Fork the project.
2. Create a feature branch.
3. Commit your changes.
4. Push to the branch.
5. Create a Pull Request.

## 📄 License

This software is licensed under the GNU General Public License v3.0. See the `LICENSE` file for details.

## 🙏 Acknowledgments

Thanks to all developers and users who contributed to this project!

---

**Start your digital coloring journey!** 🎨✨ 