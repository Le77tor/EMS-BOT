/**
 * 📝 ОБРАБОТЧИК: Отправка заявки на перевод
 */

import { 
  ModalSubmitInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  TextChannel 
} from 'discord.js';
import { prisma } from '@majestic/database';
import { 
  TRANSFER_CHANNELS, 
  DEPARTMENT_ROLES, 
  DEPARTMENT_NAMES,
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
 * Извлекает Static ID из displayName
 */
function extractStaticFromDisplayName(displayName: string): string {
  const parts = displayName.split('|').map(p => p.trim());
  if (parts.length >= 3) {
    return parts[2];
  }
  return 'Не указан';
}

/**
 * Определяет текущий отдел по префиксу в нике
 */
function getCurrentDepartment(displayName: string): DepartmentType | 'UNKNOWN' {
  const prefix = displayName.split('|')[0]?.trim();
  
  const departments: DepartmentType[] = ['DI', 'HAD', 'PSED', 'DES', 'PM'];
  const found = departments.find(dept => prefix === dept);
  
  return found || 'UNKNOWN';
}

/**
 * Получает роли текущего отдела пользователя
 */
function getCurrentDepartmentRoles(member: any): DepartmentType | null {
  for (const [dept, roles] of Object.entries(DEPARTMENT_ROLES)) {
    if (member.roles.cache.some((role: any) => roles.includes(role.id))) {
      return dept as DepartmentType;
    }
  }
  return null;
}

export async function handleTransferSubmit(
  interaction: ModalSubmitInteraction, 
  targetDepartment: DepartmentType
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const online = interaction.fields.getTextInputValue('online');
    const schedule = interaction.fields.getTextInputValue('schedule');
    const experience = interaction.fields.getTextInputValue('experience');
    const motivation = interaction.fields.getTextInputValue('motivation');

    // Получаем информацию о пользователе
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      await interaction.editReply({ content: '❌ Не удалось получить информацию о вас на сервере.' });
      return;
    }

    const displayName = member.displayName;
    const username = extractNameFromDisplayName(displayName);
    const staticId = extractStaticFromDisplayName(displayName);
    const currentDepartment = getCurrentDepartment(displayName);

    if (currentDepartment === 'UNKNOWN') {
      await interaction.editReply({ content: '❌ Не удалось определить ваш текущий отдел. Убедитесь, что ваш ник имеет правильный формат (Отдел | Имя Фамилия | ID).' });
      return;
    }

    if (currentDepartment === targetDepartment) {
      await interaction.editReply({ content: '❌ Вы уже состоите в этом отделе!' });
      return;
    }

    // Получаем текущий ранг (самую высокую роль)
    const currentRank = member.roles.highest.name;

    // Сохраняем заявку в БД
    const user = await prisma.user.upsert({
      where: { discordId: interaction.user.id },
      create: {
        discordId: interaction.user.id,
        username: interaction.user.username,
        displayName: displayName,
      },
      update: {
        username: interaction.user.username,
        displayName: displayName,
      },
    });

    const application = await prisma.application.create({
      data: {
        userId: user.id,
        type: 'TRANSFER',
        status: 'PENDING',
        data: {
          online,
          schedule,
          experience,
          motivation,
          currentDepartment,
          targetDepartment,
          currentRank,
          staticId,
        },
      },
    });

    // Получаем канал для отправки
    const channelId = TRANSFER_CHANNELS[targetDepartment];
    const channel = interaction.guild?.channels.cache.get(channelId) as TextChannel;

    if (!channel) {
      await interaction.editReply({ content: '❌ Не удалось найти канал для отправки заявки.' });
      return;
    }

    // Пингуем роли текущего и целевого отдела
    const currentDeptRoles = DEPARTMENT_ROLES[currentDepartment];
    const targetDeptRoles = DEPARTMENT_ROLES[targetDepartment];
    
    const roleMentions = [
      ...currentDeptRoles.map(roleId => `<@&${roleId}>`),
      ...targetDeptRoles.map(roleId => `<@&${roleId}>`)
    ].join(' ');

    // Создаём embed
    const embed = new EmbedBuilder()
      .setColor(0xf39c12) // Оранжевый (в ожидании)
      .setTitle('📋 Заявка на перевод между отделами')
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: '👤 Сотрудник', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📛 Имя Фамилия', value: username, inline: true },
        { name: '🔢 Static ID', value: staticId, inline: true },
        { name: '🏢 Текущий отдел', value: DEPARTMENT_NAMES[currentDepartment], inline: true },
        { name: '⭐ Текущий ранг', value: currentRank, inline: true },
        { name: '🎯 Целевой отдел', value: DEPARTMENT_NAMES[targetDepartment], inline: true },
        { name: '⏰ Онлайн (Часов в сутки)', value: online, inline: false },
        { name: '🕐 Часы игры (МСК)', value: schedule, inline: false },
        { name: '💼 Опыт в отделе', value: experience, inline: false },
        { name: '💡 Мотивация', value: motivation, inline: false },
        { name: '⚠️ Статус', value: '🟡 Ожидает рассмотрения', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `ID заявки: ${application.id}` });

    // Создаём кнопки для отделов
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`transfer_dept_${currentDepartment}_${application.id}`)
          .setLabel(`Отдел ${currentDepartment}`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`transfer_dept_${targetDepartment}_${application.id}`)
          .setLabel(`Отдел ${targetDepartment}`)
          .setStyle(ButtonStyle.Primary)
      );

    const message = await channel.send({
      content: roleMentions,
      embeds: [embed],
      components: [row],
    });

    // Сохраняем ID сообщения в БД
    await prisma.application.update({
      where: { id: application.id },
      data: { discordMessageId: message.id },
    });

    const reply = await interaction.editReply({ 
      content: `✅ Ваша заявка на перевод в **${DEPARTMENT_NAMES[targetDepartment]}** успешно отправлена!\n\n` +
               `Заявка отправлена в канал и ожидает рассмотрения от обоих отделов.`
    });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);

    console.log(`[Transfer-Submit] ✅ Заявка на перевод ${application.id} создана пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('[Transfer-Submit] ❌ Ошибка:', error);
    
    const errorMessage = '❌ Произошла ошибка при отправке заявки на перевод.';
    
    if (interaction.deferred) {
      const reply = await interaction.editReply({ content: errorMessage });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    } else {
      const reply = await interaction.reply({ content: errorMessage, ephemeral: true });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }
  }
}
