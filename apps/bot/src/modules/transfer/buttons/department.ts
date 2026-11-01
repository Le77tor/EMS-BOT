/**
 * 🏢 ОБРАБОТЧИК: Кнопки отделов (Отдел DI, Отдел PM и т.д.)
 */

import { 
  ButtonInteraction, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import { DEPARTMENT_ROLES, type DepartmentType } from '../constants.js';

export async function handleDepartmentButton(interaction: ButtonInteraction): Promise<void> {
  try {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const department = parts[2] as DepartmentType;
    const applicationId = parts[3];
    
    // Получаем ID оригинального сообщения с заявкой
    const originalMessageId = interaction.message.id;
    
    console.log(`[Transfer-Department] 📋 Original message ID: ${originalMessageId}`);

    // Проверяем права доступа
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      const reply = await interaction.reply({ 
        content: '❌ Не удалось получить информацию о вашем участии на сервере.', 
        ephemeral: true 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const allowedRoles = DEPARTMENT_ROLES[department];
    const hasAccess = allowedRoles.some(roleId => member.roles.cache.has(roleId));

    if (!hasAccess) {
      const reply = await interaction.reply({ 
        content: `❌ У вас нет прав для рассмотрения заявок от отдела ${department}.`, 
        ephemeral: true 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Создаём кнопки выбора действия с ID оригинального сообщения
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`transfer_approve_${department}_${applicationId}_${originalMessageId}`)
          .setLabel('✅ Одобрить')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`transfer_reject_${department}_${applicationId}_${originalMessageId}`)
          .setLabel('❌ Отклонить')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`transfer_cancel_${department}_${applicationId}`)
          .setLabel('🔄 Отменить')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({
      content: `Выберите действие для заявки (отдел ${department}):`,
      components: [row],
      ephemeral: true,
    });

    console.log(`[Transfer-Department] 📋 Пользователь ${interaction.user.tag} открыл меню действий для отдела ${department}`);
  } catch (error) {
    console.error('[Transfer-Department] ❌ Ошибка:', error);
    const reply = await interaction.reply({ 
      content: '❌ Произошла ошибка при обработке запроса.', 
      ephemeral: true 
    });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
  }
}

/**
 * Обработчик кнопки "Отменить" (возврат к выбору отдела)
 */
export async function handleCancelButton(interaction: ButtonInteraction): Promise<void> {
  try {
    await interaction.update({
      content: '❌ Действие отменено.',
      components: [],
    });

    setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
  } catch (error) {
    console.error('[Transfer-Cancel] ❌ Ошибка:', error);
  }
}
