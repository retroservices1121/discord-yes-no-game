const { updateLeaderboard } = require('../utils/leaderboard');
const Question = require('../models/Question');
const config = require('../../config.json');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
    // Initial leaderboard update
    try {
      await updateLeaderboard(client);
      console.log('Initial leaderboard updated');
    } catch (error) {
      console.error('Failed to update initial leaderboard:', error);
    }
    
    // Check for expired questions
    try {
      const expiredQuestions = await Question.getExpiredUnresolved();
      
      if (expiredQuestions.length > 0) {
        console.log(`Found ${expiredQuestions.length} expired but unresolved questions`);
        
        const predictionsChannel = client.channels.cache.get(config.predictionsChannelId);
        
        if (predictionsChannel) {
          for (const question of expiredQuestions) {
            try {
              const message = await predictionsChannel.messages.fetch(question.messageId);
              
              if (message) {
                // Update the message to show it's expired
                const embed = message.embeds[0];
                embed.data.fields.find(f => f.name === 'Status').value = '⏰ Expired (waiting for resolution)';
                
                // Add resolution buttons
                const actionRow = message.components[0];
                
                // If we have buttons, update them
                if (actionRow && actionRow.components.length > 0) {
                  actionRow.components.forEach(button => {
                    if (button.customId.startsWith('vote_')) {
                      button.data.disabled = true;
                    }
                  });
                  
                  // Add resolve buttons if creator is still in the server
                  try {
                    await client.guilds.cache.first().members.fetch(question.createdBy);
                    
                    // Add resolution buttons row
                    const resolveRow = {
                      type: 1,
                      components: [
                        {
                          type: 2,
                          style: 3,
                          label: 'Resolve as Yes',
                          custom_id: `resolve_yes_${question._id}`
                        },
                        {
                          type: 2,
                          style: 4,
                          label: 'Resolve as No',
                          custom_id: `resolve_no_${question._id}`
                        }
                      ]
                    };
                    
                    await message.edit({
                      embeds: [embed],
                      components: [actionRow, resolveRow]
                    });
                  } catch (e) {
                    // Creator not in server anymore, just disable voting buttons
                    await message.edit({
                      embeds: [embed],
                      components: [actionRow]
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`Failed to update expired question ${question._id}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to check for expired questions:', error);
    }
  },
};