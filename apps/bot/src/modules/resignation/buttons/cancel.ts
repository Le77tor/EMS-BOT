/**
 * 🔄 ОБРАБОТЧИК: Отмена рассмотрения заявления на увольнение
 * 
 * Возвращает заявление в статус PENDING
 */

import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '@majestic/database';

const RESIGNATION_APPROVER_ROLES = [
  '1482048390148784234', // IN Management
  '1550899527450632362',
  '1482048390157303913',
  '1482048390157303914',
];

export async function handleResignationCancel(interaction: ButtonInteraction, applicationId: string): Promise<void> {
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
      const reply = await interaction.editReply({ content: '❌ У вас нет прав для отмены рассмотрения заявлений.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Получаем заявление
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      const reply = await interaction.editReply({ content: '❌ Заявление не найдено.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    if (application.status !== 'REVIEWED') {
      const reply = await interaction.editReply({ content: '❌ Это заявление не находится в рассмотрении.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Возвращаем статус на PENDING
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'PENDING',
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    // Обновляем embed - удаляем поле "Рассматривает"
    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    
    // Создаём новый embed без поля "Рассматривает"
    const newEmbed = new EmbedBuilder()
      .setColor(originalEmbed.data.color || 0xf39c12)
      .setTitle(originalEmbed.data.title || '')
      .setDescription(originalEmbed.data.description || '')
      .setThumbnail(originalEmbed.data.thumbnail?.url || null);
    
    // Устанавливаем footer если есть
    if (originalEmbed.data.footer) {
      newEmbed.setFooter(originalEmbed.data.footer);
    }
    
    // Устанавливаем timestamp если есть (не null!)
    if (originalEmbed.data.timestamp) {
      newEmbed.setTimestamp(new Date(originalEmbed.data.timestamp));
    }

    // Копируем все поля кроме "Рассматривает" и обновляем статус
    if (originalEmbed.data.fields) {
      for (const field of originalEmbed.data.fields) {
        if (field.name === '⚠️ Статус') {
          // Обновляем статус на "Новая заявка"
          newEmbed.addFields({ name: field.name, value: '🟡 Новая заявка', inline: field.inline });
        } else if (field.name !== '👀 Рассматривает') {
          newEmbed.addFields(field);
        }
      }
    }

    // Возвращаем начальную кнопку
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`resignation_review_${applicationId}`)
          .setLabel('В рассмотрении')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.message.edit({
      embeds: [newEmbed],
      components: [row],
    });

    const reply = await interaction.editReply({ content: '✅ Рассмотрение заявления отменено. Заявление возвращено в статус "В ожидании".' });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);

    console.log(`[Resignation-Cancel] ✅ Рассмотрение заявления ${applicationId} отменено пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('[Resignation-Cancel] ❌ Ошибка:', error);
    
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
