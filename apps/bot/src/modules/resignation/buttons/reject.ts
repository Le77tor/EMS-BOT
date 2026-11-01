/**
 * ❌ ОБРАБОТЧИК: Отклонение заявления на увольнение
 * 
 * Запрашивает причину отказа в модальном окне
 */

import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { prisma } from '@majestic/database';

const RESIGNATION_APPROVER_ROLES = [
  '1482048390148784234', // IN Management
  '1550899527450632362',
  '1482048390157303913',
  '1482048390157303914',
];

export async function handleResignationReject(interaction: ButtonInteraction, applicationId: string): Promise<void> {
  try {
    // Проверка прав
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      const reply = await interaction.reply({ content: '❌ Не удалось получить информацию о вашем участии на сервере.', ephemeral: true });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const hasRole = RESIGNATION_APPROVER_ROLES.some(roleId => member.roles.cache.has(roleId));
    if (!hasRole) {
      const reply = await interaction.reply({ content: '❌ У вас нет прав для отклонения заявлений на увольнение.', ephemeral: true });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Проверяем заявление
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      const reply = await interaction.reply({ content: '❌ Заявление не найдено.', ephemeral: true });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    if (application.status !== 'REVIEWED') {
      const reply = await interaction.reply({ content: '❌ Заявление должно быть сначала взято в рассмотрение.', ephemeral: true });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Создаём модальное окно для ввода причины отказа
    const modal = new ModalBuilder()
      .setCustomId(`resignation_reject_modal_${applicationId}`)
      .setTitle('Отклонение заявления на увольнение');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reject_reason')
      .setLabel('Причина отказа')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Укажите причину отклонения заявления...')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);

    console.log(`[Resignation-Reject] 📝 Модальное окно отправлено пользователю ${interaction.user.tag} для заявления ${applicationId}`);
  } catch (error) {
    console.error('[Resignation-Reject] ❌ Ошибка:', error);
    const reply = await interaction.reply({ content: '❌ Произошла ошибка при обработке заявления.', ephemeral: true });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
  }
}

/**
 * Обработчик отправки модального окна с причиной отказа
 */
export async function handleResignationRejectModal(interaction: any, applicationId: string): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const rejectReason = interaction.fields.getTextInputValue('reject_reason');

    // Получаем заявление
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      const reply = await interaction.editReply({ content: '❌ Заявление не найдено.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Обновляем статус заявления
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        reviewNote: rejectReason,
        reviewedBy: interaction.user.id,
        reviewedAt: new Date(),
      },
    });

    // Обновляем embed в Discord
    const message = await interaction.channel?.messages.fetch(interaction.message.id).catch(() => null);
    if (message && message.embeds.length > 0) {
      const originalEmbed = EmbedBuilder.from(message.embeds[0]);
      originalEmbed.setColor(0xe74c3c); // Красный
      originalEmbed.addFields(
        {
          name: '❌ Решение',
          value: `Заявление **отклонено** пользователем <@${interaction.user.id}>`,
          inline: false,
        },
        {
          name: '📝 Причина отказа',
          value: rejectReason,
          inline: false,
        }
      );

      await message.edit({
        embeds: [originalEmbed],
        components: [], // Убираем все кнопки
      });
    }

    // Уведомляем пользователя (опционально, можно отправить DM)
    try {
      const user = await interaction.client.users.fetch(application.user.discordId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('❌ Заявление на увольнение отклонено')
            .setDescription('Ваше заявление на увольнение было отклонено.')
            .addFields(
              { name: '📝 Причина отказа', value: rejectReason, inline: false }
            )
            .setTimestamp()
        ]
      });
      console.log(`[Resignation-Reject] 📧 Уведомление отправлено пользователю ${user.tag}`);
    } catch (error) {
      console.error(`[Resignation-Reject] ⚠️ Не удалось отправить DM пользователю:`, error);
    }

    const reply = await interaction.editReply({ 
      content: `✅ Заявление на увольнение отклонено!\n\n📝 Причина: ${rejectReason}` 
    });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);

    console.log(`[Resignation-Reject] ✅ Заявление ${applicationId} отклонено пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('[Resignation-Reject-Modal] ❌ Ошибка:', error);
    
    const errorMessage = '❌ Произошла ошибка при обработке заявления.';
    
    if (interaction.deferred) {
      const reply = await interaction.editReply({ content: errorMessage });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    } else {
      const reply = await interaction.reply({ content: errorMessage, ephemeral: true });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }
  }
}
