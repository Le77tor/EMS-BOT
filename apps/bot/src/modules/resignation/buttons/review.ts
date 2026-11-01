/**
 * 📋 ОБРАБОТЧИК: Взятие заявления на увольнение в рассмотрение
 */

import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '@majestic/database';

// Роли с доступом к рассмотрению увольнений
const RESIGNATION_APPROVER_ROLES = [
  '1482048390148784234', // IN Management
  '1550899527450632362',
  '1482048390157303913',
  '1482048390157303914',
];

export async function handleResignationReview(interaction: ButtonInteraction, applicationId: string): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Проверка прав
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      const reply = await interaction.editReply({ content: '❌ Не удалось получить информацию о вашем участии на сервере.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const hasRole = RESIGNATION_APPROVER_ROLES.some(roleId => member.roles.cache.has(roleId));
    if (!hasRole) {
      const reply = await interaction.editReply({ content: '❌ У вас нет прав для рассмотрения заявлений на увольнение.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

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

    if (application.status !== 'PENDING') {
      const reply = await interaction.editReply({ content: '❌ Это заявление уже обработано.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Обновляем статус на REVIEWED
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'REVIEWED',
        reviewedBy: interaction.user.id,
        reviewedAt: new Date(),
      },
    });

    // Обновляем embed
    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    
    // Обновляем поле статуса
    const fields = originalEmbed.data.fields || [];
    const statusFieldIndex = fields.findIndex(f => f.name === '⚠️ Статус');
    if (statusFieldIndex !== -1) {
      fields[statusFieldIndex].value = '🔵 В рассмотрении';
    }
    
    // Добавляем поле "Рассматривает"
    originalEmbed.addFields({
      name: '👀 Рассматривает',
      value: `<@${interaction.user.id}>`,
      inline: false,
    });

    // Создаём новые кнопки: Принять, Отказать, Отменить рассмотрение
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`resignation_accept_${applicationId}`)
          .setLabel('✅ Принять')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`resignation_reject_${applicationId}`)
          .setLabel('❌ Отказать')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`resignation_cancel_${applicationId}`)
          .setLabel('🔄 Отменить рассмотрение')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.message.edit({
      embeds: [originalEmbed],
      components: [row],
    });

    const reply = await interaction.editReply({ content: '✅ Вы взяли заявление в рассмотрение!' });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);

    console.log(`[Resignation-Review] ✅ Заявление ${applicationId} взято на рассмотрение пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('[Resignation-Review] ❌ Ошибка:', error);
    const reply = await interaction.editReply({ content: '❌ Произошла ошибка при обработке заявления.' });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
  }
}
