/**
 * ✅ ОБРАБОТЧИК: Принятие заявления на увольнение
 * 
 * Действия:
 * 1. Кикает пользователя с Discord сервера
 * 2. Удаляет все данные пользователя из БД
 * 3. Отправляет сообщение в канал управления (1482048392912703505)
 */

import { ButtonInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import { prisma } from '@majestic/database';

const RESIGNATION_APPROVER_ROLES = [
  '1482048390148784234', // IN Management
  '1550899527450632362',
  '1482048390157303913',
  '1482048390157303914',
];

const MANAGEMENT_CHANNEL_ID = '1482048392912703505'; // Канал для уведомлений об увольнении

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

export async function handleResignationAccept(interaction: ButtonInteraction, applicationId: string): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Проверка прав
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      const reply = await interaction.editReply({ content: '❌ Не удалось получить информацию о вашем участии на сервере.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const hasRole = RESIGNATION_APPROVER_ROLES.some(roleId => member.roles.cache.has(roleId));
    if (!hasRole) {
      const reply = await interaction.editReply({ content: '❌ У вас нет прав для принятия заявлений на увольнение.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // Получаем заявление
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });

    if (!application) {
      const reply = await interaction.editReply({ content: '❌ Заявление не найдено.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    if (application.status !== 'REVIEWED') {
      const reply = await interaction.editReply({ content: '❌ Заявление должно быть сначала взято в рассмотрение.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    const data = application.data as any;
    const reason = data?.reason || 'Не указана';
    const withBlacklist = data?.withBlacklist || false;
    const agreedToBlacklist = data?.agreedToBlacklist || false;

    // Финальный статус ЧС: если есть любой из флагов
    const finalBlacklistStatus = withBlacklist || agreedToBlacklist;

    // Создаём ссылку на сообщение в канале увольнений
    const guildId = interaction.guild?.id || '1482048390119555121'; // Guild ID
    const messageUrl = application.discordMessageId 
      ? `https://discord.com/channels/${guildId}/1550131754138869881/${application.discordMessageId}`
      : 'Ссылка не найдена';

    // Получаем member пользователя для кика
    const targetMember = await interaction.guild?.members.fetch(application.user.discordId).catch(() => null);
    const displayName = targetMember?.displayName || application.user.displayName || application.user.username;
    const username = extractNameFromDisplayName(displayName);
    const staticId = extractStaticFromDisplayName(displayName);
    const avatarUrl = targetMember?.user.displayAvatarURL() || undefined;

    // 1. КИКАЕМ пользователя с сервера
    if (targetMember) {
      try {
        await targetMember.kick(`Увольнение одобрено модератором ${interaction.user.tag}`);
        console.log(`[Resignation-Accept] 🥾 Пользователь ${targetMember.user.tag} кикнут с сервера`);
      } catch (error) {
        console.error(`[Resignation-Accept] ❌ Ошибка кика пользователя:`, error);
        const reply = await interaction.editReply({ content: '❌ Не удалось кикнуть пользователя с сервера. Проверьте права бота.' });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        return;
      }
    } else {
      console.log(`[Resignation-Accept] ⚠️ Пользователь не найден на сервере, пропускаем кик`);
    }

    // 2. УДАЛЯЕМ все данные пользователя из БД
    try {
      // Сначала удаляем связанные записи employmentApplication
      await prisma.employmentApplication.deleteMany({
        where: { discordId: application.user.discordId },
      });
      console.log(`[Resignation-Accept] 🗑️ Заявки на трудоустройство пользователя ${application.user.discordId} удалены`);
      
      // Затем удаляем самого пользователя
      await prisma.user.delete({
        where: { id: application.userId },
      });
      console.log(`[Resignation-Accept] 🗑️ Пользователь ${application.userId} удалён из базы данных`);
    } catch (error) {
      console.error(`[Resignation-Accept] ❌ Ошибка удаления пользователя из БД:`, error);
      const reply = await interaction.editReply({ content: '❌ Не удалось удалить пользователя из базы данных.' });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      return;
    }

    // 3. ОТПРАВЛЯЕМ сообщение в канал управления (формат как в Employment)
    try {
      const managementChannel = interaction.guild?.channels.cache.get(MANAGEMENT_CHANNEL_ID) as TextChannel;
      if (managementChannel) {
        const approverDisplayName = member.nickname || member.user.globalName || member.user.username || 'Неизвестно';
        
        // Ссылка на сообщение в канале увольнений (1550131754138869881)
        const messageLink = `https://discord.com/channels/${interaction.guild?.id}/${interaction.channel?.id}/${interaction.message.id}`;
        
        const embed = new EmbedBuilder()
          .setDescription(
            `> <:bookmark:1565036995250749600> **Увольнение одобрено**\n` +
            `> **Причина увольнения**\n` +
            `> ${messageLink}`
          )
          .setColor(0x10b981)
          .addFields(
            { name: 'Уволен\'а', value: `<@${application.user.discordId}>`, inline: true },
            { name: 'Имя Фамилия', value: username, inline: true },
            { name: 'Discord ID', value: application.user.discordId, inline: true },
            { name: 'Одобрил\'а', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Имя Фамилия', value: approverDisplayName, inline: true },
            { name: 'Discord ID', value: interaction.user.id, inline: true }
          )
          .setTimestamp();

        await managementChannel.send({
          content: `<@${interaction.user.id}> увольняет <@${application.user.discordId}>`,
          embeds: [embed]
        });
        console.log(`[Resignation-Accept] 📤 Сообщение об увольнении отправлено в канал ${MANAGEMENT_CHANNEL_ID}`);
      } else {
        console.error(`[Resignation-Accept] ❌ Канал управления не найден: ${MANAGEMENT_CHANNEL_ID}`);
      }
    } catch (error) {
      console.error(`[Resignation-Accept] ❌ Ошибка отправки сообщения в канал управления:`, error);
    }

    // 4. Обновляем embed в Discord (делаем его финальным)
    const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
    originalEmbed.setColor(0x2ecc71); // Зелёный
    originalEmbed.addFields({
      name: '✅ Решение',
      value: `Увольнение **одобрено** пользователем <@${interaction.user.id}>`,
      inline: false,
    });

    await interaction.message.edit({
      embeds: [originalEmbed],
      components: [], // Убираем все кнопки
    });

    const reply = await interaction.editReply({ 
      content: `✅ Заявление на увольнение **${username}** одобрено!\n\n` +
               `👤 Пользователь кикнут с сервера\n` +
               `🗑️ Данные удалены из базы (включая заявки на трудоустройство)\n` +
               `📤 Уведомление отправлено в канал управления`
    });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);

    console.log(`[Resignation-Accept] ✅ Заявление ${applicationId} одобрено пользователем ${interaction.user.tag}`);
  } catch (error) {
    console.error('[Resignation-Accept] ❌ Ошибка:', error);
    
    const errorMessage = '❌ Произошла ошибка при обработке заявления.';
    
    if (interaction.deferred) {
      const reply = await interaction.editReply({ content: errorMessage });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    } else {
      const reply = await interaction.reply({ content: errorMessage, ephemeral: true });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }
  }
}
