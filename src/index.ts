import { config } from 'dotenv';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { createLogger } from './utils/logger';
import { closeDatabase } from './database/index';
import fs from 'fs';
import path from 'path';

// Load environment variables
try {
  config();
} catch (error) {
  console.error('Error loading dotenv:', error);
}

// Create logger instance
const logger = createLogger('main');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Commands collection (for future slash commands)
(client as any).commands = new Collection();

// Load events
async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  console.log('Loading events from:', eventsPath);
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') && !file.endsWith('.d.ts'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    console.log(`Loading event file: ${file}`);
    
    try {
      const event = require(filePath);
      
      if (event.default.once) {
        client.once(event.default.name, (...args) => event.default.execute(...args));
      } else {
        client.on(event.default.name, (...args) => event.default.execute(...args));
      }
      
      logger.info(`Loaded event: ${event.default.name}`);
    } catch (error) {
      console.error(`Error loading event ${file}:`, error);
      throw error;
    }
  }
}

// Load commands (for future implementation)
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  
  // Check if commands directory exists
  if (!fs.existsSync(commandsPath)) {
    logger.info('Commands directory not found, skipping command loading');
    return;
  }
  
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && !file.endsWith('.d.ts'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command.default && 'execute' in command.default) {
      (client as any).commands.set(command.default.data.name, command.default);
      logger.info(`Loaded command: ${command.default.data.name}`);
    } else {
      logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
    }
  }
}

// Bot startup
async function main() {
  try {
    logger.info('Starting Discord GitHub Bot...');
    
    // Environment check
    console.log('=== Environment Variables Check ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not set');
    console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? 'Set' : 'Not set');
    console.log('TARGET_CHANNEL_ID:', process.env.TARGET_CHANNEL_ID);
    console.log('TARGET_GUILD_ID:', process.env.TARGET_GUILD_ID);
    console.log('================================');
    
    // Validate required environment variables
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.error('ERROR: DISCORD_BOT_TOKEN is not set in Railway Variables!');
      throw new Error('DISCORD_BOT_TOKEN is required');
    }
    
    if (!process.env.GITHUB_TOKEN) {
      console.error('ERROR: GITHUB_TOKEN is not set in Railway Variables!');
      throw new Error('GITHUB_TOKEN is required');
    }
    
    // Load events
    await loadEvents();
    logger.info('Events loaded successfully');
    
    // Load commands
    await loadCommands();
    logger.info('Commands loaded successfully');
    
    // Login to Discord
    logger.info('Attempting to login to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
    logger.info('Successfully logged in to Discord');
    
  } catch (error) {
    logger.error('Failed to start bot:', error);
    console.error('CRITICAL ERROR:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown() {
  logger.info('Shutting down bot...');
  
  try {
    // Close database connections
    await closeDatabase();
    logger.info('Database connections closed');
    
    // Destroy Discord client
    client.destroy();
    logger.info('Discord client destroyed');
    
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
}

// Process signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

// Uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown();
});

// Start the bot
main();