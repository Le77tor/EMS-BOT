/**
 * 📋 МОДУЛЬ: Заявки на вынесение из черного списка
 * 
 * Функционал:
 * - Проверка новых заявок в базе данных
 * - Отправка заявок в Discord канал с кнопками
 * - Обновление статуса отправленных заявок
 * - Обработка нажатий кнопок (взять в рассмотрение, принять, отклонить)
 */

import type { Client } from 'discord.js';
import { prisma } from '@majestic/database';
import type { BlacklistRemoval } from '@majestic/database';
import { sendApplicationToDiscord } from './sender.js';

// ==========================================
// Конфигурация модуля
// ==========================================

const CONFIG = {
  CHECK_INTERVAL: 30000, // 30 секунд
};

// ==========================================
// Обработка заявок
// ==========================================

async function getPendingApplications(): Promise<BlacklistRemoval[]> {
  try {
    return await prisma.blacklistRemoval.findMany({
      where: {
        sentToDiscord: false,
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  } catch (error) {
    console.error('❌ [Blacklist] Ошибка получения заявок:', error);
    return [];
  }
}

async function markAsSent(
  applicationId: string,
  messageId: string
): Promise<void> {
  try {
    await prisma.blacklistRemoval.update({
      where: { id: applicationId },
      data: {
        sentToDiscord: true,
        discordMessageId: messageId,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error(`❌ [Blacklist] Ошибка обновления статуса заявки ${applicationId}:`, error);
  }
}

async function processApplications(client: Client): Promise<void> {
  const applications = await getPendingApplications();

  if (applications.length === 0) {
    return; // Нет новых заявок
  }

  console.log(`📋 [Blacklist] Найдено ${applications.length} новых заявок`);

  for (const app of applications) {
    const messageId = await sendApplicationToDiscord(client, app);

    if (messageId) {
      await markAsSent(app.id, messageId);
      console.log(`✅ [Blacklist] Заявка ${app.id} отправлена (сообщение: ${messageId})`);
    }

    // Задержка между сообщениями
    if (applications.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// ==========================================
// Инициализация модуля
// ==========================================

let intervalId: NodeJS.Timeout | null = null;

export function startBlacklistRemovalModule(client: Client): void {
  console.log('🚀 [Blacklist] Модуль заявок из ЧС запущен');
  console.log(`📡 [Blacklist] Проверка каждые ${CONFIG.CHECK_INTERVAL / 1000} секунд`);

  // Проверка сразу при запуске
  processApplications(client).catch(error => {
    console.error('❌ [Blacklist] Ошибка начальной проверки:', error);
  });

  // Периодическая проверка
  intervalId = setInterval(() => {
    processApplications(client).catch(error => {
      console.error('❌ [Blacklist] Ошибка периодической проверки:', error);
    });
  }, CONFIG.CHECK_INTERVAL);
}

export function stopBlacklistRemovalModule(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('🛑 [Blacklist] Модуль заявок из ЧС остановлен');
  }
}
