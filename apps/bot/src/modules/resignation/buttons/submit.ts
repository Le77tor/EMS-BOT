/**
 * 📋 ОБРАБОТЧИК: Подача заявления на увольнение
 */

import {
  ButtonInteraction,
  Client,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { prisma } from '@majestic/database';

// ID ролей для проверки
const WARNING_ROLES = [
  '1482048390136070330', // Выговор 1
  '1482048390136070332', // Выговор 2
  '1482048390136070333', // Выговор 3
  '1482048390136070331', // Выговор 4
];

const INTERNSHIP_ROLE = '1482048390136070326'; // Интернатура

// ID канала для отправки заявлений
const RESIGNATION_CHANNEL_ID = '1550131754138869881';

// ID роли для пинга
const PING_ROLE_ID = '1482048390148784234';

// ID эмодзи
const RESIGNATION_EMOJI_ID = '1566148263067783198';

// ID канала для уведомлений об увольнении
const NOTIFICATION_CHANNEL_ID = '1482048392912703505';
const NOTIFICATION_EMOJI_ID = '1565036995250749600';

/**
 * Обработчик кнопки "Заявление на увольнение"
 */
export async function handleResignationSubmit(interaction: ButtonInteraction, client: Client): Promise<void> {
  console.log(`[Resignation-Submit] 🚀 ВЫЗВАН handleResignationSubmit от ${interaction.user.tag}`);
  
  try {
    const member = interaction.member;
    console.log(`[Resignation-Submit] 👤 Member:`, member ? 'найден' : 'НЕ НАЙДЕН');
    
    if (!member || !('roles' in member)) {
      console.log(`[Resignation-Submit] ❌ Нет доступа к ролям`);
      await interaction.reply({
        content: '❌ Не удалось получить информацию о ваших ролях.',
        ephemeral: true,
      });
      return;
    }

    // Проверяем наличие выговоров
    const hasWarning = WARNING_ROLES.some(roleId => member.roles.cache.has(roleId));
    
    // Проверяем наличие роли интернатуры
    const hasInternship = member.roles.cache.has(INTERNSHIP_ROLE);

    console.log(`[Resignation-Submit] 📝 Запрос на увольнение от ${interaction.user.tag}`);
    console.log(`[Resignation-Submit] ⚠️ Выговор: ${hasWarning}, Интернатура: ${hasInternship}`);

    // Если есть выговор или интернатура - показываем предупреждение
    if (hasWarning || hasInternship) {
      let warningMessage = '';
      
      if (hasWarning) {
        warningMessage = '⚠️ **У вас есть активный выговор!**\n\nЕсли вы его не отработаете, вы будете уволены с ЧС. Согласны ли вы с этим?';
      } else if (hasInternship) {
        warningMessage = '⚠️ **Вы не прошли интернатуру!**\n\nЕсли она не будет пройдена, вы будете уволены с ЧС. Согласны ли вы с этим?';
      }

      // Создаем временный ID для этого запроса
      const tempId = `${interaction.user.id}_${Date.now()}`;

      // Показываем предупреждение с кнопками
      await interaction.reply({
        content: warningMessage,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`resignation_confirm_${tempId}`)
              .setLabel('Да, согласен')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`resignation_cancel_${tempId}`)
              .setLabel('Нет, отменить')
              .setStyle(ButtonStyle.Secondary)
          ),
        ],
        ephemeral: true,
      });

      return;
    }

    // Если нет выговоров и интернатуры - сразу показываем форму
    await showResignationModal(interaction, false);

  } catch (error) {
    console.error('[Resignation-Submit] ❌ Ошибка при обработке запроса:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Произошла ошибка при обработке запроса.',
        ephemeral: true,
      });
    }
  }
}

/**
 * Обработчик подтверждения увольнения с ЧС
 */
export async function handleResignationConfirm(interaction: ButtonInteraction, client: Client): Promise<void> {
  try {
    console.log(`[Resignation-Confirm] ✅ Подтверждение увольнения с ЧС от ${interaction.user.tag}`);

    // Показываем форму с отметкой о согласии на ЧС
    await showResignationModal(interaction, true);

  } catch (error) {
    console.error('[Resignation-Confirm] ❌ Ошибка при подтверждении:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Произошла ошибка при обработке запроса.',
        ephemeral: true,
      });
    }
  }
}

