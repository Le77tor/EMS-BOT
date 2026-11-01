import type { ButtonInteraction, Client, ModalSubmitInteraction } from 'discord.js';
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { prisma } from '@majestic/database';
import {
  formatBlacklistRemovalEmbed,
  formatDMApplicationInReview,
  formatDMApplicationApproved,
  formatDMApplicationRejected,
  formatDMApplicationReviewCancelled,
} from './formatter.js';
import { createInReviewButtons, createPendingButtons, sendDM } from './sender.js';

/**
 * ID ролей, которые могут управлять заявками
 */
const ALLOWED_ROLES = [
  '1482048390157303914',
  '1482048390157303913'
];

/**
 * Проверяет, имеет ли пользователь необходимые роли
 */
function hasRequiredRole(interaction: ButtonInteraction | ModalSubmitInteraction): boolean {
  if (!interaction.inGuild() || !interaction.member) {
    return false;
  }

  const memberRoles = interaction.member.roles;
  
  // Проверяем наличие хотя бы одной из разрешённых ролей
  if ('cache' in memberRoles) {
    return ALLOWED_ROLES.some(roleId => memberRoles.cache.has(roleId));
  }
  
  return false;
}

/**
 * Обрабатывает нажатие кнопки "Взять в рассмотрение"
 */
async function handleReviewButton(interaction: ButtonInteraction, applicationId: string) {
  // Проверка ролей
  if (!hasRequiredRole(interaction)) {
    await interaction.reply({
      content: '❌ У вас нет прав для управления заявками!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    // Получаем заявку
    const application = await prisma.blacklistRemoval.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      await interaction.followUp({
        content: '❌ Заявка не найдена!',
        ephemeral: true,
      });
      return;
    }

    if (application.status !== 'PENDING') {
      await interaction.followUp({
        content: '❌ Эта заявка уже взята в рассмотрение!',
        ephemeral: true,
      });
      return;
    }

    // Обновляем статус
    const updatedApplication = await prisma.blacklistRemoval.update({
      where: { id: applicationId },
      data: {
        status: 'IN_REVIEW',
        reviewedBy: interaction.user.id,
        reviewedAt: new Date(),
      },
    });

    // Обновляем embed с новым статусом
    const embed = formatBlacklistRemovalEmbed(
      updatedApplication,
      `<@${interaction.user.id}> (${interaction.user.tag})`
    );
    const buttons = createInReviewButtons(applicationId);

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    // Отправляем ЛС пользователю
    await sendDM(
      interaction.client,
      application.discordId,
      formatDMApplicationInReview(updatedApplication, interaction.user.tag)
    );

    console.log(`✅ Заявка ${applicationId} взята в рассмотрение пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Ошибка при взятии заявки в рассмотрение:', error);
    await interaction.followUp({
      content: '❌ Произошла ошибка при обработке заявки!',
      ephemeral: true,
    });
  }
}

/**
 * Обрабатывает нажатие кнопки "Принять"
 */
async function handleApproveButton(interaction: ButtonInteraction, applicationId: string) {
  // Проверка ролей
  if (!hasRequiredRole(interaction)) {
    await interaction.reply({
      content: '❌ У вас нет прав для управления заявками!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    // Получаем заявку
    const application = await prisma.blacklistRemoval.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      await interaction.followUp({
        content: '❌ Заявка не найдена!',
        ephemeral: true,
      });
      return;
    }

    if (application.status !== 'IN_REVIEW') {
      await interaction.followUp({
        content: '❌ Заявка должна быть в статусе "В рассмотрении"!',
        ephemeral: true,
      });
      return;
    }

    // Проверяем, что это тот же человек, который взял в рассмотрение
    if (application.reviewedBy && application.reviewedBy !== interaction.user.id) {
      await interaction.followUp({
        content: '❌ Только тот, кто взял заявку в рассмотрение, может её принять!',
        ephemeral: true,
      });
      return;
    }

    // Обновляем статус
    const updatedApplication = await prisma.blacklistRemoval.update({
      where: { id: applicationId },
      data: {
        status: 'APPROVED',
        processedAt: new Date(),
      },
    });

    // Обновляем embed с новым статусом (без кнопок)
    const embed = formatBlacklistRemovalEmbed(
      updatedApplication,
      `<@${interaction.user.id}> (${interaction.user.tag})`
    );

    await interaction.editReply({
      embeds: [embed],
      components: [], // Убираем кнопки
    });

    // Отправляем ЛС пользователю
    await sendDM(
      interaction.client,
      application.discordId,
      formatDMApplicationApproved(updatedApplication)
    );

    console.log(`✅ Заявка ${applicationId} принята пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Ошибка при принятии заявки:', error);
    await interaction.followUp({
      content: '❌ Произошла ошибка при обработке заявки!',
      ephemeral: true,
    });
  }
}

/**
 * Обрабатывает нажатие кнопки "Отказать" - показывает модальное окно
 */
async function handleRejectButton(interaction: ButtonInteraction, applicationId: string) {
  // Проверка ролей
  if (!hasRequiredRole(interaction)) {
    await interaction.reply({
      content: '❌ У вас нет прав для управления заявками!',
      ephemeral: true,
    });
    return;
  }

  try {
    // Получаем заявку для проверки
    const application = await prisma.blacklistRemoval.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      await interaction.reply({
        content: '❌ Заявка не найдена!',
        ephemeral: true,
      });
      return;
    }

    if (application.status !== 'IN_REVIEW') {
      await interaction.reply({
        content: '❌ Заявка должна быть в статусе "В рассмотрении"!',
        ephemeral: true,
      });
      return;
    }

    // Проверяем, что это тот же человек, который взял в рассмотрение
    if (application.reviewedBy && application.reviewedBy !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Только тот, кто взял заявку в рассмотрение, может её отклонить!',
        ephemeral: true,
      });
      return;
    }

    // Создаем модальное окно
    const modal = new ModalBuilder()
      .setCustomId(`blacklist_reject_modal_${applicationId}`)
      .setTitle('Причина отказа');

    // Поле для ввода причины
    const reasonInput = new TextInputBuilder()
      .setCustomId('reject_reason')
      .setLabel('Укажите причину отказа')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Введите причину отказа в заявке...')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(actionRow);

    // Показываем модальное окно
    await interaction.showModal(modal);
  } catch (error) {
    console.error('❌ Ошибка при показе модального окна:', error);
    await interaction.reply({
      content: '❌ Произошла ошибка при обработке заявки!',
      ephemeral: true,
    });
  }
}

