import type { ButtonInteraction, Client, GuildMember, TextChannel } from 'discord.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { prisma, EmploymentStatus } from '@majestic/database';

/**
 * 🔴 КНОПКА "ОТКАЗАТЬ"
 * 
 * 1. Открывается модальное окно для ввода причины отказа
 * 2. Причина отправляется кандидату в ЛС
 * 3. Отправляется отчёт в канал 1517887123775029369
 * 4. Канал удаляется через 10 секунд
 */

const REPORT_CHANNEL_ID = '1517887123775029369'; // Канал для отчётов

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

export async function handleEmploymentReject(
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

    // Извлекаем ID заявки из customId кнопки
    const applicationId = interaction.customId.split('_')[2];

    // Создаём модальное окно
    const modal = new ModalBuilder()
      .setCustomId(`employment_reject_modal_${applicationId}`)
      .setTitle('Отказ кандидату');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reject_reason')
      .setLabel('Причина отказа')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Укажите причину отказа...')
      .setRequired(true)
      .setMaxLength(1000);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  } catch (error) {
    console.error('❌ [Reject Button] Ошибка:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Произошла ошибка при открытии формы.',
        ephemeral: true
      });
    }
  }
}

/**
 * Обработчик отправки модального окна
 */
export async function handleEmploymentRejectModal(
  interaction: any,
  client: Client
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Извлекаем ID заявки
    const applicationId = interaction.customId.split('_')[3];
    const rejectReason = interaction.fields.getTextInputValue('reject_reason');

    // Получаем заявку из БД
    const application = await prisma.employmentApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      await interaction.editReply('❌ Заявка не найдена.');
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply('❌ Сервер не найден.');
      return;
    }

    // Получаем участника
    const member = await guild.members.fetch(application.discordId).catch(() => null);
    if (!member) {
      await interaction.editReply('❌ Пользователь не найден на сервере.');
      return;
    }

    // Получаем информацию о том, кто отказал
    const rejectedBy = interaction.member as GuildMember;

    // 📩 ОТПРАВЛЯЕМ ЛС КАНДИДАТУ О ПРИЧИНЕ ОТКАЗА
    try {
      const user = await client.users.fetch(application.discordId);
      await user.send(
        `❌ **Ваше заявление на трудоустройство отклонено**\n\n` +
        `**Имя Фамилия:** ${application.firstName} ${application.lastName}\n` +
        `**Статик:** ${application.static}\n\n` +
        `**Причина отказа:**\n${rejectReason}\n\n` +
        `Вы можете подать новую заявку позже. Спасибо за интерес к нашей организации.`
      );
      console.log(`✅ ЛС об отказе отправлено пользователю ${application.discordId}`);
    } catch (error) {
      console.error('❌ Не удалось отправить ЛС:', error);
    }

    // 📊 ОТЧЁТ О СОБЕСЕДОВАНИИ (ОТКАЗ)
    try {
      const reportChannel = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null) as TextChannel | null;
      if (reportChannel && reportChannel.isTextBased()) {
        const reportEmbed = new EmbedBuilder()
          .setTitle('📋 Отказ кандидату - Документы')
          .setColor(0xef4444) // Red
          .addFields(
            {
              name: '👤 Проведён собеседование',
              value: `${rejectedBy}`,
              inline: false
            },
            {
              name: '🎫 Имя Фамилия кандидата',
              value: `${application.firstName} ${application.lastName}`,
              inline: true
            },
            {
              name: '🆔 Статик кандидата',
              value: application.static,
              inline: true
            },
            {
              name: '❌ Статус',
              value: 'Не принят',
              inline: false
            },
            {
              name: '📝 Причина отказа',
              value: rejectReason,
              inline: false
            }
          )
          .setFooter({ 
            text: `${rejectedBy.user.username} • Документы по отказу • Сегодня, в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` 
          })
          .setTimestamp();

        await reportChannel.send({ embeds: [reportEmbed] });
        console.log('✅ Отчёт об отказе отправлен в канал отчётов');
      } else {
        console.warn('⚠️ Канал отчётов не найден или нет доступа:', REPORT_CHANNEL_ID);
      }
    } catch (error) {
      console.error('❌ Ошибка отправки отчёта об отказе:', error);
    }

    // 💾 ОБНОВЛЯЕМ СТАТУС В БД
    await prisma.employmentApplication.update({
      where: { id: applicationId },
      data: {
        status: EmploymentStatus.REJECTED,
        reviewNote: rejectReason,
        reviewedBy: rejectedBy.id,
        reviewedAt: new Date(),
        processedAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log('✅ Статус в БД обновлён: REJECTED');

    // ✅ ОТПРАВЛЯЕМ ОТВЕТ
    await interaction.editReply(
      `✅ Кандидат **${application.firstName} ${application.lastName}** получил отказ. Причина отправлена в ЛС, отчёт создан.`
    );

    // 🗑️ УДАЛЯЕМ КАНАЛ ЧЕРЕЗ 10 СЕКУНД
    const channel = interaction.channel as TextChannel;
    if (channel && channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ManageChannels)) {
      setTimeout(async () => {
        try {
          await channel.delete('Заявка обработана - кандидату отказано');
          console.log(`✅ Канал ${channel.name} удалён`);
        } catch (error) {
          console.error('❌ Не удалось удалить канал:', error);
        }
      }, 10000);
    }

  } catch (error) {
    console.error('❌ [Reject Modal] Ошибка:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Произошла ошибка при обработке отказа.',
        ephemeral: true
      });
    } else {
      await interaction.editReply('❌ Произошла ошибка при обработке отказа.');
    }
  }
}