/**
 * Показывает модальное окно для ввода причины увольнения
 */
async function showResignationModal(interaction: ButtonInteraction, withBlacklist: boolean): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`resignation_modal_${interaction.user.id}_${withBlacklist}`)
    .setTitle('Заявление на увольнение');

  const reasonInput = new TextInputBuilder()
    .setCustomId('resignation_reason')
    .setLabel('Причина увольнения')
    .setPlaceholder('Укажите причину вашего увольнения...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1000);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);

  // Ожидаем отправку модального окна
  try {
    const modalSubmit = await interaction.awaitModalSubmit({
      filter: (i) => i.customId.startsWith(`resignation_modal_${interaction.user.id}`),
      time: 300000, // 5 минут
    });

    await handleResignationModalSubmit(modalSubmit, client, withBlacklist);

  } catch (error) {
    console.log('[Resignation-Modal] ⏱️ Время ожидания истекло или модальное окно закрыто');
  }
}

/**
 * Обработчик отправки модального окна
 */
async function handleResignationModalSubmit(
  interaction: any,
  client: Client,
  withBlacklist: boolean
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('resignation_reason');

    console.log(`[Resignation-Modal] 📤 Отправка заявления на увольнение от ${interaction.user.tag}`);
    console.log(`[Resignation-Modal] 📝 Причина: ${reason}`);
    console.log(`[Resignation-Modal] ⚠️ С ЧС: ${withBlacklist}`);

    // Получаем данные пользователя из БД
    const user = await prisma.user.findUnique({
      where: { discordId: interaction.user.id },
    });

    if (!user) {
      await interaction.editReply({
        content: '❌ Пользователь не найден в базе данных!',
      });
      return;
    }

    // Создаем заявку в БД
    const application = await prisma.application.create({
      data: {
        userId: user.id,
        type: 'RESIGNATION',
        status: 'PENDING',
        data: {
          reason,
          agreedToBlacklist: withBlacklist, // Сохраняем как agreedToBlacklist
        },
      },
    });

    console.log(`[Resignation-Modal] ✅ Заявка создана с ID: ${application.id}`);

    // Отправляем заявление в канал
    const channel = await client.channels.fetch(RESIGNATION_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error('[Resignation-Modal] ❌ Канал не найден или не является текстовым');
      await interaction.editReply({
        content: '❌ Не удалось отправить заявление. Канал не найден.',
      });
      return;
    }

    // Получаем информацию о пользователе
    const member = await interaction.guild?.members.fetch(interaction.user.id);

    // Создаем embed
    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`<:emoji:${RESIGNATION_EMOJI_ID}> Заявление на увольнение`)
      .addFields(
        { name: '👤 Сотрудник', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🆔 Discord ID', value: interaction.user.id, inline: true },
        { name: '📝 Причина увольнения', value: reason, inline: false }
      )
      .setFooter({ text: `ID заявления: ${application.id}` })
      .setTimestamp();

    // Если согласен на ЧС - добавляем поле
    if (withBlacklist) {
      embed.addFields({
        name: '⚠️ Согласие на ЧС',
        value: 'С ЧС согласен :white_check_mark:',
        inline: false,
      });
    }

    // Кнопка "В рассмотрении"
    const reviewButton = new ButtonBuilder()
      .setCustomId(`resignation_review_${application.id}`)
      .setLabel('В рассмотрении')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(reviewButton);

    // Отправляем сообщение с пингом роли
    const sentMessage = await channel.send({
      content: `<@&${PING_ROLE_ID}>`,
      embeds: [embed],
      components: [row],
    });

    // Сохраняем ID сообщения в БД
    await prisma.application.update({
      where: { id: application.id },
      data: {
        discordMessageId: sentMessage.id,
      },
    });

    console.log(`[Resignation-Modal] 📨 Заявление отправлено в канал ${RESIGNATION_CHANNEL_ID}, messageId: ${sentMessage.id}`);

    // Уведомляем пользователя
    await interaction.editReply({
      content: '✅ Ваше заявление на увольнение успешно отправлено!\n\nОжидайте рассмотрения.',
    });

  } catch (error) {
    console.error('[Resignation-Modal] ❌ Ошибка при отправке заявления:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ Произошла ошибка при отправке заявления. Попробуйте позже.',
      });
    }
  }
}
