import { config } from 'dotenv';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { prisma } from '@majestic/database';
import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { startBlacklistRemovalModule, stopBlacklistRemovalModule } from './modules/blacklist-removal/index.js';
import { handleBlacklistButton, handleBlacklistModal } from './modules/blacklist-removal/buttons.js';
import { startEmploymentModule, stopEmploymentModule } from './modules/employment/index.js';
import { handleEmploymentAccept, handleEmploymentAcceptModal } from './modules/employment/buttons/accept.js';
import { handleEmploymentCall, handleEmploymentCallSelect } from './modules/employment/buttons/call.js';
import { handleEmploymentReject, handleEmploymentRejectModal } from './modules/employment/buttons/reject.js';
import { startVacationModule, stopVacationModule } from './modules/vacation/index.js';
import { handleVacationApprove } from './modules/vacation/buttons/approve.js';
import { handleVacationReject, handleVacationRejectModal } from './modules/vacation/buttons/reject.js';
import { handleResignationSubmit, handleResignationConfirm } from './modules/resignation/buttons/submit.js';
import { handleResignationReview } from './modules/resignation/buttons/review.js';
import { handleResignationAccept } from './modules/resignation/buttons/accept.js';
import { handleResignationReject, handleResignationRejectModal } from './modules/resignation/buttons/reject.js';
import { handleResignationCancel } from './modules/resignation/buttons/cancel.js';
import { registerResignationHandlers } from './modules/resignation/index.js';
import { registerTransferModule, stopTransferModule } from './modules/transfer/index.js';
import { handleTransferButton } from './modules/transfer/buttons/button.js';
import { handleDepartmentSelect, handleTransferModalSubmit, handleDepartmentButtonClick, handleApproveButton, handleRejectButton, handleApproveConfirm, handleRejectConfirm } from './modules/transfer/index.js';
import { handleCancelButton } from './modules/transfer/buttons/department.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

// Create Discord client
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
}) as Client & { commands: Collection<string, any> };

// Command collection
client.commands = new Collection();

// Load commands
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => 
  file.endsWith('.ts') || file.endsWith('.js')
);

