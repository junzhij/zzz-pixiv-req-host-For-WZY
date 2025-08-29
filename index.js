const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 根路由
app.get('/', (req, res) => {
  res.json({ 
    message: 'Pixiv代理服务器',
    usage: '直接访问路径即可，例如: /ajax/illust/12321111'
  });
});

// 直接代理路由 - 捕获所有其他路径并转发到Pixiv
app.all('*', async (req, res) => {
  try {
    const pixivPath = req.originalUrl;
    console.log(`代理请求: ${req.method} ${pixivPath}`);
    
    // 构建完整的pixiv.net URL
    const pixivUrl = `https://pixiv.net${pixivPath}`;
    
    // 使用node-fetch
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    
    try {
      // 真实fetch pixiv.net
      console.log(`开始fetch: ${pixivUrl}`);
      
      const response = await fetch(pixivUrl, {
        method: req.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000 // 10秒超时
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 获取响应内容
      const contentType = response.headers.get('content-type');
      let responseData;
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      console.log(`fetch成功: ${pixivUrl}, 状态: ${response.status}`);
      
      // 直接在controller中转换URL
      const proxyUrl = process.env.PROXY_URL || 'http://localhost:8080';
      
      // 递归转换所有URL
      const convertUrls = (obj) => {
        if (typeof obj === 'string') {
          // 替换所有i.pixiv.net和i.pximg.net的URL为代理URL
          return obj.replace(/https?:\/\/(i\.pixiv\.net|i\.pximg\.net)/g, proxyUrl);
        } else if (Array.isArray(obj)) {
          return obj.map(item => convertUrls(item));
        } else if (typeof obj === 'object' && obj !== null) {
          const converted = {};
          Object.keys(obj).forEach(key => {
            converted[key] = convertUrls(obj[key]);
          });
          return converted;
        }
        return obj;
      };
      
      // 转换URL并返回
      const convertedData = convertUrls(responseData);
      console.log(`URL转换完成: i.pixiv.net/i.pximg.net → ${proxyUrl}`);
      
      // 设置响应头
      res.set('Content-Type', contentType);
      res.json(convertedData);
      
    } catch (fetchError) {
      console.error(`fetch pixiv.net失败: ${fetchError.message}`);
      
      // 如果fetch失败，返回错误信息
      res.status(500).json({
        error: `fetch失败: ${fetchError.message}`
      });
    }
    
  } catch (error) {
    console.error('代理请求时发生错误:', error);
    res.status(500).json({
      error: '代理请求失败',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`代理服务器运行在端口 ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`示例: http://localhost:${PORT}/ajax/illust/12321111`);
});
