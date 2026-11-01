import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@majestic/database';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Посмотреть статистику пользователя')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Пользователь (по умолчанию вы)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  
  await interaction.deferReply();

  try {
    const user = await prisma.user.findUnique({
      where: { discordId: targetUser.id },
      include: {
        hrStats: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        applications: {
          where: { status: 'PENDING' },
        },
      },
    });

    if (!user) {
      return interaction.editReply({
        content: '❌ Пользователь не найден в системе',
      });
    }

    const latestStats = user.hrStats[0];
    const pendingApps = user.applications.length;

    const embed = {
      color: 0x0099ff,
      title: `📊 Статистика ${targetUser.username}`,
      fields: [
        {
          name: 'Роль',
          value: user.role,
          inline: true,
        },
        {
          name: 'Статус',
          value: user.status,
          inline: true,
        },
        {
          name: 'Заявки на рассмотрении',
          value: pendingApps.toString(),
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    if (latestStats) {
      embed.fields.push(
        {
          name: '📈 Последняя неделя',
          value: `Неделя ${latestStats.weekNumber}/${latestStats.year}`,
          inline: false,
        },
        {
          name: 'Собеседования',
          value: latestStats.interviews.toString(),
          inline: true,
        },
        {
          name: 'Найм',
          value: latestStats.hires.toString(),
          inline: true,
        },
        {
          name: 'Балл',
          value: latestStats.score.toFixed(1),
          inline: true,
        }
      );
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error executing stats command:', error);
    await interaction.editReply({
      content: '❌ Произошла ошибка при получении статистики',
    });
  }
}
