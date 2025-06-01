const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（如果需要）
app.use(express.static(path.join(__dirname, '../')));

// 文件上传配置
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'), false);
        }
    }
});

/**
 * 健康检查端点
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Color by Numbers Proxy Server'
    });
});

/**
 * 图片代理端点 - 解决CORS问题
 */
app.get('/api/proxy-image', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: '缺少图片URL参数' });
        }

        // 验证URL格式
        let imageUrl;
        try {
            imageUrl = new URL(url);
        } catch (error) {
            return res.status(400).json({ error: '无效的URL格式' });
        }

        // 安全检查 - 只允许HTTP/HTTPS协议
        if (!['http:', 'https:'].includes(imageUrl.protocol)) {
            return res.status(400).json({ error: '只支持HTTP/HTTPS协议' });
        }

        console.log(`代理请求图片: ${url}`);

        // 请求图片
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Color-by-Numbers-Proxy/1.0'
            }
        });

        // 检查响应类型
        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.startsWith('image/')) {
            return res.status(400).json({ error: 'URL不是有效的图片' });
        }

        // 设置响应头
        res.set({
            'Content-Type': contentType,
            'Content-Length': response.data.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        });

        res.send(response.data);

    } catch (error) {
        console.error('代理图片错误:', error.message);
        
        if (error.code === 'ENOTFOUND') {
            res.status(404).json({ error: '图片URL无法访问' });
        } else if (error.code === 'ETIMEDOUT') {
            res.status(408).json({ error: '请求超时' });
        } else {
            res.status(500).json({ error: '代理请求失败' });
        }
    }
});

/**
 * 图片上传和处理端点
 */
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const { buffer, mimetype, originalname } = req.file;
        
        // 使用Sharp处理图片
        const metadata = await sharp(buffer).metadata();
        
        // 可选：调整图片大小以优化性能
        const maxSize = 1200;
        let processedBuffer = buffer;
        
        if (metadata.width > maxSize || metadata.height > maxSize) {
            processedBuffer = await sharp(buffer)
                .resize(maxSize, maxSize, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 90 })
                .toBuffer();
        }

        // 转换为Base64返回
        const base64 = `data:${mimetype};base64,${processedBuffer.toString('base64')}`;
        
        res.json({
            success: true,
            data: base64,
            metadata: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: buffer.length,
                originalName: originalname
            }
        });

    } catch (error) {
        console.error('图片上传处理错误:', error);
        res.status(500).json({ error: '图片处理失败' });
    }
});

/**
 * 图片优化端点
 */
app.post('/api/optimize-image', express.raw({ type: 'image/*', limit: '10mb' }), async (req, res) => {
    try {
        const { quality = 80, maxWidth = 800, maxHeight = 600 } = req.query;
        
        if (!req.body || req.body.length === 0) {
            return res.status(400).json({ error: '没有图片数据' });
        }

        const optimizedBuffer = await sharp(req.body)
            .resize(parseInt(maxWidth), parseInt(maxHeight), {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: parseInt(quality) })
            .toBuffer();

        res.set({
            'Content-Type': 'image/jpeg',
            'Content-Length': optimizedBuffer.length
        });

        res.send(optimizedBuffer);

    } catch (error) {
        console.error('图片优化错误:', error);
        res.status(500).json({ error: '图片优化失败' });
    }
});

/**
 * 获取图片信息端点
 */
app.post('/api/image-info', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const metadata = await sharp(req.file.buffer).metadata();
        
        res.json({
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: req.file.size,
            density: metadata.density,
            hasAlpha: metadata.hasAlpha,
            channels: metadata.channels
        });

    } catch (error) {
        console.error('获取图片信息错误:', error);
        res.status(500).json({ error: '获取图片信息失败' });
    }
});

/**
 * 错误处理中间件
 */
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '文件大小超过限制（最大10MB）' });
        }
    }
    
    res.status(500).json({ error: '服务器内部错误' });
});

/**
 * 404处理
 */
app.use('*', (req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

/**
 * 启动服务器
 */
app.listen(PORT, () => {
    console.log(`🚀 Color by Numbers 代理服务器启动成功！`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`🔗 API端点:`);
    console.log(`   - 健康检查: GET /api/health`);
    console.log(`   - 图片代理: GET /api/proxy-image?url=<IMAGE_URL>`);
    console.log(`   - 图片上传: POST /api/upload-image`);
    console.log(`   - 图片优化: POST /api/optimize-image`);
    console.log(`   - 图片信息: POST /api/image-info`);
    console.log(`\n💡 使用说明:`);
    console.log(`   1. 启动前端应用: 在项目根目录运行 python -m http.server 8000`);
    console.log(`   2. 访问应用: http://localhost:8000`);
    console.log(`   3. 后端代理将自动处理CORS问题\n`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，正在关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n收到SIGINT信号，正在关闭服务器...');
    process.exit(0);
}); 