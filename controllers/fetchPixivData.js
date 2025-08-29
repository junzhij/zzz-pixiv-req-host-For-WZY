/**
 * Pixiv数据获取控制器
 * 直接在controller中完成fetch和URL转换
 */

// 使用node-fetch，兼容性更好
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const fetchPixivData = async (req, res) => {
  try {
    const { method } = req;
    const requestData = method === 'GET' ? req.query : req.body;
    
    console.log(`${method} 请求 - 获取Pixiv数据:`, requestData);
    
    // 从请求中提取pixiv URL路径
    let pixivPath = '';
    if (requestData.url) {
      // 如果直接提供了完整URL，提取路径部分
      const urlMatch = requestData.url.match(/https?:\/\/[^\/]+(\/.*)/);
      if (urlMatch) {
        pixivPath = urlMatch[1];
      }
    } else if (requestData.path) {
      // 如果提供了路径
      pixivPath = requestData.path;
    } else {
      // 默认路径
      pixivPath = '/v1/illust/recommended';
    }
    
    console.log(`准备fetch pixiv.net路径: ${pixivPath}`);
    
    // 构建完整的pixiv.net URL
    const pixivUrl = `https://pixiv.net${pixivPath}`;
    
    try {
      // 真实fetch pixiv.net
      console.log(`开始fetch: ${pixivUrl}`);
      
      const response = await fetch(pixivUrl, {
        method: 'GET',
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
      
      res.json(convertedData);
      
    } catch (fetchError) {
      console.error(`fetch pixiv.net失败: ${fetchError.message}`);
      
      // 如果fetch失败，返回错误信息
      res.status(500).json({
        error: `fetch失败: ${fetchError.message}`
      });
    }
    
  } catch (error) {
    console.error('获取Pixiv数据时发生错误:', error);
    res.status(500).json({
      error: '获取Pixiv数据失败',
      message: error.message
    });
  }
};

module.exports = {
  fetchPixivData
};
