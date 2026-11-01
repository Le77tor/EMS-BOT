const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Флаг для предотвращения повторной обработки shutdown
let isShuttingDown = false;
let botProcess = null;

// Подготавливаем Next.js приложение
const app = next({ 
  dev, 
  hostname, 
  port,
  dir: './apps/web' 
});

const handle = app.getRequestHandler();

console.log('Preparing Next.js application...');
console.log(`Environment: ${dev ? 'development' : 'production'}`);
console.log(`Directory: ${process.cwd()}/apps/web`);

// Проверяем наличие билда
const buildPath = path.join(process.cwd(), 'apps/web/.next');
const botBuildPath = path.join(process.cwd(), 'apps/bot/dist');

if (fs.existsSync(buildPath)) {
  console.log('Build exists: YES');
  // Если есть билд, принудительно используем production
  process.env.NODE_ENV = 'production';
  console.log('✅ Build found, forcing production mode');
} else {
  console.log('Build exists: NO');
}

if (fs.existsSync(botBuildPath)) {
  console.log('Bot build exists: YES');
} else {
  console.log('Bot build exists: NO');
}

// Проверяем содержимое apps/bot/
const botPath = path.join(process.cwd(), 'apps/bot');
if (fs.existsSync(botPath)) {
  console.log('\ud83d\udcc1 Checking apps/bot/ contents:');
  const botContents = fs.readdirSync(botPath);
  console.log('   Files/folders:', botContents.join(', '));
  
  const botDistPath = path.join(botPath, 'dist');
  if (fs.existsSync(botDistPath)) {
    const distContents = fs.readdirSync(botDistPath);
    console.log('   dist/ contents:', distContents.join(', '));
  }
}

console.log(`Port: ${port}`);

// Функция запуска Discord бота
function startDiscordBot() {
  if (botProcess) {
    console.log('⚠️ Discord bot already running');
    return;
  }

  const botEntryPath = path.join(process.cwd(), 'apps/bot/dist/index.js');
  
  if (!fs.existsSync(botEntryPath)) {
    console.error('❌ Bot entry file not found:', botEntryPath);
    return;
  }

  console.log('�\udd16 Starting Discord bot...');
  
  // Получаем путь к Node.js
  const nodePath = process.execPath;
  console.log('   Using Node.js:', nodePath);
  console.log('   Bot entry:', botEntryPath);
  
  try {
    botProcess = spawn(nodePath, [botEntryPath], {
      stdio: 'inherit',
      env: { ...process.env },
      detached: false
    });

    botProcess.on('error', (error) => {
      console.error('❌ Bot process error:', error);
      botProcess = null;
    });

    botProcess.on('exit', (code, signal) => {
      console.log(`🔴 Bot process exited with code ${code} and signal ${signal}`);
      botProcess = null;
    });

    console.log('✅ Discord bot process started');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    botProcess = null;
  }
}

// Функция остановки Discord бота
function stopDiscordBot() {
  if (botProcess) {
    console.log('�\udd16 Stopping Discord bot...');
    try {
      botProcess.kill('SIGTERM');
      botProcess = null;
    } catch (error) {
      console.error('❌ Error stopping bot:', error);
    }
  }
}

// Функция graceful shutdown
function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log(`\u26a0\ufe0f Already shutting down, ignoring ${signal}`);
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n${signal} received, shutting down gracefully`);
  
  // Останавливаем бота
  stopDiscordBot();
  
  // Закрываем сервер
  if (server) {
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
    
    // Форсированное закрытие через 10 секунд
    setTimeout(() => {
      console.error('❌ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

app.prepare().then(() => {
  console.log('✅ Next.js prepared, creating HTTP server...');
  
  // Запускаем Discord бота
  startDiscordBot();
  
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });
  
  // Увеличиваем лимит слушателей для предотвращения memory leak
  server.setMaxListeners(20);

  server.listen(port, (err) => {
    if (err) {
      console.error('❌ Failed to start server:', err);
      stopDiscordBot();
      process.exit(1);
    }
    console.log(`✅ Server listening on http://${hostname}:${port}`);
    console.log('✅ Ready to accept connections');
  });

  // Graceful shutdown - регистрируем только один раз
  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
  
}).catch((err) => {
  console.error('❌ Failed to prepare Next.js:', err);
  stopDiscordBot();
  process.exit(1);
});
