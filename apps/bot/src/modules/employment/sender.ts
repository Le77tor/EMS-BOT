import type { Client, TextChannel, CategoryChannel } from 'discord.js';
import { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { EmploymentApplication } from '@majestic/database';
import { formatEmploymentEmbed, formatDMApplicationSubmitted } from './formatter.js';

/**
 * ID категории для каналов трудоустройства
 */
const EMPLOYMENT_CATEGORY_ID = '1556721405872185405';

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
 * Создает канал для заявки на трудоустройство
 */
export async function createEmploymentChannel(
  client: Client,
  application: EmploymentApplication
): Promise<string | null> {
  try {
    // Получаем гильдию (предполагается, что бот работает только на одном сервере)
    const guild = client.guilds.cache.first();
    
    if (!guild) {
      console.error('❌ Гильдия не найдена');
      return null;
    }

    // Получаем категорию
    const category = guild.channels.cache.get(EMPLOYMENT_CATEGORY_ID) as CategoryChannel;
    
    if (!category) {
      console.error(`❌ Категория ${EMPLOYMENT_CATEGORY_ID} не найдена`);
      return null;
    }

    // Получаем пользователя
    const user = await client.users.fetch(application.discordId).catch(() => null);
    
    if (!user) {
      console.error(`❌ Пользователь ${application.discordId} не найден`);
      return null;
    }

    // Название канала: заявка-имя-фамилия
    const channelName = `заявка-${application.firstName.toLowerCase()}-${application.lastName.toLowerCase()}`;

    // Создаем канал
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.id, // @everyone
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: client.user!.id, // 🤖 БОТ - ВАЖНО!
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageChannels,
          ],
        },
        {
          id: application.discordId, // Заявитель
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
        // Здесь можно добавить роли HR, которые могут видеть канал
        // Например:
        // {
        //   id: 'HR_ROLE_ID',
        //   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        // },
      ],
    });

    console.log(`✅ Канал создан: ${channel.name} (ID: ${channel.id})`);

    // Формируем embed
    const embed = formatEmploymentEmbed(application);

    // Создаём кнопки
    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`employment_accept_${application.id}`)
          .setLabel('Принять')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`employment_call_${application.id}`)
          .setLabel('Вызвать на обзвон')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📞'),
        new ButtonBuilder()
          .setCustomId(`employment_reject_${application.id}`)
          .setLabel('Отказать')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

    // Отправляем сообщение в канал с упоминанием роли HR
    await channel.send({
      content: `👋 Добро пожаловать, <@${application.discordId}>!\n\n📋 Это ваш канал для заявки на трудоустройство. Здесь вы можете общаться с сотрудниками <@&1482048390136070329>.\n\n**Информация о заявке:**`,
      embeds: [embed],
      components: [buttons],
    });

    // Отправляем ЛС пользователю
    await sendDM(
      client,
      application.discordId,
      formatDMApplicationSubmitted(application)
    );

    return channel.id;
  } catch (error) {
    console.error(`❌ Ошибка при создании канала для заявки ${application.id}:`, error);
    return null;
  }
}

/**
 * Экспортируем функцию для отправки ЛС
 */
export { sendDM };
