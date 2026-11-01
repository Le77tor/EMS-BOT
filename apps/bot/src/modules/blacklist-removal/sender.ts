import type { Client, TextChannel, User } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { BlacklistRemoval } from '@majestic/database';
import { 
  formatBlacklistRemovalEmbed, 
  formatRolePings,
  formatDMApplicationSubmitted 
} from './formatter.js';

/**
 * ID канала для заявок на вынесение из ЧС
 */
const BLACKLIST_REMOVAL_CHANNEL_ID = '1550146159379750923';

/**
 * Создает кнопки для новой заявки
 */
function createPendingButtons(applicationId: string, isBlocked: boolean = false): ActionRowBuilder<ButtonBuilder> {
  const buttons = [];
  
  if (!isBlocked) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`blacklist_review_${applicationId}`)
        .setLabel('👀 Взять в рассмотрение')
        .setStyle(ButtonStyle.Primary)
    );
  }
  
  buttons.push(
    new ButtonBuilder()
      .setCustomId(isBlocked ? `blacklist_unblock_${applicationId}` : `blacklist_block_${applicationId}`)
      .setLabel(isBlocked ? '🔓 Разблокировать' : '🔒 Заблокировать')
      .setStyle(isBlocked ? ButtonStyle.Success : ButtonStyle.Danger)
  );
  
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

/**
 * Создает кнопки для заявки в рассмотрении
 */
function createInReviewButtons(applicationId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`blacklist_approve_${applicationId}`)
      .setLabel('✅ Принять')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`blacklist_reject_${applicationId}`)
      .setLabel('❌ Отказать')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`blacklist_cancel_${applicationId}`)
      .setLabel('↩️ Отменить рассмотрение')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Отправляет ЛС пользователю
 */
async function sendDM(client: Client, discordId: string, message: string): Promise<boolean> {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(message);
    console.log(`✅ ЛС отправлено пользователю ${discordId}`);
    return true;
  } catch (error) {
    console.error(`❌ Не удалось отправить ЛС пользователю ${discordId}:`, error);
    return false;
  }
}

/**
 * Отправляет заявку в Discord канал
 */
export async function sendApplicationToDiscord(
  client: Client,
  application: BlacklistRemoval
): Promise<string | null> {
  try {
    // Получаем канал
    const channel = client.channels.cache.get(BLACKLIST_REMOVAL_CHANNEL_ID);
    
    if (!channel) {
      console.error(`❌ Канал ${BLACKLIST_REMOVAL_CHANNEL_ID} не найден`);
      return null;
    }

    if (!channel.isTextBased()) {
      console.error(`❌ Канал ${BLACKLIST_REMOVAL_CHANNEL_ID} не является текстовым`);
      return null;
    }

    // Формируем embed
    const embed = formatBlacklistRemovalEmbed(application);
    const rolePings = formatRolePings();
    const buttons = createPendingButtons(application.id);

    // Отправляем сообщение
    const message = await (channel as TextChannel).send({
      content: rolePings,
      embeds: [embed],
      components: [buttons],
    });

    console.log(`✅ Заявка ${application.id} отправлена в Discord (ID сообщения: ${message.id})`);
    
    // Отправляем ЛС пользователю
    await sendDM(
      client,
      application.discordId,
      formatDMApplicationSubmitted(application)
    );
    
    return message.id;
  } catch (error) {
    console.error(`❌ Ошибка при отправке заявки ${application.id}:`, error);
    return null;
  }
}

/**
 * Отправляет несколько заявок в Discord
 */
export async function sendMultipleApplications(
  client: Client,
  applications: BlacklistRemoval[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>(); // applicationId -> messageId

  for (const application of applications) {
    const messageId = await sendApplicationToDiscord(client, application);
    
    if (messageId) {
      results.set(application.id, messageId);
    }

    // Задержка между сообщениями, чтобы не спамить
    if (applications.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Экспортируем функции для работы с кнопками
 */
export { createPendingButtons, createInReviewButtons, sendDM };
