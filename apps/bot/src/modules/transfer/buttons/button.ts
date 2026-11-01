/**
 * 🔄 ОБРАБОТЧИК: Кнопка "Перевод в отдел" - показывает выпадающий список отделов
 */

import { 
  ButtonInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder 
} from 'discord.js';

export async function handleTransferButton(interaction: ButtonInteraction): Promise<void> {
  try {
    // Создаём выпадающий список с выбором отдела
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('transfer_department_select')
      .setPlaceholder('Выберите отдел для перевода')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('DI')
          .setDescription('Department of Internal Affairs')
          .setValue('DI')
          .setEmoji('🔍'),
        new StringSelectMenuOptionBuilder()
          .setLabel('HAD')
          .setDescription('Health Affairs Department')
          .setValue('HAD')
          .setEmoji('⚕️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('PSED')
          .setDescription('Public Safety and Emergency Department')
          .setValue('PSED')
          .setEmoji('🚨'),
        new StringSelectMenuOptionBuilder()
          .setLabel('DES')
          .setDescription('Department of Education and Services')
          .setValue('DES')
          .setEmoji('📚'),
        new StringSelectMenuOptionBuilder()
          .setLabel('PM')
          .setDescription('Public Management')
          .setValue('PM')
          .setEmoji('🏛️')
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: '🔄 **Перевод между отделами**\n\nВыберите отдел, в который вы хотите перевестись:',
      components: [row],
      ephemeral: true,
    });

    console.log(`[Transfer-Button] ✅ Пользователь ${interaction.user.tag} открыл меню выбора отдела`);
  } catch (error) {
    console.error('[Transfer-Button] ❌ Ошибка:', error);
    const reply = await interaction.reply({ 
      content: '❌ Произошла ошибка при открытии меню выбора отдела.', 
      ephemeral: true 
    });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
  }
}
