import { EmbedBuilder } from 'discord.js';
import type { EmploymentApplication } from '@majestic/database';

/**
 * Создает embed для заявки на трудоустройство
 */
export function formatEmploymentEmbed(
  application: EmploymentApplication
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('📋 Заявление на трудоустройство')
    .setColor(0x3b82f6) // Blue
    .addFields(
      {
        name: '👤 Заявитель',
        value: `**Имя Фамилия:** ${application.firstName} ${application.lastName}\n**Статик:** ${application.static}`,
        inline: false
      },
      {
        name: '🆔 Discord',
        value: `<@${application.discordId}>`,
        inline: false
      },
      {
        name: '✍️ Причина вступления',
        value: application.reason,
        inline: false
      },
      {
        name: '📅 Дата подачи',
        value: `<t:${Math.floor(application.createdAt.getTime() / 1000)}:F>`,
        inline: false
      }
    )
    .setTimestamp();

  return embed;
}

/**
 * Форматирует сообщение ЛС об успешной подаче заявки
 */
export function formatDMApplicationSubmitted(application: EmploymentApplication): string {
  return `📕 **Ваше заявление на трудоустройство получено!**

**Имя Фамилия:** ${application.firstName} ${application.lastName}
**Статик:** ${application.static}

Ваше заявление отправлено на рассмотрение. Для вас создан отдельный канал, где вы сможете общаться с сотрудниками HR отдела.

Ожидайте ответа от наших сотрудников. Спасибо за интерес к нашей организации! 🎉`;
}

/**
 * Форматирует сообщение ЛС об одобрении заявки
 */
export function formatDMApplicationApproved(application: EmploymentApplication): string {
  return `🎉 **Ваше заявление на трудоустройство одобрено!**

**Имя Фамилия:** ${application.firstName} ${application.lastName}
**Статик:** ${application.static}

Поздравляем! Вы приняты в нашу организацию.

Следующие шаги будут обсуждаться в вашем канале для заявок.`;
}

/**
 * Форматирует сообщение ЛС об отклонении заявки
 */
export function formatDMApplicationRejected(
  application: EmploymentApplication,
  reason: string
): string {
  return `❌ **Ваше заявление на трудоустройство отклонено**

**Имя Фамилия:** ${application.firstName} ${application.lastName}
**Статик:** ${application.static}

**Причина отказа:**
${reason}

Вы можете подать новую заявку позже. Спасибо за интерес к нашей организации.`;
}
