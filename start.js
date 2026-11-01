const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Ограничиваем память Node.js (512MB для веб-сервера)
if (!process.env.NODE_OPTIONS) {
  process.env.NODE_OPTIONS = '--max-old-space-size=512';
}

// Подавляем deprecation warnings
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.code === 'DEP0169') {
    return;
  }
  console.warn(warning.name, warning.message);
});

// Используем абсолютный путь к приложению
const appDir = path.join(__dirname, 'apps', 'web');
const botDir = path.join(__dirname, 'apps', 'bot');
const nextBuildPath = path.join(appDir, '.next');
const botBuildPath = path.join(botDir, 'dist', 'index.js');

// Проверяем существование build
const hasBuild = fs.existsSync(nextBuildPath);
const hasBotBuild = fs.existsSync(botBuildPath);

// Форсируем production если есть билд
if (hasBuild) {
  console.log('✅ Build found, forcing production mode');
  process.env.NODE_ENV = 'production';
} else {
  console.log('⚠️ No build found, using development mode');
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

console.log('Preparing Next.js application...');
console.log(`Environment: ${dev ? 'development' : 'production'}`);
console.log(`Directory: ${appDir}`);
console.log(`Build exists: ${hasBuild ? 'YES' : 'NO'}`);
console.log(`Bot build exists: ${hasBotBuild ? 'YES' : 'NO'}`);

// Диагностика apps/bot/
console.log('📁 Checking apps/bot/ contents:');
try {
  const botDirContents = fs.readdirSync(botDir);
  console.log('   Files/folders:', botDirContents.join(', '));
  
  const distPath = path.join(botDir, 'dist');
  if (fs.existsSync(distPath)) {
    const distContents = fs.readdirSync(distPath);
    console.log('   dist/ contents:', distContents.join(', '));
  } else {
    console.log('   ❌ dist/ folder does NOT exist');
  }
} catch (error) {
  console.log('   ⚠️ Error reading bot directory:', error.message);
}

console.log(`Port: ${port}`);
console.log(`Node.js binary: ${process.execPath}`);
console.log(`Memory limit: ${process.env.NODE_OPTIONS || 'default'}`);

if (!hasBuild) {
  console.warn('⚠️ Warning: No production build found');
  console.warn('⚠️ Running in development mode');
}

// Запускаем Discord бота с ограничением памяти (256MB)
let botProcess = null;
if (hasBotBuild) {
  console.log('🤖 Starting Discord bot...');
  console.log(`   Using Node.js: ${process.execPath}`);
  console.log(`   Bot entry: ${botBuildPath}`);
  
  botProcess = spawn(process.execPath, [
    '--max-old-space-size=256', // Лимит 256MB для бота
    botBuildPath
  ], {
    cwd: botDir,
    env: process.env,
    stdio: 'inherit'
  });

  botProcess.on('error', (err) => {
    console.error('❌ Failed to start Discord bot:', err);
  });

  botProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ Discord bot exited with code ${code}`);
    } else if (signal) {
      console.log(`🤖 Discord bot killed with signal ${signal}`);
    }
  });

  console.log('✅ Discord bot process started');
} else {
  console.warn('⚠️ Discord bot build not found, skipping bot startup');
  console.warn(`⚠️ Expected: ${botBuildPath}`);
}

// Подготавливаем Next.js приложение
const app = next({ 
  dev, 
  hostname, 
  port,
  dir: appDir,
  // Отключаем hot-reload в production
  conf: dev ? undefined : {
    compress: true,
    generateEtags: true,
    poweredByHeader: false
  }
});

const handle = app.getRequestHandler();

// Флаг для предотвращения множественных shutdown
let isShuttingDown = false;

app.prepare().then(() => {
  console.log('✅ Next.js prepared, creating HTTP server...');
  
  const server = createServer(async (req, res) => {
    try {
      // Проверяем health check от хостинга
      if (req.url === '/health' || req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
        return;
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Увеличиваем таймауты для медленных запросов
  server.timeout = 120000; // 120 секунд
  server.keepAliveTimeout = 65000; // 65 секунд

  server.listen(port, (err) => {
    if (err) {
      console.error('❌ Failed to start server:', err);
      process.exit(1);
    }
    console.log(`✅ Server listening on http://${hostname}:${port}`);
    console.log('✅ Ready to accept connections');
  });

  // Graceful shutdown с защитой от множественных вызовов
  const shutdown = (signal) => {
    if (isShuttingDown) {
      console.log(`${signal} received, but shutdown already in progress`);
      return;
    }
    
    isShuttingDown = true;
    console.log(`${signal} received, shutting down gracefully`);
    
    // Останавливаем бота
    if (botProcess && !botProcess.killed) {
      console.log('🤖 Stopping Discord bot...');
      botProcess.kill('SIGTERM');
    }

    // Останавливаем веб-сервер
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Форсируем выход через 15 секунд
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Обработка неожиданных ошибок
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });

}).catch((err) => {
  console.error('❌ Failed to prepare Next.js:', err);
  console.error('Stack:', err.stack);
  
  if (botProcess && !botProcess.killed) {
    botProcess.kill('SIGTERM');
  }
  
  process.exit(1);
});