for (const file of commandFiles) {
  const command = await import(join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Загружена команда: ${command.data.name}`);
  }
}

// Client ready event
client.once('clientReady', (c) => {
  console.log(`✅ Discord бот подключен как ${c.user.tag}`);
  console.log(`🔗 Присутствует на ${c.guilds.cache.size} серверах`);
  console.log(`📋 Загружено ${client.commands.size} команд`);
  
  // Запуск модулей
  startBlacklistRemovalModule(client);
  startEmploymentModule(client);
  startVacationModule(client);
  registerResignationHandlers(client);
  registerTransferModule(client);
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
  // Обработка модальных окон
  if (interaction.isModalSubmit()) {
    // Проверяем, относится ли модалка к модулю blacklist
    if (interaction.customId.startsWith('blacklist_')) {
      await handleBlacklistModal(interaction);
      return;
    }
    
    // Проверяем, относится ли модалка к модулю employment
    if (interaction.customId.startsWith('employment_accept_modal_')) {
      await handleEmploymentAcceptModal(interaction, client);
      return;
    }
    
    if (interaction.customId.startsWith('employment_reject_modal_')) {
      await handleEmploymentRejectModal(interaction, client);
      return;
    }
    
    // Проверяем, относится ли модалка к модулю vacation
    if (interaction.customId.startsWith('vacation_reject_modal_')) {
      await handleVacationRejectModal(interaction, client);
      return;
    }
    
    // Проверяем, относится ли модалка к модулю resignation
    if (interaction.customId.startsWith('resignation_reject_modal_')) {
      const applicationId = interaction.customId.replace('resignation_reject_modal_', '');
      await handleResignationRejectModal(interaction, applicationId);
      return;
    }
    
    // Проверяем, относится ли модалка к модулю transfer
    if (interaction.customId.startsWith('transfer_modal_')) {
      await handleTransferModalSubmit(interaction);
      return;
    }
    
    if (interaction.customId.startsWith('transfer_approve_confirm_')) {
      await handleApproveConfirm(interaction);
      return;
    }
    
    if (interaction.customId.startsWith('transfer_reject_')) {
      await handleRejectConfirm(interaction);
      return;
    }
  }

  // Обработка кнопок
  if (interaction.isButton()) {
    console.log(`[Button] 🔘 Нажата кнопка: ${interaction.customId}`);
    
    // Проверяем, относится ли кнопка к модулю blacklist
    if (interaction.customId.startsWith('blacklist_')) {
      await handleBlacklistButton(interaction);
      return;
    }
    
    // Проверяем, относится ли кнопка к модулю employment
    if (interaction.customId.startsWith('employment_accept_')) {
      await handleEmploymentAccept(interaction, client);
      return;
    }
    
    if (interaction.customId.startsWith('employment_call_')) {
      await handleEmploymentCall(interaction, client);
      return;
    }
    
    if (interaction.customId.startsWith('employment_reject_')) {
      await handleEmploymentReject(interaction, client);
      return;
    }
    
    // Проверяем, относится ли кнопка к модулю vacation
    if (interaction.customId.startsWith('vacation_approve_')) {
      await handleVacationApprove(interaction, client);
      return;
    }
    
    if (interaction.customId.startsWith('vacation_reject_')) {
      await handleVacationReject(interaction, client);
      return;
    }
    
    // Проверяем, относится ли кнопка к модулю resignation
    if (interaction.customId === 'resignation_submit') {
      await handleResignationSubmit(interaction, client);
      return;
    }
    
    if (interaction.customId.startsWith('resignation_confirm_')) {
      await handleResignationConfirm(interaction, client);
      return;
    }
    
    if (interaction.customId.startsWith('resignation_review_')) {
      const applicationId = interaction.customId.replace('resignation_review_', '');
      await handleResignationReview(interaction, applicationId);
      return;
    }
    
    if (interaction.customId.startsWith('resignation_accept_')) {
      const applicationId = interaction.customId.replace('resignation_accept_', '');
      await handleResignationAccept(interaction, applicationId);
      return;
    }
    
    if (interaction.customId.startsWith('resignation_reject_')) {
      const applicationId = interaction.customId.replace('resignation_reject_', '');
      await handleResignationReject(interaction, applicationId);
      return;
    }
    
    if (interaction.customId.startsWith('resignation_cancel_')) {
      const applicationId = interaction.customId.replace('resignation_cancel_', '');
      await handleResignationCancel(interaction, applicationId);
      return;
    }
    
    // Проверяем, относится ли кнопка к модулю transfer
    if (interaction.customId === 'transfer_submit') {
      await handleTransferButton(interaction);
      return;
    }
    
    if (interaction.customId.startsWith('transfer_dept_')) {
      await handleDepartmentButtonClick(interaction);
      return;
    }
    
    if (interaction.customId.startsWith('transfer_approve_')) {
      await handleApproveButton(interaction);
      return;
    }
    
    if (interaction.customId.startsWith('transfer_reject_')) {
      await handleRejectButton(interaction);
      return;
    }
    
    if (interaction.customId.startsWith('transfer_cancel_')) {
      await handleCancelButton(interaction);
      return;
    }
    
    // Если кнопка не обработана - логируем
    console.log(`[Button] ⚠️ Необработанная кнопка: ${interaction.customId}`);
  }
  
  // Обработка select menu
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('employment_call_select_')) {
      await handleEmploymentCallSelect(interaction, client);
      return;
    }
    
    if (interaction.customId === 'transfer_department_select') {
      await handleDepartmentSelect(interaction);
      return;
    }
  }

  // Обработка команд
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Команда не найдена: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Ошибка выполнения команды ${interaction.commandName}:`, error);
    const reply = {
      content: '❌ Произошла ошибка при выполнении команды!',
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// Member join event
client.on('guildMemberAdd', async (member) => {
  console.log(`👋 Новый участник: ${member.user.tag}`);
  
  try {
    const displayName = (member.user as any).globalName || member.user.username;
    
    await prisma.user.upsert({
      where: { discordId: member.id },
      create: {
        discordId: member.id,
        username: member.user.username,
        displayName: displayName,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
        email: null,
        role: 'MEMBER',
      },
      update: {
        username: member.user.username,
        displayName: displayName,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
      },
    });

    await member.send({
      content: `Добро пожаловать на сервер, ${displayName}! 🎉\n\nВы можете зайти на портал: ${process.env.NEXTAUTH_URL}`,
    }).catch(() => {
      console.log(`Не удалось отправить приветственное сообщение ${member.user.tag}`);
    });
  } catch (error) {
    console.error('Ошибка при добавлении участника:', error);
  }
});

// Member leave event
client.on('guildMemberRemove', async (member) => {
  console.log(`👋 Участник покинул сервер: ${member.user.tag}`);
  
  try {
    await prisma.user.update({
      where: { discordId: member.id },
      data: { status: 'INACTIVE' },
    });
  } catch (error) {
    console.error('Ошибка при обновлении статуса:', error);
  }
});

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Login
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ DISCORD_TOKEN не найден в переменных окружения');
  process.exit(1);
}

client.login(token).catch((error) => {
  console.error('❌ Не удалось подключить бота:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Остановка бота...');
  stopBlacklistRemovalModule();
  stopEmploymentModule();
  stopVacationModule();
  stopTransferModule();
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Остановка бота...');
  stopBlacklistRemovalModule();
  stopEmploymentModule();
  stopVacationModule();
  stopTransferModule();
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});
