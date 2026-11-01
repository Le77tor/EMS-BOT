/**
 * ✅❌ ОБРАБОТЧИК: Одобрение и отклонение заявок на перевод
 */

import { 
  ModalSubmitInteraction, 
  ButtonInteraction,
  EmbedBuilder, 
  TextChannel 
} from 'discord.js';
import { prisma } from '@majestic/database';
import { 
  MANAGEMENT_CHANNEL_ID, 
  DEPARTMENT_NAMES, 
  DEPARTMENT_MEMBER_ROLES,
  DEPARTMENT_PREFIXES,
  type DepartmentType 
} from '../constants.js';

/**
 * Извлекает имя из displayName формата "Prefix | Имя Фамилия | ID"
 */
function extractNameFromDisplayName(displayName: string): string {
  const parts = displayName.split('|').map(p => p.trim());
  if (parts.length >= 2) {
    return parts[1];
  }
  return displayName;
}

/**
 * Извлекает статик из displayName формата "Prefix | Имя Фамилия | ID"
 */
function extractStaticFromDisplayName(displayName: string): string {
  const parts = displayName.split('|').map(p => p.trim());
  if (parts.length >= 3) {
    return parts[2];
  }
  return 'Неизвестно';
}

/**
 * Обработчик прямого одобрения (без модального окна)
 */
