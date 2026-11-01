import type { ButtonInteraction, Client, GuildMember, TextChannel } from 'discord.js';
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { prisma, EmploymentStatus } from '@majestic/database';

/**
 * 🟢 КНОПКА "ПРИНЯТЬ"
 * 
 * 1. Открывается модальное окно для ввода ссылки на документы
 * 2. Выдаются роли: 1482048390119555125, 1518670894531219617, 1482048390136070326
 * 3. Отправляется отчёт в канал 1517887123775029369
 * 4. Отправляется сообщение в канал 1482048392912703505
 * 5. Канал удаляется через 10 секунд
 */

const ROLES_TO_ADD = [
  '1482048390119555125', // Роль 1
  '1518670894531219617', // Роль 2
  '1482048390136070326', // Роль 3
];

const REPORT_CHANNEL_ID = '1517887123775029369'; // Канал для отчётов
const NOTIFICATION_CHANNEL_ID = '1482048392912703505'; // Канал для уведомлений

// 🔒 РОЛИ С ДОСТУПОМ К КНОПКАМ
const ALLOWED_ROLES = [
  '1482048390157303914',
  '1482048390157303913',
  '1550078792813256754',
  '1552362101866102895',
  '1482048390148784239',
  '1482048390148784233',
  '1482048390148784234',
  '1482048390136070329',
];

export async function handleEmploymentAccept(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  try {
    // 🔒 ПРОВЕРКА РОЛЕЙ
    const member = interaction.member as GuildMember;
    const hasPermission = member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));

    if (!hasPermission) {
      await interaction.reply({
        content: '❌ У вас нет прав для использования этой кнопки.',
        ephemeral: true
      });
      return;
    }

    // Извлекаем ID заявки из customId кнопки
    const applicationId = interaction.customId.split('_')[2];

    // Создаём модальное окно
    const modal = new ModalBuilder()
      .setCustomId(`employment_accept_modal_${applicationId}`)
      .setTitle('Принятие кандидата');

    const documentInput = new TextInputBuilder()
      .setCustomId('documents_url')
      .setLabel('Ссылка на документы кандидата')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://drive.google.com/...')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(documentInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  } catch (error) {
    console.error('❌ [Accept Button] Ошибка:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Произошла ошибка при открытии формы.',
        ephemeral: true
      });
    }
  }
}

/**
 * Обработчик отправки модального окна
 */
