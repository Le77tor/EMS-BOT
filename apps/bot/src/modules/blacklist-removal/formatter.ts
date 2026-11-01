import { EmbedBuilder } from 'discord.js';
import type { BlacklistRemoval } from '@majestic/database';

/**
 * Цвета для разных статусов заявок
 */
export const STATUS_COLORS = {
  PENDING: 0xFFD700,     // 🟡 Желтый - Новая заявка
  IN_REVIEW: 0x3498DB,   // 🔵 Синий - В рассмотрении
  APPROVED: 0x2ECC71,    // 🟢 Зеленый - Принята
  REJECTED: 0xE74C3C,    // 🔴 Красный - Отклонена
} as const;

/**
 * Эмодзи для статусов
 */
export const STATUS_EMOJI = {
  PENDING: '🆕',
  IN_REVIEW: '👀',
  APPROVED: '✅',
  REJECTED: '❌',
} as const;

/**
 * Названия статусов на русском
 */
export const STATUS_NAMES = {
  PENDING: 'Новая заявка',
  IN_REVIEW: 'В рассмотрении',
  APPROVED: 'Принята',
  REJECTED: 'Отклонена',
} as const;

/**
 * Форматирует заявку на вынесение из ЧС в красивый Discord Embed
 */
export function formatBlacklistRemovalEmbed(
  application: BlacklistRemoval,
  reviewerTag?: string
): EmbedBuilder {
  const status = application.status as keyof typeof STATUS_COLORS;
  const color = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  const emoji = STATUS_EMOJI[status] || STATUS_EMOJI.PENDING;
  const statusName = STATUS_NAMES[status] || STATUS_NAMES.PENDING;

  const embed = new EmbedBuilder()
    .setTitle('📋 Заявление на вынесение из ЧС')
    .setColor(color)
    .addFields(
      {
        name: '📊 Статус',
        value: `${emoji} **${statusName}**`,
        inline: true
      },
      {
        name: '👤 Заявитель',
        value: `**Имя Фамилия:** ${application.firstName} ${application.lastName}\n**Статик:** ${application.static}`,
        inline: false
      },
      {
        name: '🆔 Discord',
        value: `<@${application.discordId}> (\`${application.discordId}\`)`,
        inline: false
      },
      {
        name: '❓ Причина занесения в ЧС',
        value: application.blacklistReason.length > 1024 
          ? application.blacklistReason.substring(0, 1021) + '...' 
          : application.blacklistReason,
        inline: false
      },
      {
        name: '✅ Причина для вынесения',
        value: application.removalReason.length > 1024 
          ? application.removalReason.substring(0, 1021) + '...' 
          : application.removalReason,
        inline: false
      },
      {
        name: '📅 Дата подачи',
        value: `<t:${Math.floor(application.createdAt.getTime() / 1000)}:F>`,
        inline: false
      }
    )
    .setFooter({ text: `ID заявки: ${application.id}` })
    .setTimestamp();

  // Если заявка в рассмотрении, добавляем информацию о проверяющем
  if (status === 'IN_REVIEW' && reviewerTag) {
    embed.addFields({
      name: '👁️ Рассматривает',
      value: reviewerTag,
      inline: false
    });
  }

  // Если заявка отклонена и есть причина, добавляем её
  if (status === 'REJECTED' && application.reviewNote) {
    embed.addFields({
      name: '📝 Причина отказа',
      value: application.reviewNote.length > 1024 
        ? application.reviewNote.substring(0, 1021) + '...' 
        : application.reviewNote,
      inline: false
    });
  }

  return embed;
}

/**
 * Форматирует пинг ролей для сообщения
 */
export function formatRolePings(): string {
  const role1 = '1482048390157303914';
  const role2 = '1482048390157303913';
  
  return `<@&${role1}> <@&${role2}>`;
}

/**
 * Создает сообщение для ЛС при подаче заявки
 */
export function formatDMApplicationSubmitted(application: BlacklistRemoval): string {
  return `✅ **Ваша заявка на вынесение из ЧС успешно подана!**

📋 **Информация о заявке:**
**ID:** \`${application.id}\`
**Статус:** 🆕 Новая заявка

Ваша заявка отправлена на рассмотрение администрации.
Вы получите уведомление о любых изменениях статуса.

_Дата подачи: <t:${Math.floor(application.createdAt.getTime() / 1000)}:F>_`;
}

/**
 * Создает сообщение для ЛС при взятии в рассмотрение
 */
export function formatDMApplicationInReview(application: BlacklistRemoval, reviewerName: string): string {
  return `👀 **Ваша заявка взята в рассмотрение!**

📋 **ID заявки:** \`${application.id}\`
**Статус:** 🔵 В рассмотрении
**Рассматривает:** ${reviewerName}

Администратор начал рассмотрение вашей заявки.
Ожидайте финального решения.`;
}

/**
 * Создает сообщение для ЛС при принятии заявки
 */
export function formatDMApplicationApproved(application: BlacklistRemoval): string {
  return `✅ **Ваша заявка принята!**

📋 **ID заявки:** \`${application.id}\`
**Статус:** 🟢 Принята

Поздравляем! Ваша заявка на вынесение из ЧС была одобрена.
Вы можете вернуться на сервер.`;
}

/**
 * Создает сообщение для ЛС при отклонении заявки
 */
export function formatDMApplicationRejected(application: BlacklistRemoval, reason?: string): string {
  let message = `❌ **Ваша заявка отклонена**

📋 **ID заявки:** \`${application.id}\`
**Статус:** 🔴 Отклонена`;

  if (reason) {
    message += `\n\n**Причина отказа:**\n${reason}`;
  }

  message += `\n\nВы можете подать новую заявку позже.`;

  return message;
}

/**
 * Создает сообщение для ЛС при отмене рассмотрения
 */
export function formatDMApplicationReviewCancelled(application: BlacklistRemoval): string {
  return `↩️ **Рассмотрение вашей заявки отменено**

📋 **ID заявки:** \`${application.id}\`
**Статус:** 🆕 Новая заявка

Рассмотрение вашей заявки было отменено.
Заявка вернулась в статус "Новая заявка" и ожидает рассмотрения.`;
}
