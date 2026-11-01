/**
 * 🔄 МОДУЛЬ: Система переводов между отделами
 */

import { 
  Client, 
  ButtonInteraction, 
  ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  EmbedBuilder,
} from 'discord.js';
import { prisma } from '@majestic/database';
import { TRANSFER_CHANNELS, DEPARTMENT_NAMES, DEPARTMENT_ROLES, type DepartmentType } from './constants.js';
import { getCurrentRank, getDepartmentFromPrefix } from '../../constants/roles.js';
import { handleTransferSubmit } from './buttons/submit.js';
import { handleDepartmentButton } from './buttons/department.js';
import { handleApproveModal, handleRejectModal, handleApproveDirectly } from './buttons/approve-reject.js';

// Интервал проверки новых заявок (30 секунд)
const CHECK_INTERVAL = 30000;
let checkInterval: NodeJS.Timeout | null = null;

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
 * Отправляет заявку на перевод в Discord
 */
async function sendTransferToDiscord(client: Client, application: any) {
  try {
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || '');
    if (!guild) {
      console.error('[Transfer] ❌ Guild not found');
      return;
    }

    const data = application.data as any;
    const targetDepartment = data.targetDepartment as DepartmentType;
    const currentDepartment = getDepartmentFromPrefix(application.user.displayName);

    if (currentDepartment === 'UNKNOWN') {
      console.error('[Transfer] ❌ Could not determine current department for user:', application.user.displayName);
      return;
    }

    // Получаем member пользователя
    const member = await guild.members.fetch(application.user.discordId).catch(() => null);
    if (!member) {
      console.error('[Transfer] ❌ Member not found:', application.user.discordId);
      return;
    }

    const displayName = member.displayName;
    const username = extractNameFromDisplayName(displayName);
    const staticId = extractStaticFromDisplayName(displayName);
    
    // Получаем текущий ранг из ролей пользователя
    const userRoleIds = member.roles.cache.map(role => role.id);
    const currentRank = getCurrentRank(userRoleIds);

    // Получаем канал для отправки
    const channelId = TRANSFER_CHANNELS[targetDepartment];
    console.log(`[Transfer] 📡 Attempting to send to channel: ${channelId} (department: ${targetDepartment})`);
    
    const channel = guild.channels.cache.get(channelId) as TextChannel;

    if (!channel) {
      console.error('[Transfer] ❌ Channel not found:', channelId);
      return;
    }

    console.log(`[Transfer] ✅ Channel found: ${channel.name} (ID: ${channel.id})`);
    
    // Проверяем права бота в канале
    const botMember = guild.members.cache.get(client.user!.id);
    if (botMember) {
      const permissions = channel.permissionsFor(botMember);
      console.log(`[Transfer] 🔐 Bot permissions in channel:`, {
        viewChannel: permissions?.has('ViewChannel'),
        sendMessages: permissions?.has('SendMessages'),
        embedLinks: permissions?.has('EmbedLinks'),
        addReactions: permissions?.has('AddReactions')
      });
      
      if (!permissions?.has('SendMessages')) {
        console.error('[Transfer] ❌ Bot does not have permission to send messages in channel:', channelId);
        return;
      }
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
        { name: '👤 Сотрудник', value: `<@${application.user.discordId}>`, inline: true },
        { name: '📛 Имя Фамилия', value: username, inline: true },
        { name: '🔢 Static ID', value: staticId, inline: true },
        { name: '🏢 Текущий отдел', value: DEPARTMENT_NAMES[currentDepartment], inline: true },
        { name: '⭐ Текущий ранг', value: currentRank, inline: true },
        { name: '🎯 Целевой отдел', value: DEPARTMENT_NAMES[targetDepartment], inline: true },
        { name: '⏰ Онлайн (Часов в сутки)', value: data.online, inline: false },
        { name: '🕐 Часы игры (МСК)', value: data.schedule, inline: false },
        { name: '💼 Опыт в отделе', value: data.experience, inline: false },
        { name: '💡 Мотивация', value: data.motivation, inline: false },
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
      data: { 
        discordMessageId: message.id,
        data: {
          ...data,
          currentDepartment,
          currentRank,
          staticId,
        }
      },
    });

    console.log(`[Transfer] ✅ Transfer application ${application.id} sent to Discord`);
  } catch (error) {
    console.error('[Transfer] ❌ Error sending transfer to Discord:', error);
  }
}

/**
 * Проверяет новые заявки на перевод и отправляет их в Discord
 */
