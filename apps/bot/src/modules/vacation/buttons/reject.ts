/**
 * 🏖️ ОБРАБОТЧИК: Отклонение заявки на отпуск
 */

import { ButtonInteraction, Client, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { prisma } from '@majestic/database';

// Роли, имеющие доступ к отклонению заявок
const OOC_APPROVER_ROLES = [
  '1482048390157303914',
  '1482048390157303913',
];

const IC_APPROVER_ROLES = [
  '1482048390157303914',
  '1482048390157303913',
  '1550078792813256754',
  '1550899527450632362',
  '1482048390148784234',
  '1482048390148784230',
];

/**
 * Проверяет, имеет ли пользователь право отклонять заявку
 */
function hasApprovalPermission(interaction: ButtonInteraction, vacationType: string): boolean {
  const member = interaction.member;
  if (!member || !('roles' in member)) return false;

  const allowedRoles = vacationType.toUpperCase() === 'OOC' ? OOC_APPROVER_ROLES : IC_APPROVER_ROLES;
  
  return allowedRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Обработчик кнопки "Отклонить" - показывает модальное окно для причины
 */
export async function handleVacationReject(interaction: ButtonInteraction, client: Client): Promise<void> {
  try {
    // Извлекаем ID заявки из customId кнопки
    const applicationId = interaction.customId.replace('vacation_reject_', '');

    console.log(`[Vacation-Reject] 📝 Запрос модального окна для отклонения заявки: ${applicationId}`);

    // Получаем заявку из БД для проверки типа отпуска
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      await interaction.reply({
        content: '❌ Заявка не найдена в базе данных!',
        ephemeral: true,
      });
      return;
    }

    const data = application.data as any;
    const vacationType = data?.vacationType || 'N/A';

    // Проверяем права доступа
    if (!hasApprovalPermission(interaction, vacationType)) {
      await interaction.reply({
        content: `❌ У вас нет прав для отклонения ${vacationType.toUpperCase()} отпусков!`,
        ephemeral: true,
      });
      console.log(`[Vacation-Reject] ⛔ Доступ запрещен для ${interaction.user.tag} (тип: ${vacationType})`);
      return;
    }
    // Создаём модальное окно для ввода причины отклонения
    const modal = new ModalBuilder()
      .setCustomId(`vacation_reject_modal_${applicationId}`)
      .setTitle('Отклонение заявки на отпуск');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reject_reason')
      .setLabel('Причина отклонения')
      .setPlaceholder('Укажите причину отклонения заявки...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  } catch (error) {
    console.error('[Vacation-Reject] ❌ Ошибка при показе модального окна:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Произошла ошибка при обработке запроса.',
        ephemeral: true,
      });
    }
  }
}

/**
 * Обработчик модального окна для отклонения заявки
 */
export async function handleVacationRejectModal(interaction: any, client: Client): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Извлекаем ID заявки из customId модального окна
    const applicationId = interaction.customId.replace('vacation_reject_modal_', '');
    const rejectReason = interaction.fields.getTextInputValue('reject_reason');

    console.log(`[Vacation-Reject] 📝 Обработка отклонения заявки: ${applicationId}`);

    // Получаем заявку из БД
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      await interaction.editReply({
        content: '❌ Заявка не найдена в базе данных!',
      });
      return;
    }

    // Проверяем статус заявки
    if (application.status !== 'PENDING') {
      await interaction.editReply({
        content: `⚠️ Эта заявка уже обработана! Текущий статус: **${application.status}**`,
      });
      return;
    }

    const data = application.data as any;
    const vacationType = data?.vacationType || 'N/A';
    const startDate = data?.startDate || 'N/A';
    const endDate = data?.endDate || 'N/A';

    // Обновляем статус заявки
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        reviewedBy: interaction.user.id,
        reviewedAt: new Date(),
        reviewNote: `discord_message_rejected: ${rejectReason}`,
        updatedAt: new Date(),
      },
    });

    console.log(`[Vacation-Reject] ✅ Заявка ${applicationId} отклонена пользователем ${interaction.user.tag}`);

    // Обновляем embed сообщения
    const message = await interaction.channel?.messages.fetch(interaction.message.id);
    if (message) {
      const originalEmbed = message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setColor(0xff0000) // Красный цвет для отклонённой заявки
        .addFields(
          {
            name: '❌ Статус',
            value: `Отклонено пользователем <@${interaction.user.id}>`,
            inline: false,
          },
          {
            name: '📝 Причина отклонения',
            value: rejectReason,
            inline: false,
          }
        );

      // Удаляем кнопки и обновляем сообщение
      await message.edit({
        embeds: [updatedEmbed],
        components: [],
      });
    }

    // Уведомляем модератора
    const reply = await interaction.editReply({
      content: `✅ Заявка **${applicationId}** успешно отклонена!\n\n` +
        `👤 Пользователь: <@${application.user.discordId}>\n` +
        `📅 Тип: **${vacationType}**\n` +
        `📆 Даты: **${startDate}** → **${endDate}**\n` +
        `📝 Причина: **${rejectReason}**`,
    });

    // Автоматически удаляем сообщение через 5 секунд
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
        console.log(`[Vacation-Reject] 🗑️ Ephemeral сообщение удалено через 5 секунд`);
      } catch (error) {
        console.error(`[Vacation-Reject] ❌ Не удалось удалить ephemeral сообщение:`, error);
      }
    }, 5000);

    // Отправляем уведомление пользователю
    try {
      const discordUser = await client.users.fetch(application.user.discordId);
      await discordUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Ваша заявка на отпуск отклонена')
            .setDescription(
              `Ваша заявка на отпуск была отклонена модератором <@${interaction.user.id}>.`
            )
            .addFields(
              { name: '📅 Тип отпуска', value: vacationType, inline: true },
              { name: '📆 Начало', value: startDate, inline: true },
              { name: '📆 Окончание', value: endDate, inline: true }
            )
            .addFields({
              name: '📝 Причина отклонения',
              value: rejectReason,
              inline: false,
            })
            .setFooter({ text: `ID заявки: ${applicationId}` })
            .setTimestamp(),
        ],
      });
      console.log(`[Vacation-Reject] 📨 Уведомление отправлено пользователю ${discordUser.tag}`);
    } catch (error) {
      console.error(`[Vacation-Reject] ❌ Не удалось отправить уведомление пользователю:`, error);
    }
  } catch (error) {
    console.error('[Vacation-Reject] ❌ Ошибка при отклонении заявки:', error);
    
    const errorMessage = '❌ Произошла ошибка при обработке заявки. Попробуйте позже.';
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
