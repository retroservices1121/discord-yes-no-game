const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const config = require('../../config.json');

/**
 * Update the leaderboard in the designated channel
 * @param {Client} client Discord.js client
 */
async function updateLeaderboard(client) {
  try {
    const leaderboardChannel = client.channels.cache.get(config.leaderboardChannelId);
    
    if (!leaderboardChannel) {
      console.error(`Leaderboard channel with ID ${config.leaderboardChannelId} not found`);
      return;
    }
    
    // Get top 10 users by XP
    const topUsers = await User.getTopByXP(10);
    
    if (topUsers.length === 0) {
      console.log('No users found for leaderboard');
      return;
    }
    
    // Create leaderboard embed
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🏆 Prediction Game Leaderboard')
      .setDescription('Top players ranked by XP')
      .setTimestamp();
    
    // Add leaderboard entries
    let leaderboardText = '';
    
    topUsers.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const discordId = user.platforms?.discord?.id;
      const username = user.platforms?.discord?.username || 'Unknown User';
      
      if (discordId) {
        leaderboardText += `${medal} <@${discordId}>: **${user.xp}** XP (${user.correctPredictions} correct predictions)\n`;
      } else {
        leaderboardText += `${medal} ${username}: **${user.xp}** XP (${user.correctPredictions} correct predictions)\n`;
      }
    });
    
    embed.addFields({ name: 'Rankings', value: leaderboardText || 'No rankings yet' });
    
    // Find existing leaderboard message or send a new one
    const messages = await leaderboardChannel.messages.fetch({ limit: 10 });
    const leaderboardMessage = messages.find(m => 
      m.author.id === client.user.id && 
      m.embeds.length > 0 && 
      m.embeds[0].title === '🏆 Prediction Game Leaderboard'
    );
    
    if (leaderboardMessage) {
      await leaderboardMessage.edit({ embeds: [embed] });
    } else {
      await leaderboardChannel.send({ embeds: [embed] });
    }
    
    console.log('Leaderboard updated successfully');
  } catch (error) {
    console.error('Error updating leaderboard:', error);
  }
}

module.exports = {
  updateLeaderboard
};