async function checkNewTransferApplications(client: Client) {
  try {
    // Ищем заявки на перевод без discordMessageId
    const pendingApplications = await prisma.application.findMany({
      where: {
        type: 'TRANSFER',
        status: 'PENDING',
        discordMessageId: null,
      },
      include: {
        user: true,
      },
      take: 10,
    });

    if (pendingApplications.length > 0) {
      console.log(`[Transfer] 📋 Found ${pendingApplications.length} new transfer applications`);
      
      for (const application of pendingApplications) {
        await sendTransferToDiscord(client, application);
        // Небольшая задержка между отправками
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('[Transfer] ❌ Error checking new transfer applications:', error);
  }
}

export function registerTransferModule(client: Client): void {
  console.log('[Transfer] 🔄 Модуль переводов между отделами загружен');
  
  // Запускаем периодическую проверку
  checkInterval = setInterval(() => {
    checkNewTransferApplications(client);
  }, CHECK_INTERVAL);
  
  // Первая проверка сразу после запуска
  setTimeout(() => {
    checkNewTransferApplications(client);
  }, 5000);
}

export function stopTransferModule(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('[Transfer] 🛑 Модуль переводов остановлен');
  }
}

/**
 * Создаёт модальное окно для заявки на перевод
 */
export function createTransferModal(targetDepartment: DepartmentType): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`transfer_modal_${targetDepartment}`)
    .setTitle(`Перевод в ${targetDepartment}`);

  const onlineInput = new TextInputBuilder()
    .setCustomId('online')
    .setLabel('Онлайн (Часов в сутки)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Например: 8-10 часов')
    .setRequired(true)
    .setMaxLength(50);

  const scheduleInput = new TextInputBuilder()
    .setCustomId('schedule')
    .setLabel('Часы игры (МСК)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Например: 14:00 - 22:00')
    .setRequired(true)
    .setMaxLength(50);

  const experienceInput = new TextInputBuilder()
    .setCustomId('experience')
    .setLabel('Опыт в отделе')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Расскажите о вашем опыте работы в текущем отделе...')
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(1000);

  const motivationInput = new TextInputBuilder()
    .setCustomId('motivation')
    .setLabel('Мотивация')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Почему вы хотите перейти в этот отдел?')
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(onlineInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(scheduleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(experienceInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(motivationInput)
  );

  return modal;
}

/**
 * Обработчик выбора отдела из выпадающего списка
 */
export async function handleDepartmentSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const selectedDepartment = interaction.values[0] as DepartmentType;
  
  const modal = createTransferModal(selectedDepartment);
  await interaction.showModal(modal);
}

/**
 * Обработчик отправки модального окна
 */
export async function handleTransferModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const modalId = interaction.customId;
  const targetDepartment = modalId.split('_')[2] as DepartmentType;
  
  await handleTransferSubmit(interaction, targetDepartment);
}

/**
 * Обработчик кнопок отделов (DI, HAD, PSED, DES, PM)
 */
export async function handleDepartmentButtonClick(interaction: ButtonInteraction): Promise<void> {
  await handleDepartmentButton(interaction);
}

/**
 * Обработчик кнопки "Одобрить" - одобряет сразу без модального окна
 */
export async function handleApproveButton(interaction: ButtonInteraction): Promise<void> {
  await handleApproveDirectly(interaction);
}

/**
 * Обработчик кнопки "Отклонить"
 */
export async function handleRejectButton(interaction: ButtonInteraction): Promise<void> {
  // Извлекаем department, applicationId и messageId из customId кнопки (формат: transfer_reject_{department}_{applicationId}_{messageId})
  const parts = interaction.customId.split('_');
  const department = parts[2];
  const applicationId = parts[3];
  const messageId = parts[4]; // Берём ID оригинального сообщения из customId
  
  console.log(`[Transfer-Reject] 🔘 Opening modal for message: ${messageId}`);
  
  const modal = new ModalBuilder()
    .setCustomId(`transfer_reject_${department}_${applicationId}_${messageId}`)
    .setTitle('Отклонение перевода');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Причина отказа')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Укажите причину отклонения заявки на перевод...')
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
}

/**
 * Обработчик модального окна одобрения
 */
export async function handleApproveConfirm(interaction: ModalSubmitInteraction): Promise<void> {
  await handleApproveModal(interaction);
}

/**
 * Обработчик модального окна отклонения
 */
export async function handleRejectConfirm(interaction: ModalSubmitInteraction): Promise<void> {
  await handleRejectModal(interaction);
}
