import type { ButtonInteraction, Client, GuildMember, TextChannel } from 'discord.js';
import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { prisma } from '@majestic/database';

/**
 * 🔵 КНОПКА "ВЫЗВАТЬ НА ОБЗВОН"
 * 
 * 1. Отправляется select menu (спойлер) для выбора голосового канала
 * 2. Доступны 3 голосовых канала: 1482048392543731726, 1482048392543731725, 1527082710697377963
 * 3. Пользователю отправляется ЛС о вызове на обзвон
 * 4. В эмбеде обновляется информация о приглашении на обзвон
 */

const VOICE_CHANNELS = [
  { id: '1482048392543731726', name: 'Голосовой канал #1' },
  { id: '1482048392543731725', name: 'Голосовой канал #2' },
  { id: '1527082710697377963', name: 'Голосовой канал #3' },
];

// 🔒 РОЛИ С ДОСТУПОМ К КНОПКАМ
const ALLOWED_ROLES = [
  '1482048390157303914',
  '1482048390157303913',
  '1550078792813256754',
  '1552362101866102895',
  '1482048390148784239',
  '1482048390148784233',
  '1482048390148784234',
  '1482048390136070329',
];

export async function handleEmploymentCall(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  try {
    // 🔒 ПРОВЕРКА РОЛЕЙ
    const member = interaction.member as GuildMember;
    const hasPermission = member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));

    if (!hasPermission) {
      await interaction.reply({
        content: '❌ У вас нет прав для использования этой кнопки.',
        ephemeral: true
      });
      return;
    }

    // Извлекаем ID заявки
    const applicationId = interaction.customId.split('_')[2];

    // Создаём select menu для выбора голосового канала
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`employment_call_select_${applicationId}`)
      .setPlaceholder('🎧 Выберите голосовой канал для обзвона')
      .addOptions(
        VOICE_CHANNELS.map(vc =>
          new StringSelectMenuOptionBuilder()
            .setLabel(vc.name)
            .setValue(vc.id)
            .setEmoji('🎤')
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: '📞 **Выберите голосовой канал для обзвона:**',
      components: [row],
      ephemeral: true
    });

  } catch (error) {
    console.error('❌ [Call Button] Ошибка:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Произошла ошибка при открытии меню выбора канала.',
        ephemeral: true
      });
    }
  }
}

/**
 * Обработчик выбора голосового канала
 */
export async function handleEmploymentCallSelect(
  interaction: any,
  client: Client
): Promise<void> {
  try {
    await interaction.deferUpdate();

    // Извлекаем ID заявки и выбранный канал
    const applicationId = interaction.customId.split('_')[3];
    const selectedChannelId = interaction.values[0];

    // Получаем заявку из БД
    const application = await prisma.employmentApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      await interaction.followUp({
        content: '❌ Заявка не найдена.',
        ephemeral: true
      });
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await interaction.followUp({
        content: '❌ Сервер не найден.',
        ephemeral: true
      });
      return;
    }

    // Получаем участника
    const member = await guild.members.fetch(application.discordId).catch(() => null);
    if (!member) {
      await interaction.followUp({
        content: '❌ Пользователь не найден на сервере.',
        ephemeral: true
      });
      return;
    }

    // Получаем HR-сотрудника, который вызывает
    const hrMember = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!hrMember) {
      await interaction.followUp({
        content: '❌ Не удалось получить информацию о вашем профиле.',
        ephemeral: true
      });
      return;
    }

    // Получаем информацию о выбранном голосовом канале
    const voiceChannel = VOICE_CHANNELS.find(vc => vc.id === selectedChannelId);
    const voiceChannelMention = `<#${selectedChannelId}>`;

    // 📩 ОТПРАВЛЯЕМ ЛС КАНДИДАТУ
    try {
      const user = await client.users.fetch(application.discordId);
      await user.send(
        `📞 **Вы приглашены на обзвон!**\n\n` +
        `Сотрудник ${hrMember} приглашает вас на собеседование в голосовом канале ${voiceChannelMention}.\n\n` +
        `Пожалуйста, присоединитесь к каналу как можно скорее. Удачи! 🎤`
      );
      console.log(`✅ ЛС о вызове на обзвон отправлено пользователю ${application.discordId}`);
    } catch (error) {
      console.error('❌ Не удалось отправить ЛС:', error);
    }

    // 📝 ОБНОВЛЯЕМ ЭМБЕД В КАНАЛЕ
    const channel = interaction.channel as TextChannel;
    if (channel) {
      const updatedEmbed = new EmbedBuilder()
        .setTitle('📞 Кандидат приглашён на обзвон')
        .setColor(0x3b82f6) // Blue
        .addFields(
          {
            name: '👤 Кандидат',
            value: `${application.firstName} ${application.lastName} (<@${application.discordId}>)`,
            inline: false
          },
          {
            name: '🎤 Голосовой канал',
            value: voiceChannelMention,
            inline: false
          },
          {
            name: '👔 Проводит обзвон',
            value: `${hrMember}`,
            inline: false
          },
          {
            name: '⏰ Время приглашения',
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false
          }
        )
        .setTimestamp();

      await channel.send({ embeds: [updatedEmbed] });
    }

    // 💾 ОБНОВЛЯЕМ СТАТУС В БД
    await prisma.employmentApplication.update({
      where: { id: applicationId },
      data: {
        status: 'IN_REVIEW',
        updatedAt: new Date()
      }
    });

    await interaction.followUp({
      content: `✅ Кандидат **${application.firstName} ${application.lastName}** приглашён на обзвон в ${voiceChannelMention}!`,
      ephemeral: true
    });

  } catch (error) {
    console.error('❌ [Call Select] Ошибка:', error);
    console.error('❌ [Call Select] Stack:', error instanceof Error ? error.stack : 'No stack');
    
    try {
      await interaction.followUp({
        content: `❌ Произошла ошибка при обработке приглашения на обзвон.\n\nДетали: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        ephemeral: true
      });
    } catch (followUpError) {
      console.error('❌ Не удалось отправить сообщение об ошибке:', followUpError);
    }
  }
}
