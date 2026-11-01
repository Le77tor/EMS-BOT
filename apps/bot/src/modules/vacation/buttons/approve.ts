/**
 * 🏖️ ОБРАБОТЧИК: Одобрение заявки на отпуск
 */

import { ButtonInteraction, Client, EmbedBuilder } from 'discord.js';
import { prisma } from '@majestic/database';

// Роли, имеющие доступ к одобрению заявок
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
 * Проверяет, имеет ли пользователь право одобрять заявку
 */
function hasApprovalPermission(interaction: ButtonInteraction, vacationType: string): boolean {
  const member = interaction.member;
  if (!member || !('roles' in member)) return false;

  const allowedRoles = vacationType.toUpperCase() === 'OOC' ? OOC_APPROVER_ROLES : IC_APPROVER_ROLES;
  
  return allowedRoles.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Обработчик кнопки "Одобрить"
 */
export async function handleVacationApprove(interaction: ButtonInteraction, client: Client): Promise<void> {
  try {
    // Извлекаем ID заявки из customId кнопки
    const applicationId = interaction.customId.replace('vacation_approve_', '');

    console.log(`[Vacation-Approve] 📝 Обработка одобрения заявки: ${applicationId}`);

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
        content: `❌ У вас нет прав для одобрения ${vacationType.toUpperCase()} отпусков!`,
        ephemeral: true,
      });
      console.log(`[Vacation-Approve] ⛔ Доступ запрещен для ${interaction.user.tag} (тип: ${vacationType})`);
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    // Проверяем статус заявки
    if (application.status !== 'PENDING') {
      await interaction.editReply({
        content: `⚠️ Эта заявка уже обработана! Текущий статус: **${application.status}**`,
      });
      return;
    }

    const startDate = data?.startDate || 'N/A';
    const endDate = data?.endDate || 'N/A';

    // Обновляем статус заявки
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        reviewedBy: interaction.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`[Vacation-Approve] ✅ Заявка ${applicationId} одобрена пользователем ${interaction.user.tag}`);

    // Обновляем embed сообщения
    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(0x00ff00) // Зелёный цвет для одобренной заявки
      .addFields({
        name: '✅ Статус',
        value: `Одобрено пользователем <@${interaction.user.id}>`,
        inline: false,
      });

    // Удаляем кнопки и обновляем сообщение
    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: [],
    });

    // Уведомляем модератора
    const reply = await interaction.editReply({
      content: `✅ Заявка **${applicationId}** успешно одобрена!\n\n` +
        `👤 Пользователь: <@${application.user.discordId}>\n` +
        `📅 Тип: **${vacationType}**\n` +
        `📆 Даты: **${startDate}** → **${endDate}**\n\n` +
        `🤖 Роль будет автоматически выдана в день начала отпуска.`,
    });

    // Автоматически удаляем сообщение через 5 секунд
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
        console.log(`[Vacation-Approve] 🗑️ Ephemeral сообщение удалено через 5 секунд`);
      } catch (error) {
        console.error(`[Vacation-Approve] ❌ Не удалось удалить ephemeral сообщение:`, error);
      }
    }, 5000);

    // Отправляем уведомление пользователю
    try {
      const discordUser = await client.users.fetch(application.user.discordId);
      await discordUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Ваша заявка на отпуск одобрена!')
            .setDescription(
              `Ваша заявка на отпуск была одобрена модератором <@${interaction.user.id}>.`
            )
            .addFields(
              { name: '📅 Тип отпуска', value: vacationType, inline: true },
              { name: '📆 Начало', value: startDate, inline: true },
              { name: '📆 Окончание', value: endDate, inline: true }
            )
            .addFields({
              name: '🤖 Автоматическая выдача роли',
              value: 'Роль отпуска будет автоматически выдана вам в день начала отпуска и снята в день окончания.',
              inline: false,
            })
            .setFooter({ text: `ID заявки: ${applicationId}` })
            .setTimestamp(),
        ],
      });
      console.log(`[Vacation-Approve] 📨 Уведомление отправлено пользователю ${discordUser.tag}`);
    } catch (error) {
      console.error(`[Vacation-Approve] ❌ Не удалось отправить уведомление пользователю:`, error);
    }
  } catch (error) {
    console.error('[Vacation-Approve] ❌ Ошибка при одобрении заявки:', error);
    
    const errorMessage = '❌ Произошла ошибка при обработке заявки. Попробуйте позже.';
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
