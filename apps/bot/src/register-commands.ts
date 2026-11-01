import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config();

const commands: any[] = [];

// Load all command files
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const command = await import(join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`✅ Загружена команда: ${command.data.name}`);
  }
}

// Register commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

try {
  console.log(`🔄 Начинаю регистрацию ${commands.length} команд...`);

  const data = await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID!,
      process.env.DISCORD_GUILD_ID!
    ),
    { body: commands }
  ) as any[];

  console.log(`✅ Успешно зарегистрировано ${data.length} команд!`);
} catch (error) {
  console.error('❌ Ошибка регистрации команд:', error);
}