/**
 * Обрабатывает отправку модального окна с причиной отказа
 */
async function handleRejectModalSubmit(interaction: ModalSubmitInteraction, applicationId: string) {
  // Проверка ролей
  if (!hasRequiredRole(interaction)) {
    await interaction.reply({
      content: '❌ У вас нет прав для управления заявками!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    // Получаем причину из модального окна
    const reason = interaction.fields.getTextInputValue('reject_reason');

    // Получаем заявку
    const application = await prisma.blacklistRemoval.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      await interaction.followUp({
        content: '❌ Заявка не найдена!',
        ephemeral: true,
      });
      return;
    }

    // Обновляем статус с причиной отказа
    const updatedApplication = await prisma.blacklistRemoval.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        reviewNote: reason,
        processedAt: new Date(),
      },
    });

    // Обновляем embed с новым статусом и причиной (без кнопок)
    const embed = formatBlacklistRemovalEmbed(
      updatedApplication,
      `<@${interaction.user.id}> (${interaction.user.tag})`
    );

    await interaction.editReply({
      embeds: [embed],
      components: [], // Убираем кнопки
    });

    // Отправляем ЛС пользователю с причиной
    await sendDM(
      interaction.client,
      application.discordId,
      formatDMApplicationRejected(updatedApplication, reason)
    );

    console.log(`✅ Заявка ${applicationId} отклонена пользователем ${interaction.user.tag}`);
    console.log(`📝 Причина: ${reason}`);
  } catch (error) {
    console.error('❌ Ошибка при отклонении заявки:', error);
    await interaction.followUp({
      content: '❌ Произошла ошибка при обработке заявки!',
      ephemeral: true,
    });
  }
}

/**
 * Обрабатывает нажатие кнопки "Отменить рассмотрение"
 */
