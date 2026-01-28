// Simple CORS proxy para Challonge
const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3000;

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Extract target URL from query parameter
    const parsedUrl = url.parse(req.url, true);
    const targetUrl = parsedUrl.query.url;
    
    if (!targetUrl) {
        res.writeHead(400);
        res.end('Missing url parameter');
        return;
    }
    
    console.log(`Proxying: ${req.method} ${targetUrl}`);
    
    // Parse target URL
    const targetParsed = url.parse(targetUrl);
    const protocol = targetParsed.protocol === 'https:' ? https : http;
    
    // Forward request
    const options = {
        hostname: targetParsed.hostname,
        port: targetParsed.port,
        path: targetParsed.path,
        method: req.method,
        headers: req.headers
    };
    
    delete options.headers['host'];
    
    const proxyReq = protocol.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (error) => {
        console.error('Proxy error:', error);
        res.writeHead(500);
        res.end('Proxy error');
    });
    
    req.pipe(proxyReq);
});

server.listen(PORT, () => {
    console.log(`CORS Proxy running on http://localhost:${PORT}`);
    console.log(`Usage: http://localhost:${PORT}?url=<target-url>`);
});
