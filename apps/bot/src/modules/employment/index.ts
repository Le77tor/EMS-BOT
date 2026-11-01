/**
 * 📋 МОДУЛЬ: Заявки на трудоустройство
 * 
 * Функционал:
 * - Проверка новых заявок в базе данных
 * - Создание отдельного канала для каждой заявки
 * - Добавление заявителя в канал
 * - Отправка информации о заявке в канал
 */

import type { Client } from 'discord.js';
import { prisma } from '@majestic/database';
import type { EmploymentApplication } from '@majestic/database';
import { createEmploymentChannel } from './sender.js';

// ==========================================
// Конфигурация модуля
// ==========================================

const CONFIG = {
  CHECK_INTERVAL: 30000, // 30 секунд
};

// ==========================================
// Обработка заявок
// ==========================================

async function getPendingApplications(): Promise<EmploymentApplication[]> {
  try {
    return await prisma.employmentApplication.findMany({
      where: {
        sentToDiscord: false,
        status: 'PENDING',
        userJoinedGuild: true // Только те, кто присоединился к серверу
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  } catch (error) {
    console.error('❌ [Employment] Ошибка получения заявок:', error);
    return [];
  }
}

async function markAsSent(
  applicationId: string,
  channelId: string
): Promise<boolean> {
  try {
    await prisma.employmentApplication.update({
      where: { id: applicationId },
      data: {
        sentToDiscord: true,
        discordChannelId: channelId,
        status: 'IN_REVIEW',
        updatedAt: new Date()
      }
    });
    console.log(`✅ [Employment] Заявка ${applicationId} отмечена как отправленная`);
    return true;
  } catch (error) {
    console.error(`❌ [Employment] Ошибка обновления статуса заявки ${applicationId}:`, error);
    return false;
  }
}

async function processApplications(client: Client): Promise<void> {
  const applications = await getPendingApplications();

  if (applications.length === 0) {
    return; // Нет новых заявок
  }

  console.log(`📋 [Employment] Найдено ${applications.length} новых заявок`);

  for (const app of applications) {
    try {
      console.log(`🔄 [Employment] Обработка заявки ${app.id}...`);
      
      // Сначала отмечаем заявку как отправленную (с временным статусом)
      const marked = await markAsSent(app.id, 'processing');
      
      if (!marked) {
        console.error(`❌ [Employment] Не удалось отметить заявку ${app.id}, пропускаем`);
        continue;
      }

      // Создаём канал
      const channelId = await createEmploymentChannel(client, app);

      if (channelId) {
        // Обновляем ID канала
        await prisma.employmentApplication.update({
          where: { id: app.id },
          data: {
            discordChannelId: channelId,
            updatedAt: new Date()
          }
        });
        console.log(`✅ [Employment] Заявка ${app.id} обработана (канал: ${channelId})`);
      } else {
        // Откатываем статус, если не удалось создать канал
        await prisma.employmentApplication.update({
          where: { id: app.id },
          data: {
            sentToDiscord: false,
            status: 'PENDING',
            updatedAt: new Date()
          }
        });
        console.error(`❌ [Employment] Не удалось создать канал для заявки ${app.id}, статус откачен`);
      }
    } catch (error) {
      console.error(`❌ [Employment] Критическая ошибка обработки заявки ${app.id}:`, error);
      // Откатываем статус в случае критической ошибки
      try {
        await prisma.employmentApplication.update({
          where: { id: app.id },
          data: {
            sentToDiscord: false,
            status: 'PENDING',
            updatedAt: new Date()
          }
        });
      } catch (rollbackError) {
        console.error(`❌ [Employment] Не удалось откатить статус заявки ${app.id}:`, rollbackError);
      }
    }

    // Задержка между созданием каналов
    if (applications.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// ==========================================
// Инициализация модуля
// ==========================================

let intervalId: NodeJS.Timeout | null = null;

export function startEmploymentModule(client: Client): void {
  console.log('🚀 [Employment] Модуль трудоустройства запущен');
  console.log(`📡 [Employment] Проверка каждые ${CONFIG.CHECK_INTERVAL / 1000} секунд`);

  // Проверка сразу при запуске
  processApplications(client).catch(error => {
    console.error('❌ [Employment] Ошибка начальной проверки:', error);
  });

  // Периодическая проверка
  intervalId = setInterval(() => {
    processApplications(client).catch(error => {
      console.error('❌ [Employment] Ошибка периодической проверки:', error);
    });
  }, CONFIG.CHECK_INTERVAL);
}

export function stopEmploymentModule(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('🛑 [Employment] Модуль трудоустройства остановлен');
  }
}
