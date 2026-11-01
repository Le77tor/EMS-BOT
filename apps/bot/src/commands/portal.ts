import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('portal')
  .setDescription('Получить ссылку на веб-портал');

export async function execute(interaction: ChatInputCommandInteraction) {
  const portalUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  // Создаем кнопки для портала
  const vacationButton = new ButtonBuilder()
    .setCustomId('vacation_submit')
    .setLabel('Заявление на отпуск')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🏖️');

  const resignationButton = new ButtonBuilder()
    .setCustomId('resignation_submit')
    .setLabel('Заявление на увольнение')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('📋');

  const transferButton = new ButtonBuilder()
    .setCustomId('transfer_submit')
    .setLabel('Перевод в отдел')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🔄');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    vacationButton,
    resignationButton,
    transferButton
  );
  
  await interaction.reply({
    content: `🌐 **Веб-портал Majestic CMS**\n\n${portalUrl}\n\nВойдите через Discord для доступа ко всем функциям.\n\n**Быстрые действия:**`,
    components: [row],
    ephemeral: true,
  });
}
