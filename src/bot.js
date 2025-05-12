require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { connectDatabase } = require('./utils/database');
const { updateLeaderboard } = require('./utils/leaderboard');
const config = require('../config.json');

// Initialize Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// Create commands collection
client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

// Load event files
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  
  // Initialize event if it has an init function (for custom events)
  if (typeof event.init === 'function') {
    event.init(client);
  }
  
  console.log(`Loaded event: ${event.name}`);
}

// Setup periodic leaderboard updates
setInterval(() => {
  updateLeaderboard(client);
}, config.leaderboardUpdateInterval);

// Connect to database and then login to Discord
(async () => {
  try {
    // Connect to Firebase
    await connectDatabase();
    console.log('Connected to Firebase');
    
    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
    console.log('Bot logged in to Discord');
  } catch (error) {
    console.error('Failed to start the bot:', error);
    process.exit(1);
  }
})();