export async function handleApproveDirectly(interaction: ButtonInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Извлекаем данные из customId кнопки (формат: transfer_approve_{department}_{applicationId}_{messageId})
    const parts = interaction.customId.split('_');
    const department = parts[2] as DepartmentType;
    const applicationId = parts[3];
    const messageId = parts[4]; // Берём ID из customId, а не из interaction.message
    
    console.log(`[Transfer-Approve] 🔍 Direct approve - Message: ${messageId}`);
    console.log(`[Transfer-Approve] 📝 CustomId: ${interaction.customId}`);
    console.log(`[Transfer-Approve] 🏢 Department: ${department}`);
    console.log(`[Transfer-Approve] 📋 Application ID: ${applicationId}`);
    console.log(`[Transfer-Approve] 📍 Channel ID: ${interaction.channelId}`);
    
    const originalMessage = await interaction.channel?.messages.fetch(messageId).catch((error) => {
      console.error('[Transfer-Approve] ❌ Failed to fetch message:', error);
      return null;
    });
    
    if (!originalMessage || !originalMessage.embeds[0]) {
      const reply = await interaction.editReply({ 
        content: '❌ Не удалось найти оригинальное сообщение с заявкой.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const embed = originalMessage.embeds[0];
    console.log(`[Transfer-Approve] ✅ Found message and embed, using applicationId: ${applicationId}`);

    // Получаем заявку из БД
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      const reply = await interaction.editReply({ 
        content: '❌ Заявка не найдена в базе данных.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const data = application.data as any;
    const currentDepartment = data.currentDepartment as DepartmentType;
    const targetDepartment = data.targetDepartment as DepartmentType;

    const approvingDepartment = department;

    console.log(`[Transfer-Approve] 📊 Approving department: ${approvingDepartment}, Current: ${currentDepartment}, Target: ${targetDepartment}`);

    // Обновляем данные заявки
    const approvals = (data.approvals || {}) as Record<string, boolean>;
    approvals[approvingDepartment] = true;
    
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        data: {
          ...data,
          approvals,
          [`${approvingDepartment}ApprovedBy`]: interaction.user.id,
        },
      },
    });

    // Проверяем, одобрили ли оба отдела
    const bothApproved = approvals[currentDepartment] && approvals[targetDepartment];

    if (bothApproved) {
      // ✅ ОБА ОТДЕЛА ОДОБРИЛИ - ВЫПОЛНЯЕМ ПЕРЕВОД
      await executeTransfer(interaction, application, originalMessage);
    } else {
      // Только один отдел одобрил - обновляем embed
      const updatedEmbed = EmbedBuilder.from(embed);
      
      // Добавляем информацию об одобрении
      updatedEmbed.addFields({
        name: `✅ Отдел ${approvingDepartment}`,
        value: `Одобрено сотрудником <@${interaction.user.id}>`,
        inline: false,
      });
      
      // Обновляем статус
      const currentStatus = `🟡 Ожидает одобрения: ${approvals[currentDepartment] ? '✅' : '⏳'} ${currentDepartment} | ${approvals[targetDepartment] ? '✅' : '⏳'} ${targetDepartment}`;
      
      const fields = updatedEmbed.data.fields || [];
      const statusFieldIndex = fields.findIndex(f => f.name === '⚠️ Статус');
      if (statusFieldIndex !== -1) {
        fields[statusFieldIndex].value = currentStatus;
      }

      await originalMessage.edit({ embeds: [updatedEmbed] });

      const reply = await interaction.editReply({ 
        content: `✅ Отдел ${approvingDepartment} одобрил перевод. Ожидается одобрение от второго отдела.` 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }

    console.log(`[Transfer-Approve] ✅ Отдел ${approvingDepartment} одобрил заявку ${applicationId}`);
  } catch (error) {
    console.error('[Transfer-Approve] ❌ Ошибка:', error);
    
    if (interaction.deferred) {
      const reply = await interaction.editReply({ 
        content: '❌ Произошла ошибка при одобрении заявки.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }
  }
}

/**
 * Обработчик модального окна одобрения (устаревший, оставлен для совместимости)
 */
export async function handleApproveModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const confirm = interaction.fields.getTextInputValue('confirm');
    
    if (confirm.toUpperCase() !== 'ОДОБРИТЬ') {
      const reply = await interaction.editReply({ 
        content: '❌ Подтверждение не прошло. Необходимо написать "ОДОБРИТЬ".' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Извлекаем данные из customId (формат: transfer_approve_confirm_{department}_{applicationId}_{messageId})
    const parts = interaction.customId.split('_');
    const department = parts[3] as DepartmentType; // Одобряющий отдел
    const applicationId = parts[4];
    const messageId = parts[5];
    
    console.log(`[Transfer-Approve] 🔍 Attempting to fetch message: ${messageId}`);
    console.log(`[Transfer-Approve] 📝 CustomId: ${interaction.customId}`);
    console.log(`[Transfer-Approve] 🏢 Department: ${department}`);
    console.log(`[Transfer-Approve] 📋 Application ID: ${applicationId}`);
    console.log(`[Transfer-Approve] 📍 Channel ID: ${interaction.channelId}`);
    
    const originalMessage = await interaction.channel?.messages.fetch(messageId).catch((error) => {
      console.error('[Transfer-Approve] ❌ Failed to fetch message:', error);
      return null;
    });
    
    if (!originalMessage || !originalMessage.embeds[0]) {
      const reply = await interaction.editReply({ 
        content: '❌ Не удалось найти оригинальное сообщение с заявкой.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const embed = originalMessage.embeds[0];
    // ApplicationId уже есть из customId, не нужно извлекать из footer
    
    console.log(`[Transfer-Approve] ✅ Found message and embed, using applicationId: ${applicationId}`);

    // Получаем заявку из БД
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      const reply = await interaction.editReply({ 
        content: '❌ Заявка не найдена в базе данных.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const data = application.data as any;
    const currentDepartment = data.currentDepartment as DepartmentType;
    const targetDepartment = data.targetDepartment as DepartmentType;

    // department - это отдел, который одобрил (из customId кнопки)
    const approvingDepartment = department;

    console.log(`[Transfer-Approve] 📊 Approving department: ${approvingDepartment}, Current: ${currentDepartment}, Target: ${targetDepartment}`);

    // Обновляем данные заявки
    const approvals = (data.approvals || {}) as Record<string, boolean>;
    approvals[approvingDepartment] = true;
    
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        data: {
          ...data,
          approvals,
          [`${approvingDepartment}ApprovedBy`]: interaction.user.id,
        },
      },
    });

    // Проверяем, одобрили ли оба отдела
    const bothApproved = approvals[currentDepartment] && approvals[targetDepartment];

    if (bothApproved) {
      // ✅ ОБА ОТДЕЛА ОДОБРИЛИ - ВЫПОЛНЯЕМ ПЕРЕВОД
      await executeTransfer(interaction, application, originalMessage);
    } else {
      // Только один отдел одобрил - обновляем embed
      const updatedEmbed = EmbedBuilder.from(embed);
      
      // Обновляем статус
      const currentStatus = `🟡 Ожидает одобрения: ${approvals[currentDepartment] ? '✅' : '⏳'} ${currentDepartment} | ${approvals[targetDepartment] ? '✅' : '⏳'} ${targetDepartment}`;
      
      const fields = updatedEmbed.data.fields || [];
      const statusFieldIndex = fields.findIndex(f => f.name === '⚠️ Статус');
      if (statusFieldIndex !== -1) {
        fields[statusFieldIndex].value = currentStatus;
      }

      await originalMessage.edit({ embeds: [updatedEmbed] });

      const reply = await interaction.editReply({ 
        content: `✅ Отдел ${approvingDepartment} одобрил перевод. Ожидается одобрение от второго отдела.` 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }

    console.log(`[Transfer-Approve] ✅ Отдел ${approvingDepartment} одобрил заявку ${applicationId}`);
  } catch (error) {
    console.error('[Transfer-Approve] ❌ Ошибка:', error);
    
    if (interaction.deferred) {
      const reply = await interaction.editReply({ 
        content: '❌ Произошла ошибка при одобрении заявки.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }
  }
}

/**
 * Выполняет перевод пользователя между отделами
 */
async function executeTransfer(
  interaction: ModalSubmitInteraction | ButtonInteraction,
  application: any,
  originalMessage: any
): Promise<void> {
  const data = application.data as any;
  const currentDepartment = data.currentDepartment as DepartmentType;
  const targetDepartment = data.targetDepartment as DepartmentType;

  try {
    // Получаем member пользователя
    const targetMember = await interaction.guild?.members.fetch(application.user.discordId).catch(() => null);
    
    if (!targetMember) {
      const reply = await interaction.editReply({ 
        content: '❌ Пользователь не найден на сервере.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const displayName = targetMember.displayName;
    const username = extractNameFromDisplayName(displayName);
    const userStatic = extractStaticFromDisplayName(displayName);

    // 1. Меняем роли отделов
    const currentDeptRoles = Array.isArray(DEPARTMENT_MEMBER_ROLES[currentDepartment]) 
      ? DEPARTMENT_MEMBER_ROLES[currentDepartment] 
      : [DEPARTMENT_MEMBER_ROLES[currentDepartment]];
    
    const targetDeptRole = Array.isArray(DEPARTMENT_MEMBER_ROLES[targetDepartment])
      ? DEPARTMENT_MEMBER_ROLES[targetDepartment][0]
      : DEPARTMENT_MEMBER_ROLES[targetDepartment];

    // Убираем роли текущего отдела
    for (const roleId of currentDeptRoles as string[]) {
      if (targetMember.roles.cache.has(roleId)) {
        await targetMember.roles.remove(roleId);
      }
    }

    // Добавляем роль нового отдела
    await targetMember.roles.add(targetDeptRole);

    // 2. Меняем префикс в нике
    const parts = displayName.split('|').map(p => p.trim());
    const newPrefix = DEPARTMENT_PREFIXES[targetDepartment];
    
    let newDisplayName = displayName;
    if (parts.length >= 2) {
      parts[0] = newPrefix;
      newDisplayName = parts.join(' | ');
    }

    await targetMember.setNickname(newDisplayName).catch(err => {
      console.error('[Transfer] ⚠️ Не удалось изменить никнейм:', err);
    });

    // 3. Обновляем статус в БД
    await prisma.application.update({
      where: { id: application.id },
      data: { status: 'APPROVED' },
    });

    // Получаем обновлённую заявку с ID одобривших
    const updatedApplication = await prisma.application.findUnique({
      where: { id: application.id },
      include: { user: true },
    });

    const updatedData = (updatedApplication?.data as any) || data;

    // 4. Обновляем embed - убираем Статус и промежуточные одобрения, оставляем только финальное Решение
    const currentApprover = updatedData[`${currentDepartment}ApprovedBy`];
    const targetApprover = updatedData[`${targetDepartment}ApprovedBy`];

    // Создаём новый embed на основе оригинального, но БЕЗ полей "Статус" и промежуточных одобрений
    const originalEmbed = originalMessage.embeds[0];
    const cleanedFields = (originalEmbed.fields || []).filter(field => {
      // Убираем:
      // - "⚠️ Статус"
      // - "🟡 Ожидает одобрения"
      // - "✅ Отдел DI/HAD/PSED/DES/PM" (промежуточные одобрения)
      const fieldName = field.name;
      return !fieldName.includes('Статус') && 
             !fieldName.includes('Ожидает одобрения') && 
             !fieldName.startsWith('✅ Отдел');
    });

    const finalEmbed = new EmbedBuilder()
      .setColor(0x2ecc71); // Зелёный
    
    // Устанавливаем title
    if (originalEmbed.title) {
      finalEmbed.setTitle(originalEmbed.title);
    }
    
    // Устанавливаем description только если оно не пустое
    if (originalEmbed.description) {
      finalEmbed.setDescription(originalEmbed.description);
    }
    
    // Устанавливаем thumbnail
    if (originalEmbed.thumbnail?.url) {
      finalEmbed.setThumbnail(originalEmbed.thumbnail.url);
    }
    
    // Устанавливаем footer
    if (originalEmbed.footer?.text) {
      finalEmbed.setFooter({ text: originalEmbed.footer.text });
    }
    
    finalEmbed.setTimestamp();
    
    // Добавляем очищенные поля
    if (cleanedFields.length > 0) {
      finalEmbed.addFields(cleanedFields);
    }
    
    // Добавляем финальное решение
    finalEmbed.addFields({
      name: '✅ Решение',
      value: `Перевод **одобрен** обоими отделами\n` +
             `Одобрил ${currentDepartment}: ${currentApprover ? `<@${currentApprover}>` : 'Неизвестно'}\n` +
             `Одобрил ${targetDepartment}: ${targetApprover ? `<@${targetApprover}>` : 'Неизвестно'}`,
      inline: false,
    });

    await originalMessage.edit({
      embeds: [finalEmbed],
      components: [], // Убираем все кнопки из основного сообщения
    });

    // 4.5. Удаляем ephemeral-сообщения с кнопками (если они существуют)
    try {
      // Удаляем текущее ephemeral-сообщение
      await interaction.deleteReply().catch(() => {});
    } catch (error) {
      console.log('[Transfer-Execute] ℹ️ Ephemeral-сообщение уже удалено или не существует');
    }

    // 5. Отправляем уведомление пользователю в ЛС
    try {
      const user = await interaction.client.users.fetch(application.user.discordId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Перевод одобрен!')
            .setDescription(`Ваш перевод из **${DEPARTMENT_NAMES[currentDepartment]}** в **${DEPARTMENT_NAMES[targetDepartment]}** был одобрен!`)
            .addFields(
              { name: '🎉 Поздравляем!', value: 'Теперь вы являетесь частью нового отдела.', inline: false }
            )
            .setTimestamp()
        ]
      });
    } catch (error) {
      console.error('[Transfer] ⚠️ Не удалось отправить DM пользователю:', error);
    }

    // 6. Отправляем сообщение в канал управления
    const managementChannel = interaction.guild?.channels.cache.get(MANAGEMENT_CHANNEL_ID) as TextChannel;
    if (managementChannel) {
      const messageLink = `https://discord.com/channels/${interaction.guild?.id}/${originalMessage.channel.id}/${originalMessage.id}`;

      const managementEmbed = new EmbedBuilder()
        .setDescription(
          `> <:bookmark:1565036995250749600> **Перевод между отделами одобрен**\n` +
          `> **Причина перевода**\n` +
          `> ${messageLink}`
        )
        .setColor(0x10b981)
        .addFields(
          { name: 'Сотрудник', value: `<@${application.user.discordId}>`, inline: true },
          { name: 'Имя Фамилия', value: username, inline: true },
          { name: 'Статик', value: userStatic, inline: true },
          { name: 'Из отдела', value: DEPARTMENT_NAMES[currentDepartment], inline: true },
          { name: 'В отдел', value: DEPARTMENT_NAMES[targetDepartment], inline: true },
          { name: 'Одобрено', value: `${currentDepartment} и ${targetDepartment}`, inline: true }
        )
        .setTimestamp();

      await managementChannel.send({
        content: `<@${interaction.user.id}> одобрил перевод <@${application.user.discordId}>`,
        embeds: [managementEmbed]
      });
    }

    console.log(`[Transfer-Execute] ✅ Перевод ${application.id} успешно выполнен`);
  } catch (error) {
    console.error('[Transfer-Execute] ❌ Ошибка:', error);
    const reply = await interaction.editReply({ 
      content: '❌ Произошла ошибка при выполнении перевода.' 
    });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
  }
}

/**
 * Обработчик модального окна отклонения
 */
export async function handleRejectModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('reason');
    
    // Извлекаем данные из customId (формат: transfer_reject_{department}_{applicationId}_{messageId})
    const parts = interaction.customId.split('_');
    const department = parts[2] as DepartmentType;
    const applicationId = parts[3];
    const messageId = parts[4];
    
    console.log(`[Transfer-Reject] 🔍 Attempting to fetch message: ${messageId}`);
    console.log(`[Transfer-Reject] 📝 CustomId: ${interaction.customId}`);
    console.log(`[Transfer-Reject] 🏢 Department: ${department}`);
    console.log(`[Transfer-Reject] 📋 Application ID: ${applicationId}`);
    
    const originalMessage = await interaction.channel?.messages.fetch(messageId).catch((error) => {
      console.error('[Transfer-Reject] ❌ Failed to fetch message:', error);
      return null;
    });
    
    if (!originalMessage || !originalMessage.embeds[0]) {
      const reply = await interaction.editReply({ 
        content: '❌ Не удалось найти оригинальное сообщение с заявкой.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const embed = originalMessage.embeds[0];
    // ApplicationId уже есть из customId
    
    console.log(`[Transfer-Reject] ✅ Found message and embed, using applicationId: ${applicationId}`);

    // Получаем заявку из БД
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      const reply = await interaction.editReply({ 
        content: '❌ Заявка не найдена в базе данных.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Получаем данные заявки
    const data = application.data as any;
    const currentDepartment = data.currentDepartment as DepartmentType;
    const targetDepartment = data.targetDepartment as DepartmentType;

    // Обновляем статус заявки
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        reviewNote: reason,
        reviewedBy: interaction.user.id,
        reviewedAt: new Date(),
      },
    });

    // Создаём новый embed с нуля (без старых одобрений)
    const rejectedEmbed = new EmbedBuilder()
      .setColor(0xe74c3c) // Красный
      .setTitle('🔄 Заявка на перевод между отделами')
      .setDescription(`Заявка от <@${application.user.discordId}>`)
      .addFields(
        { name: '👤 Сотрудник', value: application.user.displayName || 'Неизвестно', inline: false },
        { name: '📊 Из отдела', value: DEPARTMENT_NAMES[currentDepartment] || currentDepartment, inline: true },
        { name: '🎯 В отдел', value: DEPARTMENT_NAMES[targetDepartment] || targetDepartment, inline: true },
        { name: '⏰ Онлайн', value: data.online || 'Не указано', inline: false },
        { name: '📅 График', value: data.schedule || 'Не указано', inline: false },
        { name: '💼 Опыт работы', value: data.experience?.substring(0, 200) + (data.experience?.length > 200 ? '...' : '') || 'Не указано', inline: false },
        { name: '✨ Мотивация', value: data.motivation?.substring(0, 200) + (data.motivation?.length > 200 ? '...' : '') || 'Не указано', inline: false },
        { name: '❌ Решение', value: `Перевод **отклонён** пользователем <@${interaction.user.id}> (отдел ${department})`, inline: false },
        { name: '📝 Причина отказа', value: reason, inline: false }
      )
      .setFooter({ text: `ID заявки: ${applicationId}` })
      .setTimestamp();

    await originalMessage.edit({
      embeds: [rejectedEmbed],
      components: [], // Убираем все кнопки
    });

    // Уведомляем пользователя в ЛС
    try {
      const user = await interaction.client.users.fetch(application.user.discordId);
      await user.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('❌ Заявка на перевод отклонена')
            .setDescription('Ваша заявка на перевод между отделами была отклонена.')
            .addFields(
              { name: '📝 Причина отказа', value: reason, inline: false }
            )
            .setTimestamp()
        ]
      });
    } catch (error) {
      console.error('[Transfer-Reject] ⚠️ Не удалось отправить DM пользователю:', error);
    }

    const reply = await interaction.editReply({ 
      content: `✅ Заявка на перевод отклонена!\n\n📝 Причина: ${reason}` 
    });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);

    console.log(`[Transfer-Reject] ✅ Заявка ${applicationId} отклонена пользователем ${interaction.user.tag} (отдел ${department})`);
  } catch (error) {
    console.error('[Transfer-Reject] ❌ Ошибка:', error);
    
    if (interaction.deferred) {
      const reply = await interaction.editReply({ 
        content: '❌ Произошла ошибка при отклонении заявки.' 
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }
  }
}
