const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Question = require('../models/Question');
const User = require('../models/User');
const { createResolvedEmbed } = require('../utils/embeds');
const { updateLeaderboard } = require('../utils/leaderboard');
const config = require('../../config.json');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }
      
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const content = 'There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content, ephemeral: true });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      }
    }
    
    // Handle button interactions
    else if (interaction.isButton()) {
      const customId = interaction.customId;
      
      // Handle voting
      if (customId.startsWith('vote_yes_') || customId.startsWith('vote_no_')) {
        await handleVoteButton(interaction, customId);
      }
      // Handle resolving
      else if (customId.startsWith('resolve_yes_') || customId.startsWith('resolve_no_')) {
        await handleResolveButton(interaction, customId);
      }
    }
  }
};

// Handle vote button clicks
async function handleVoteButton(interaction, customId) {
  try {
    // Extract question ID and vote type
    const questionId = customId.split('_')[2];
    const voteType = customId.split('_')[1]; // 'yes' or 'no'
    
    // Find the question
    const question = await Question.findById(questionId);
    
    if (!question) {
      return interaction.reply({
        content: 'This prediction no longer exists.',
        ephemeral: true
      });
    }
    
    // Check if the question is still active
    if (question.resolved) {
      return interaction.reply({
        content: 'This prediction has already been resolved.',
        ephemeral: true
      });
    }
    
    const isExpired = Date.now() >= question.endTime;
    if (isExpired) {
      return interaction.reply({
        content: 'This prediction has expired and is no longer accepting votes.',
        ephemeral: true
      });
    }
    
    // Get or create user
    await User.findOrCreate(
      interaction.user.id,
      interaction.user.username
    );
    
    // Record the vote
    let updatedQuestion;
    if (voteType === 'yes') {
      updatedQuestion = await Question.addYesVote(questionId, interaction.user.id);
    } else {
      updatedQuestion = await Question.addNoVote(questionId, interaction.user.id);
    }
    
    // Update the message
    const message = await interaction.message.fetch();
    const embed = message.embeds[0];
    
    // Update vote counts in the embed
    const yesField = embed.fields.find(field => field.name === 'Yes Votes');
    const noField = embed.fields.find(field => field.name === 'No Votes');
    
    if (yesField && noField) {
      yesField.value = updatedQuestion.yesVotes.length.toString();
      noField.value = updatedQuestion.noVotes.length.toString();
      
      await interaction.message.edit({
        embeds: [embed]
      });
    }
    
    // Acknowledge the interaction
    return interaction.reply({
      content: `Your vote (${voteType.toUpperCase()}) has been recorded!`,
      ephemeral: true
    });
    
  } catch (error) {
    console.error('Error handling vote button:', error);
    return interaction.reply({
      content: 'An error occurred while processing your vote. Please try again later.',
      ephemeral: true
    });
  }
}

// Handle resolve button clicks
async function handleResolveButton(interaction, customId) {
  try {
    // Extract question ID and outcome
    const questionId = customId.split('_')[2];
    const outcome = customId.split('_')[1] === 'yes'; // true for yes, false for no
    
    // Find the question
    const question = await Question.findById(questionId);
    
    if (!question) {
      return interaction.reply({
        content: 'This prediction no longer exists.',
        ephemeral: true
      });
    }
    
    // Check if the user is authorized to resolve this question
    if (question.createdBy !== interaction.user.id) {
      return interaction.reply({
        content: 'Only the creator of this prediction can resolve it.',
        ephemeral: true
      });
    }
    
    // Check if the question is already resolved
    if (question.resolved) {
      return interaction.reply({
        content: 'This prediction has already been resolved.',
        ephemeral: true
      });
    }
    
    // Acknowledge the interaction
    await interaction.deferUpdate();
    
    // Trigger resolution
    interaction.client.emit('resolveQuestion', question, outcome, interaction.user.id, interaction);
    
  } catch (error) {
    console.error('Error handling resolve button:', error);
    return interaction.reply({
      content: 'An error occurred while resolving the prediction. Please try again later.',
      ephemeral: true
    });
  }
}

// Custom event for resolving questions (used by both button and command)
module.exports.resolveQuestionEvent = async function(client, question, outcome, resolverId, originalInteraction) {
  try {
    // Resolve the question
    const resolvedQuestion = await Question.resolve(question.id, outcome, resolverId);
    
    // Get predictions channel
    const predictionsChannel = client.channels.cache.get(config.predictionsChannelId);
    
    if (!predictionsChannel) {
      throw new Error('Predictions channel not found');
    }
    
    // Get the message
    const message = await predictionsChannel.messages.fetch(resolvedQuestion.messageId);
    
    if (!message) {
      throw new Error('Prediction message not found');
    }
    
    // Create resolved embed
    const embed = createResolvedEmbed(resolvedQuestion, client.users.cache.get(resolverId)?.username || 'Unknown User');
    
    // Disable all buttons
    const disabledComponents = message.components.map(row => {
      const newRow = new ActionRowBuilder();
      
      row.components.forEach(component => {
        const newButton = ButtonBuilder.from(component);
        newButton.setDisabled(true);
        newRow.addComponents(newButton);
      });
      
      return newRow;
    });
    
    // Update the message
    await message.edit({
      embeds: [embed],
      components: disabledComponents
    });
    
    // Award XP to correct voters
    const correctVoters = outcome ? resolvedQuestion.yesVotes : resolvedQuestion.noVotes;
    
    for (const userId of correctVoters) {
      try {
        await User.awardXP(userId, config.xpAward);
      } catch (e) {
        console.error(`Failed to award XP to user ${userId}:`, e);
      }
    }
    
    // Record incorrect predictions
    const incorrectVoters = outcome ? resolvedQuestion.noVotes : resolvedQuestion.yesVotes;
    
    for (const userId of incorrectVoters) {
      try {
        await User.recordIncorrectPrediction(userId);
      } catch (e) {
        console.error(`Failed to record incorrect prediction for user ${userId}:`, e);
      }
    }
    
    // Update the leaderboard
    await updateLeaderboard(client);
    
    // Reply to the original interaction if it exists and hasn't been replied to
    if (originalInteraction) {
      if (originalInteraction.replied || originalInteraction.deferred) {
        await originalInteraction.editReply({
          content: `Prediction resolved as ${outcome ? 'YES' : 'NO'}! XP has been awarded to all correct predictions.`
        });
      } else {
        await originalInteraction.reply({
          content: `Prediction resolved as ${outcome ? 'YES' : 'NO'}! XP has been awarded to all correct predictions.`
        });
      }
    }
    
  } catch (error) {
    console.error('Error resolving question:', error);
    
    if (originalInteraction) {
      if (originalInteraction.replied || originalInteraction.deferred) {
        await originalInteraction.editReply({
          content: 'An error occurred while resolving the prediction. Please try again later.'
        });
      } else {
        await originalInteraction.reply({
          content: 'An error occurred while resolving the prediction. Please try again later.',
          ephemeral: true
        });
      }
    }
  }
};

// Register the custom event
module.exports.init = function(client) {
  client.on('resolveQuestion', async (question, outcome, resolverId, originalInteraction) => {
    await module.exports.resolveQuestionEvent(client, question, outcome, resolverId, originalInteraction);
  });
};