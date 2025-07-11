# Color by Numbers - 像素级数字填色游戏

一个基于 Web 的交互式像素级数字填色游戏，用户可以上传图片。系统会自动将图片转换为像素级数字填色游戏。每个像素都是一个可点击的填色区域。

## 🎨 功能特性

### 核心功能
- **图片导入**: 支持本地文件上传
- **像素级精确**: 每个像素都是一个独立的可点击填色区域
- **智能颜色量化**: 自动将复杂图片简化为可管理的颜色调色板
- **高倍放大显示**: 游戏开始时自动放大500%-800%，便于操作像素级别的填色
- **交互式填色**: 点击像素区域进行填色，支持缩放和平移
- **实时进度**: 显示填色进度和完成状态
- **颜色图例**: 显示数字与颜色的对应关系

### 交互体验
- **极致缩放**: 支持高达5000%的缩放，查看单个像素细节
- **精确点击**: 像素级精确的点击检测和填色
- **智能显示**: 根据缩放级别自动显示/隐藏像素数字和边框
- **平移功能**: 拖拽移动画布视图
- **进度追踪**: 实时显示完成进度
- **重置功能**: 一键重新开始游戏

### 像素级游戏特色
- **1:1像素映射**: 原图每个像素对应游戏中一个填色格子
- **精确填色**: 像素级精确度，完美还原原图

## 🛠️ 技术栈

### 前端技术
- **HTML5**: 页面结构和 Canvas 绘图
- **CSS3**: 现代化 UI 设计和响应式布局
- **JavaScript (ES6+)**: 核心游戏逻辑和交互
- **Canvas API**: 图像处理和游戏渲染

### 核心算法
- **颜色量化**: K-means 聚类和中位切分算法
- **图像处理**: 像素数据分析和颜色空间转换
- **坐标变换**: 缩放平移状态下的精确坐标映射

## 📁 项目结构

```
pixel-study/
├── index.html              # 主页面
├── css/
│   ├── style.css           # 主样式文件
│   └── responsive.css      # 响应式样式
├── js/
│   ├── main.js             # 主应用逻辑
│   ├── imageProcessor.js   # 图像处理模块
│   ├── gameEngine.js       # 游戏引擎
│   ├── canvasRenderer.js   # Canvas 渲染器
│   ├── colorQuantizer.js   # 颜色量化算法
│   └── utils.js            # 工具函数
├── assets/
│   ├── icons/              # 图标资源
│   └── sample-images/      # 示例图片
├── server/                 # 可选的后端代理
│   ├── server.js           # Node.js 服务器
│   └── package.json        # 后端依赖
└── README.md               # 项目说明
```

## 🚀 快速开始

### 方式一：直接运行（推荐）
1. 克隆或下载项目到本地
2. 使用现代浏览器打开 `index.html`
3. 开始享受数字填色游戏！

### 方式二：本地服务器运行
```bash
# 使用 Python 启动本地服务器
python -m http.server 8000

# 或使用 Node.js
npx http-server

# 然后访问 http://localhost:8000
```

### 方式三：启用后端代理（解决 CORS 问题）
```bash
cd server
npm install
npm start

# 后端将在 http://localhost:3000 运行
```

## 🎮 使用说明

1. **导入图片**
   - 点击"选择文件"上传本地图片（推荐小尺寸图片，如8x8到64x64像素）

2. **生成像素填色游戏**
   - 系统会自动处理图片并生成像素级填色游戏
   - 游戏会自动放大到500%-800%以便操作

3. **开始填色**
   - 每个像素都是一个可点击的填色区域
   - 使用鼠标滚轮缩放查看像素细节（最高5000%）
   - 点击灰色像素中的数字进行填色
   - 参考右侧颜色图例了解数字对应的颜色

4. **游戏控制**
   - 拖拽移动画布视图
   - 使用控制按钮重置或查看原图
   - 当缩放级别足够高时会显示像素数字

## 🌟 高级功能

### 算法优化
- **智能颜色选择**: 基于视觉重要性的颜色量化
- **自适应网格**: 根据图片复杂度调整网格密度
- **性能优化**: Web Workers 处理大图片

### 用户体验
- **进度保存**: 本地存储游戏进度
- **多种难度**: 简单、中等、困难模式
- **分享功能**: 导出完成的作品

## 🐛 故障排除

### 常见问题
1. **图片无法加载**: 尝试使用本地文件
2. **CORS 错误**: 启用后端代理服务器
3. **性能问题**: 尝试使用较小的图片或降低颜色数量

### 浏览器兼容性
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 版权许可

本软件根据 GNU 通用公共许可证第3版（GPLv3）授权。详情请参阅 `LICENSE` 文件。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

**开始您的数字填色之旅吧！** 🎨✨ 