async function handleCancelButton(interaction: ButtonInteraction, applicationId: string) {
  // Проверка ролей
  if (!hasRequiredRole(interaction)) {
    await interaction.reply({
      content: '❌ У вас нет прав для управления заявками!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    // Получаем заявку
    const application = await prisma.blacklistRemoval.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      await interaction.followUp({
        content: '❌ Заявка не найдена!',
        ephemeral: true,
      });
      return;
    }

    if (application.status !== 'IN_REVIEW') {
      await interaction.followUp({
        content: '❌ Заявка должна быть в статусе "В рассмотрении"!',
        ephemeral: true,
      });
      return;
    }

    // Проверяем, что это тот же человек, который взял в рассмотрение
    if (application.reviewedBy && application.reviewedBy !== interaction.user.id) {
      await interaction.followUp({
        content: '❌ Только тот, кто взял заявку в рассмотрение, может отменить рассмотрение!',
        ephemeral: true,
      });
      return;
    }

    // Обновляем статус
    const updatedApplication = await prisma.blacklistRemoval.update({
      where: { id: applicationId },
      data: {
        status: 'PENDING',
        reviewedBy: null,
        reviewedAt: null,
      },
    });

    // Обновляем embed с новым статусом
    const embed = formatBlacklistRemovalEmbed(updatedApplication);
    const buttons = createPendingButtons(applicationId);

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    // Отправляем ЛС пользователю
    await sendDM(
      interaction.client,
      application.discordId,
      formatDMApplicationReviewCancelled(updatedApplication)
    );

    console.log(`✅ Рассмотрение заявки ${applicationId} отменено пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Ошибка при отмене рассмотрения:', error);
    await interaction.followUp({
      content: '❌ Произошла ошибка при обработке заявки!',
      ephemeral: true,
    });
  }
}

/**
 * Обрабатывает нажатие кнопки "Заблокировать"
 */
async function handleBlockButton(interaction: ButtonInteraction, applicationId: string) {
  // Проверка ролей
  if (!hasRequiredRole(interaction)) {
    await interaction.reply({
      content: '❌ У вас нет прав для управления заявками!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    // Получаем заявку
    const application = await prisma.blacklistRemoval.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      await interaction.followUp({
        content: '❌ Заявка не найдена!',
        ephemeral: true,
      });
      return;
    }

    // Проверяем, не заблокирован ли уже этот статик
    const existingBlock = await prisma.blacklistRemovalBlock.findFirst({
      where: {
        static: application.static,
        isActive: true,
      },
    });

    if (existingBlock) {
      await interaction.followUp({
        content: '❌ Этот статик уже заблокирован!',
        ephemeral: true,
      });
      return;
    }

    // Создаем блокировку
    await prisma.blacklistRemovalBlock.create({
      data: {
        static: application.static,
        reason: 'Заблокирован через заявку',
        blockedBy: interaction.user.id,
      },
    });

    // Обновляем embed с информацией о блокировке
    const embed = formatBlacklistRemovalEmbed(application);
    embed.addFields({
      name: '🔒 Статус блокировки',
      value: `**Заблокирован**\nСотрудник: <@${interaction.user.id}>\nДата: <t:${Math.floor(Date.now() / 1000)}:F>`,
      inline: false,
    });

    const buttons = createPendingButtons(applicationId, true);

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    console.log(`✅ Статик ${application.static} заблокирован пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Ошибка при блокировке:', error);
    await interaction.followUp({
      content: '❌ Произошла ошибка при блокировке!',
      ephemeral: true,
    });
  }
}

/**
 * Обрабатывает нажатие кнопки "Разблокировать"
 */
async function handleUnblockButton(interaction: ButtonInteraction, applicationId: string) {
  // Проверка ролей
  if (!hasRequiredRole(interaction)) {
    await interaction.reply({
      content: '❌ У вас нет прав для управления заявками!',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    // Получаем заявку
    const application = await prisma.blacklistRemoval.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      await interaction.followUp({
        content: '❌ Заявка не найдена!',
        ephemeral: true,
      });
      return;
    }

    // Ищем активную блокировку
    const block = await prisma.blacklistRemovalBlock.findFirst({
      where: {
        static: application.static,
        isActive: true,
      },
    });

    if (!block) {
      await interaction.followUp({
        content: '❌ Активная блокировка для этого статика не найдена!',
        ephemeral: true,
      });
      return;
    }

    // Разблокируем
    await prisma.blacklistRemovalBlock.update({
      where: { id: block.id },
      data: {
        isActive: false,
        unblockedBy: interaction.user.id,
        unblockedAt: new Date(),
      },
    });

    // Обновляем embed
    const embed = formatBlacklistRemovalEmbed(application);
    const buttons = createPendingButtons(applicationId, false);

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    console.log(`✅ Статик ${application.static} разблокирован пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('❌ Ошибка при разблокировке:', error);
    await interaction.followUp({
      content: '❌ Произошла ошибка при разблокировке!',
      ephemeral: true,
    });
  }
}

/**
 * Главный обработчик кнопок заявок на вынесение из ЧС
 */
export async function handleBlacklistButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith('blacklist_review_')) {
    const applicationId = customId.replace('blacklist_review_', '');
    await handleReviewButton(interaction, applicationId);
  } else if (customId.startsWith('blacklist_approve_')) {
    const applicationId = customId.replace('blacklist_approve_', '');
    await handleApproveButton(interaction, applicationId);
  } else if (customId.startsWith('blacklist_reject_')) {
    const applicationId = customId.replace('blacklist_reject_', '');
    await handleRejectButton(interaction, applicationId);
  } else if (customId.startsWith('blacklist_cancel_')) {
    const applicationId = customId.replace('blacklist_cancel_', '');
    await handleCancelButton(interaction, applicationId);
  } else if (customId.startsWith('blacklist_block_')) {
    const applicationId = customId.replace('blacklist_block_', '');
    await handleBlockButton(interaction, applicationId);
  } else if (customId.startsWith('blacklist_unblock_')) {
    const applicationId = customId.replace('blacklist_unblock_', '');
    await handleUnblockButton(interaction, applicationId);
  }
}

/**
 * Главный обработчик модальных окон заявок на вынесение из ЧС
 */
export async function handleBlacklistModal(interaction: ModalSubmitInteraction) {
  const customId = interaction.customId;

  if (customId.startsWith('blacklist_reject_modal_')) {
    const applicationId = customId.replace('blacklist_reject_modal_', '');
    await handleRejectModalSubmit(interaction, applicationId);
  }
}
