/**
 * 🏖️ МОДУЛЬ: Отпуска и Увольнения
 * 
 * Функционал:
 * - Отправка новых заявок на отпуск в Discord канал
 * - Отправка новых заявлений на увольнение в Discord канал
 * - Проверка одобренных заявок на отпуск
 * - Автоматическая выдача ролей отпуска в день начала
 * - Автоматическое снятие ролей отпуска в день окончания
 * - Поддержка OOC и IC отпусков
 */

import { Client, Guild, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '@majestic/database';
import { getCurrentRank } from '../../constants/roles.js';

// ==========================================
// Конфигурация модуля
// ==========================================

const CONFIG = {
  CHECK_INTERVAL: 30000, // 30 секунд (проверяем часто для точности)
  GUILD_ID: process.env.DISCORD_GUILD_ID || '',
  VACATION_CHANNEL_ID: process.env.VACATION_CHANNEL_ID || '1551231066159976518', // Канал для заявок на отпуск
  RESIGNATION_CHANNEL_ID: process.env.RESIGNATION_CHANNEL_ID || '1550131754138869881', // Канал для заявлений на увольнение
  VACATION_OOC_ROLE_ID: process.env.VACATION_OOC_ROLE_ID || '',
  VACATION_IC_ROLE_ID: process.env.VACATION_IC_ROLE_ID || '',
};

// ==========================================
// Утилиты
// ==========================================

function getTodayDateString(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Извлекает имя из displayName формата "Prefix | Имя Фамилия | ID"
 * Пример: "Ass.DI | Lestor Hydrogn | 221485" -> "Lestor Hydrogn"
 */
function extractNameFromDisplayName(displayName: string): string {
  const parts = displayName.split('|').map(p => p.trim());
  if (parts.length >= 2) {
    return parts[1]; // Второй элемент - это имя
  }
  return displayName; // Если формат не распознан, возвращаем как есть
}

/**
 * Извлекает Static (ID) из displayName формата "Prefix | Имя Фамилия | ID"
 * Пример: "Ass.DI | Lestor Hydrogn | 221485" -> "221485"
 */
function extractStaticFromDisplayName(displayName: string): string {
  const parts = displayName.split('|').map(p => p.trim());
  if (parts.length >= 3) {
    return parts[2]; // Третий элемент - это Static ID
  }
  return 'Не указан';
}

/**
 * Определяет отдел сотрудника по его ролям в Discord
 */
function getDepartmentFromRoles(member: any): string {
  const DEPARTMENT_ROLES = {
    '1482048390136070326': 'IN (Internal Affairs)',
    '1482048390136070327': 'PM (Police Management)',
    '1482048390136070328': 'PSED (Police Special Equipment Division)',
    '1482048390119555129': 'DES (Detective Services)',
    '1561397031262494891': 'IN DI (Internal Affairs - Detective Investigation)',
    '1482048390136070329': 'DI (Detective Investigation)',
    '1482048390148784230': 'HAD (High Authority Department)',
  };

  if (!member) return 'Не определен';

  for (const [roleId, departmentName] of Object.entries(DEPARTMENT_ROLES)) {
    if (member.roles.cache.has(roleId)) {
      return departmentName;
    }
  }

  return 'Не определен';
}

/**
 * Определяет код отдела для маппинга ролей
 */
function getDepartmentCode(member: any): string | null {
  const DEPARTMENT_CODES = {
    '1482048390136070326': 'IN',
    '1482048390136070327': 'PM',
    '1482048390136070328': 'PSED',
    '1482048390119555129': 'DES',
    '1561397031262494891': 'IN_DI',
    '1482048390136070329': 'DI',
    '1482048390148784230': 'HAD',
  };

  if (!member) return null;

  for (const [roleId, code] of Object.entries(DEPARTMENT_CODES)) {
    if (member.roles.cache.has(roleId)) {
      return code;
    }
  }

  return null;
}

/**
 * Получает роли для пинга в зависимости от типа отпуска и отдела
 */
function getRolesToPing(vacationType: string, departmentCode: string | null): string[] {
  const roles: string[] = [];

  if (vacationType.toUpperCase() === 'OOC') {
    // OOC отпуск - пингуем 2 роли
    roles.push('<@&1482048390157303914>', '<@&1482048390157303913>');
  } else {
    // IC отпуск - всегда пингуем HAD + роли отдела
    roles.push('<@&1482048390148784230>');

    // Добавляем роли в зависимости от отдела
    switch (departmentCode) {
      case 'IN':
        roles.push('<@&1482048390148784234>');
        break;
      case 'PM':
        roles.push('<@&1516721813579628594>', '<@&1516719506997641237>');
        break;
      case 'PSED':
        roles.push('<@&1516721846945452085>', '<@&1516719580939157524>');
        break;
      case 'DES':
        roles.push('<@&1516721885302231241>', '<@&1516719626497560626>');
        break;
      case 'IN_DI':
        roles.push('<@&1516721778934812794>', '<@&1516717575982153819>');
        break;
      case 'DI':
        roles.push('<@&1516721778934812794>', '<@&1516717575982153819>');
        break;
      case 'HAD':
        roles.push('<@&1516721666888302672>', '<@&1482048390148784238>');
        break;
    }
  }

  return roles;
}

// ==========================================
// Отправка новых заявок в Discord
// ==========================================

async function sendPendingVacationsToDiscord(client: Client): Promise<void> {
  try {
    // Получаем guild и канал
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!guild) {
      console.error('[Vacation] ❌ Guild не найден:', CONFIG.GUILD_ID);
      return;
    }

    const channel = guild.channels.cache.get(CONFIG.VACATION_CHANNEL_ID) as TextChannel;
    if (!channel) {
      console.error('[Vacation] ❌ Канал не найден:', CONFIG.VACATION_CHANNEL_ID);
      return;
    }

    // Получаем все заявки со статусом PENDING, которые ещё не отправлены в Discord
    const pendingVacations = await prisma.application.findMany({
      where: {
        type: 'VACATION',
        status: 'PENDING',
        reviewNote: null, // Используем reviewNote для отметки "отправлено в Discord"
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (pendingVacations.length === 0) {
      return;
    }

    console.log(`[Vacation] 📤 Найдено ${pendingVacations.length} новых заявок для отправки в Discord`);

    for (const vacation of pendingVacations) {
      try {
        const data = vacation.data as any;
        const vacationType = data?.vacationType || 'N/A';
        const startDate = data?.startDate || 'N/A';
        const endDate = data?.endDate || 'N/A';
        const reason = data?.reason || 'Не указана';

        // Получаем пользователя Discord
        const discordUser = await client.users.fetch(vacation.user.discordId).catch(() => null);
        
        // Получаем member для доступа к displayName (нику на сервере)
        const member = await guild.members.fetch(vacation.user.discordId).catch(() => null);
        const displayName = member?.displayName || vacation.user.displayName || vacation.user.username;
        
        // Извлекаем имя из формата "Prefix | Имя Фамилия | ID"
        const username = extractNameFromDisplayName(displayName);
        const staticId = extractStaticFromDisplayName(displayName);
        const department = getDepartmentFromRoles(member);
        const departmentCode = getDepartmentCode(member);
        const avatar = discordUser?.displayAvatarURL() || undefined;

        // Получаем роли для пинга
        const rolesToPing = getRolesToPing(vacationType, departmentCode);

        // Создаём embed
        const embed = new EmbedBuilder()
          .setColor(vacationType.toUpperCase() === 'OOC' ? 0x3498db : 0x9b59b6) // Синий для OOC, фиолетовый для IC
          .setTitle('<:vacation:1566142172254699550> Новая заявка на отпуск')
          .setDescription(`**${username}** подал(а) заявку на отпуск`)
          .addFields(
            { name: '👤 Пользователь', value: `<@${vacation.user.discordId}>`, inline: true },
            { name: '🏢 Отдел', value: department, inline: true },
            { name: '🆔 Static', value: staticId, inline: true },
            { name: '📅 Тип отпуска', value: vacationType.toUpperCase(), inline: true },
            { name: '📆 Дата начала', value: formatDate(startDate), inline: true },
            { name: '📆 Дата окончания', value: formatDate(endDate), inline: true },
            { name: '📝 Причина', value: reason || 'Не указана', inline: false }
          )
          .setThumbnail(avatar || null)
          .setFooter({ text: `ID заявки: ${vacation.id}` })
          .setTimestamp();

        // Создаём кнопки
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`vacation_approve_${vacation.id}`)
              .setLabel('✅ Одобрить')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`vacation_reject_${vacation.id}`)
              .setLabel('❌ Отклонить')
              .setStyle(ButtonStyle.Danger)
          );

        // Отправляем сообщение с пингом ролей
        const message = await channel.send({
          content: rolesToPing.join(' '),
          embeds: [embed],
          components: [row],
        });

        // Помечаем заявку как отправленную (используем reviewNote как флаг)
        await prisma.application.update({
          where: { id: vacation.id },
          data: {
            reviewNote: `discord_message_${message.id}`,
            updatedAt: new Date(),
          },
        });

        console.log(`[Vacation] ✅ Заявка ${vacation.id} отправлена в Discord (message: ${message.id})`);
      } catch (error) {
        console.error(`[Vacation] ❌ Ошибка отправки заявки ${vacation.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Vacation] ❌ Критическая ошибка при отправке заявок:', error);
  }
}

// ==========================================
// Отправка заявлений на увольнение в Discord
// ==========================================

async function sendPendingResignationsToDiscord(client: Client): Promise<void> {
  try {
    // Получаем guild и канал
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!guild) {
      console.error('[Resignation] ❌ Guild не найден:', CONFIG.GUILD_ID);
      return;
    }

    const channel = guild.channels.cache.get(CONFIG.RESIGNATION_CHANNEL_ID) as TextChannel;
    if (!channel) {
      console.error('[Resignation] ❌ Канал не найден:', CONFIG.RESIGNATION_CHANNEL_ID);
      return;
    }

    // Получаем все заявления со статусом PENDING, которые ещё не отправлены в Discord
    const pendingResignations = await prisma.application.findMany({
      where: {
        type: 'RESIGNATION',
        status: 'PENDING',
        reviewNote: null, // Используем reviewNote для отметки "отправлено в Discord"
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (pendingResignations.length === 0) {
      return;
    }

    console.log(`[Resignation] 📤 Найдено ${pendingResignations.length} новых заявлений для отправки в Discord`);

    for (const resignation of pendingResignations) {
      try {
        const data = resignation.data as any;
        const reason = data?.reason || 'Не указана';
        const agreedToBlacklist = data?.agreedToBlacklist || false; // Читаем флаг ДО обновления

        // Получаем пользователя Discord
        const discordUser = await client.users.fetch(resignation.user.discordId).catch(() => null);
        
        // Получаем member для доступа к displayName (нику на сервере)
        const member = await guild.members.fetch(resignation.user.discordId).catch(() => null);
        const displayName = member?.displayName || resignation.user.displayName || resignation.user.username;
        
        // Извлекаем имя из формата "Prefix | Имя Фамилия | ID"
        const username = extractNameFromDisplayName(displayName);
        const staticId = extractStaticFromDisplayName(displayName);
        const department = getDepartmentFromRoles(member);
        const avatar = discordUser?.displayAvatarURL() || undefined;

        // Проверяем выговоры и интернатуру по ролям Discord
        const hasWarnings = await checkActiveWarnings(resignation.user.discordId, member);
        const isInternCompleted = await checkInternshipStatus(resignation.user.discordId, member);
        const withBlacklist = hasWarnings || !isInternCompleted;

        console.log(`[Resignation] 📊 Проверка ЧС для ${resignation.user.discordId}:`, {
          hasWarnings,
          isInternCompleted,
          withBlacklist,
          agreedToBlacklist,
        });

        // Маппинг статусов заявления
        const statusMap = {
          PENDING: '🟡 Новая заявка',
          IN_REVIEW: '🔵 В рассмотрении',
          APPROVED: '✅ Принято',
          REJECTED: '❌ Отказано',
        };
        const statusText = statusMap[resignation.status as keyof typeof statusMap] || '🟡 Новая заявка';

        // Создаём embed (копируем структуру из отпусков)
        const embed = new EmbedBuilder()
          .setColor(withBlacklist ? 0xe74c3c : 0xf39c12) // Красный если с ЧС, оранжевый если без
          .setTitle('<:resignation:1566148263067783198> Новое заявление на увольнение')
          .setDescription(`**${username}** подал(а) заявление на увольнение`)
          .addFields(
            { name: '👤 Пользователь', value: `<@${resignation.user.discordId}>`, inline: true },
            { name: '🏢 Отдел', value: department, inline: true },
            { name: '🆔 Static', value: staticId, inline: true },
            { name: '⚠️ Статус', value: statusText, inline: true },
            { name: '📝 Причина', value: reason || 'Не указана', inline: false }
          )
          .setThumbnail(avatar || null)
          .setFooter({ text: `ID заявления: ${resignation.id} • Сегодня, в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` })
          .setTimestamp();

        // Добавляем детали о ЧС если есть
        if (withBlacklist) {
          const reasons: string[] = [];
          if (hasWarnings) reasons.push('• Активные выговоры');
          if (!isInternCompleted) reasons.push('• Интернатура не завершена');
          embed.addFields({
            name: '⚠️ Причины увольнения с ЧС',
            value: reasons.join('\n'),
            inline: false,
          });
        }
        
        // Добавляем поле согласия ВСЕГДА (если с ЧС)
        if (withBlacklist) {
          embed.addFields({
            name: '✅ Согласие',
            value: agreedToBlacklist ? 'С черным списком согласен ✅' : 'С черным списком не согласен ❌',
            inline: false,
          });
        }

        // Создаём кнопки
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`resignation_review_${resignation.id}`)
              .setLabel('В рассмотрении')
              .setStyle(ButtonStyle.Primary)
          );

        // Определяем роль для пинга
        const rolesToPing = ['<@&1482048390148784234>'];

        // Отправляем сообщение с пингом ролей
        const message = await channel.send({
          content: rolesToPing.join(' '),
          embeds: [embed],
          components: [row],
        });

        // Помечаем заявление как отправленное
        await prisma.application.update({
          where: { id: resignation.id },
          data: {
            reviewNote: `discord_message_${message.id}`,
            updatedAt: new Date(),
          },
        });

        console.log(`[Resignation] ✅ Заявление ${resignation.id} отправлено в Discord (message: ${message.id})`);
      } catch (error) {
        console.error(`[Resignation] ❌ Ошибка отправки заявления ${resignation.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[Resignation] ❌ Критическая ошибка при отправке заявлений:', error);
  }
}

/**
 * Проверяет наличие активных выговоров у пользователя по ролям Discord
 */
async function checkActiveWarnings(discordId: string, member: any): Promise<boolean> {
  // Роли выговоров в Discord
  const WARNING_ROLE_IDS = [
    '1482048390136070330', // Выговор 1
    '1482048390136070332', // Выговор 2
    '1482048390136070333', // Выговор 3
    '1482048390136070331', // Выговор 4
  ];

  if (!member) return false;

  // Проверяем наличие любой роли выговора
  for (const roleId of WARNING_ROLE_IDS) {
    if (member.roles.cache.has(roleId)) {
      console.log(`[Resignation] ⚠️ У пользователя ${discordId} есть роль выговора: ${roleId}`);
      return true;
    }
  }

  return false;
}

/**
 * Проверяет завершение интернатуры пользователем по роли Discord
 */
async function checkInternshipStatus(discordId: string, member: any): Promise<boolean> {
  const INTERN_ROLE_ID = '1482048390136070326';

  if (!member) return true; // Если member не найден, считаем что интернатура завершена

  // Если у пользователя есть роль интерна - интернатура НЕ завершена
  const isIntern = member.roles.cache.has(INTERN_ROLE_ID);
  
  if (isIntern) {
    console.log(`[Resignation] 👨‍🎓 Пользователь ${discordId} является интерном`);
  }

  return !isIntern; // true = завершена, false = не завершена
}

// ==========================================
// Обработка одобренных отпусков
// ==========================================

async function processApprovedVacations(client: Client): Promise<void> {
  try {
    const today = getTodayDateString();

    // Получаем guild
    const guild: Guild | undefined = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (!guild) {
      console.error('[Vacation] ❌ Guild не найден:', CONFIG.GUILD_ID);
      return;
    }

    // Получаем все одобренные заявки на отпуск
    const approvedVacations = await prisma.application.findMany({
      where: {
        type: 'VACATION',
        status: 'APPROVED',
      },
      include: {
        user: true,
      },
    });

    if (approvedVacations.length === 0) {
      return;
    }

    let rolesAdded = 0;
    let rolesRemoved = 0;
    let errors = 0;

    for (const vacation of approvedVacations) {
      try {
        const data = vacation.data as any;
        const vacationType = data.vacationType || '';
        const startDate = data.startDate || '';
        const endDate = data.endDate || '';
        const discordId = vacation.user.discordId;

        if (!discordId || !vacationType || !startDate || !endDate) {
          continue;
        }

        // Определяем роль в зависимости от типа отпуска
        const roleId = vacationType.toUpperCase() === 'OOC' 
          ? CONFIG.VACATION_OOC_ROLE_ID 
          : CONFIG.VACATION_IC_ROLE_ID;

        if (!roleId) {
          continue;
        }

        // Получаем member
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) {
          continue;
        }

        // Выдача роли в день начала отпуска
        if (startDate === today) {
          const hasRole = member.roles.cache.has(roleId);
          if (!hasRole) {
            await member.roles.add(roleId);
            console.log(`[Vacation-Start] ✅ Выдана роль ${vacationType} пользователю ${member.user.tag}`);
            rolesAdded++;
          }
        }

        // Снятие роли в день окончания отпуска
        if (endDate === today) {
          const hasRole = member.roles.cache.has(roleId);
          if (hasRole) {
            await member.roles.remove(roleId);
            console.log(`[Vacation-End] ✅ Удалена роль ${vacationType} у пользователя ${member.user.tag}`);
            rolesRemoved++;

            // Обновляем статус заявки на завершённую
            await prisma.application.update({
              where: { id: vacation.id },
              data: { 
                status: 'COMPLETED',
                updatedAt: new Date(),
              },
            });
          }
        }
      } catch (error) {
        console.error(`[Vacation] ❌ Ошибка обработки отпуска ${vacation.id}:`, error);
        errors++;
      }
    }

    if (rolesAdded > 0 || rolesRemoved > 0) {
      console.log(`[Vacation] 📊 Выдано ролей: ${rolesAdded}, снято ролей: ${rolesRemoved}`);
    }
  } catch (error) {
    console.error('[Vacation] ❌ Критическая ошибка:', error);
  }
}

// ==========================================
// Основная функция проверки
// ==========================================

async function checkVacations(client: Client): Promise<void> {
  await sendPendingVacationsToDiscord(client);
  await sendPendingResignationsToDiscord(client);
  await processApprovedVacations(client);
}

// ==========================================
// Инициализация модуля
// ==========================================

let intervalId: NodeJS.Timeout | null = null;

export function startVacationModule(client: Client): void {
  console.log('🚀 [Vacation] Модуль отпусков и увольнений запущен');
  console.log(`📡 [Vacation] Проверка каждые ${CONFIG.CHECK_INTERVAL / 1000} секунд`);
  console.log(`📮 [Vacation] Канал для отпусков: ${CONFIG.VACATION_CHANNEL_ID}`);
  console.log(`📋 [Resignation] Канал для увольнений: ${CONFIG.RESIGNATION_CHANNEL_ID}`);
  console.log(`🏖️ [Vacation] OOC роль: ${CONFIG.VACATION_OOC_ROLE_ID}`);
  console.log(`🏖️ [Vacation] IC роль: ${CONFIG.VACATION_IC_ROLE_ID}`);

  // Проверка сразу при запуске
  checkVacations(client).catch(error => {
    console.error('[Vacation] ❌ Ошибка начальной проверки:', error);
  });

  // Периодическая проверка
  intervalId = setInterval(() => {
    checkVacations(client).catch(error => {
      console.error('[Vacation] ❌ Ошибка периодической проверки:', error);
    });
  }, CONFIG.CHECK_INTERVAL);
}

export function stopVacationModule(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('🛑 [Vacation] Модуль отпусков и увольнений остановлен');
  }
}