export async function handleEmploymentAcceptModal(
  interaction: any,
  client: Client
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Извлекаем ID заявки
    const applicationId = interaction.customId.split('_')[3];
    const documentsUrl = interaction.fields.getTextInputValue('documents_url');

    // Получаем заявку из БД
    const application = await prisma.employmentApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      await interaction.editReply('❌ Заявка не найдена.');
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply('❌ Сервер не найден.');
      return;
    }

    // Получаем участника
    const member = await guild.members.fetch(application.discordId).catch(() => null);
    if (!member) {
      await interaction.editReply('❌ Пользователь не найден на сервере.');
      return;
    }

    // Получаем информацию о том, кто принял
    const acceptedBy = interaction.member as GuildMember;

    // 🎭 МЕНЯЕМ НИК КАНДИДАТА
    const newNickname = `IN | ${application.firstName} ${application.lastName} | ${application.static}`;
    try {
      await member.setNickname(newNickname);
      console.log(`✅ Ник изменён: ${newNickname}`);
    } catch (error) {
      console.error('❌ Ошибка смены ника:', error);
      // Продолжаем выполнение даже если не удалось сменить ник
    }

    // ✅ ВЫДАЁМ РОЛИ
    console.log(`🎭 Выдаём роли пользователю ${member.user.tag}...`);
    for (const roleId of ROLES_TO_ADD) {
      try {
        await member.roles.add(roleId);
        console.log(`✅ Роль ${roleId} выдана`);
      } catch (error) {
        console.error(`❌ Не удалось выдать роль ${roleId}:`, error);
      }
    }

    // 📊 ОТЧЁТ О СОБЕСЕДОВАНИИ
    try {
      const reportChannel = await guild.channels.fetch(REPORT_CHANNEL_ID).catch(() => null) as TextChannel | null;
      if (reportChannel && reportChannel.isTextBased()) {
        const reportEmbed = new EmbedBuilder()
          .setTitle('📋 Принятие кандидата - Документы')
          .setColor(0x10b981) // Green
          .addFields(
            {
              name: '👤 Проведён собеседование',
              value: `${acceptedBy}`,
              inline: false
            },
            {
              name: '🎫 Имя Фамилия кандидата',
              value: `${application.firstName} ${application.lastName}`,
              inline: true
            },
            {
              name: '🆔 Статик кандидата',
              value: application.static,
              inline: true
            },
            {
              name: '✅ Статус',
              value: 'Принят',
              inline: false
            },
            {
              name: '🔗 Ссылка на документы',
              value: documentsUrl,
              inline: false
            }
          )
          .setFooter({ text: `${acceptedBy.user.username} • Документы по принятию • Сегодня, в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` })
          .setTimestamp();

        await reportChannel.send({ embeds: [reportEmbed] });
        console.log('✅ Отчёт отправлен в канал отчётов');
      } else {
        console.warn('⚠️ Канал отчётов не найден или нет доступа:', REPORT_CHANNEL_ID);
      }
    } catch (error) {
      console.error('❌ Ошибка отправки отчёта:', error);
    }

    // 📢 УВЕДОМЛЕНИЕ В КАНАЛ КАДРОВЫХ РЕШЕНИЙ (1482048392912703505)
    try {
      const notificationChannel = await guild.channels.fetch(NOTIFICATION_CHANNEL_ID).catch(() => null) as TextChannel | null;
      if (notificationChannel && notificationChannel.isTextBased()) {
        const recruiterDisplayName = acceptedBy.nickname || acceptedBy.user.globalName || acceptedBy.user.username || 'Неизвестно';
        
        const hrDecisionEmbed = new EmbedBuilder()
          .setDescription(
            `> <:bookmark:1565036995250749600> **Отчет о приеме сотрудника**\n` +
            `> **Причина принятия:** Собеседование\n` +
            `> **Принят'а на:** 1 ранг`
          )
          .setColor(0x10b981)
          .addFields(
            { name: 'Принят\'а', value: `<@${application.discordId}>`, inline: true },
            { name: 'Имя Фамилия', value: `${application.firstName} ${application.lastName}`, inline: true },
            { name: 'Discord ID', value: application.discordId, inline: true },
            { name: 'Принял\'а', value: `<@${acceptedBy.id}>`, inline: true },
            { name: 'Имя Фамилия', value: recruiterDisplayName, inline: true },
            { name: 'Discord ID', value: acceptedBy.id, inline: true }
          )
          .setTimestamp();

        // Отправляем пинги как обычное сообщение + embed
        await notificationChannel.send({
          content: `<@${acceptedBy.id}> принимает <@${application.discordId}>`,
          embeds: [hrDecisionEmbed]
        });
        console.log('✅ Уведомление отправлено в канал кадровых решений');
      } else {
        console.warn('⚠️ Канал уведомлений не найден или нет доступа:', NOTIFICATION_CHANNEL_ID);
      }
    } catch (error) {
      console.error('❌ Ошибка отправки уведомления:', error);
    }

    // 💾 ОБНОВЛЯЕМ СТАТУС В БД
    await prisma.employmentApplication.update({
      where: { id: applicationId },
      data: {
        status: EmploymentStatus.APPROVED,
        reviewNote: `Документы: ${documentsUrl}`,
        reviewedBy: acceptedBy.id,
        reviewedAt: new Date(),
        processedAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log('✅ Статус в БД обновлён: APPROVED');

    // ✅ ОТПРАВЛЯЕМ ОТВЕТ
    await interaction.editReply(`✅ Кандидат **${application.firstName} ${application.lastName}** принят! Роли выданы, отчёты отправлены.`);

    // 🗑️ УДАЛЯЕМ КАНАЛ ЧЕРЕЗ 10 СЕКУНД
    const channel = interaction.channel as TextChannel;
    if (channel && channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ManageChannels)) {
      setTimeout(async () => {
        try {
          await channel.delete('Заявка обработана - кандидат принят');
          console.log(`✅ Канал ${channel.name} удалён`);
        } catch (error) {
          console.error('❌ Не удалось удалить канал:', error);
        }
      }, 10000);
    }

  } catch (error) {
    console.error('❌ [Accept Modal] Ошибка:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Произошла ошибка при обработке заявки.',
        ephemeral: true
      });
    } else {
      await interaction.editReply('❌ Произошла ошибка при обработке заявки.');
    }
  }
}
