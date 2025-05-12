const { EmbedBuilder } = require('discord.js');

/**
 * Create an embed for a new prediction question
 * @param {string} question The yes/no question
 * @param {string} authorId ID of the user who created the question
 * @param {string} authorUsername Username of the user who created the question
 * @param {string} authorAvatar Avatar URL of the user who created the question
 * @param {Date} endTime When the prediction ends
 * @param {string} questionId MongoDB ID of the question
 * @returns {EmbedBuilder} Discord embed
 */
function createQuestionEmbed(question, authorId, authorUsername, authorAvatar, endTime, questionId) {
  return new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('📊 Yes or No Prediction')
    .setDescription(`**${question}**`)
    .addFields(
      { name: 'Created By', value: `<@${authorId}>`, inline: true },
      { name: 'Ends At', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true },
      { name: 'Status', value: '⏳ Open for predictions', inline: true },
      { name: 'Yes Votes', value: '0', inline: true },
      { name: 'No Votes', value: '0', inline: true },
      { name: '\u200B', value: '\u200B', inline: true }
    )
    .setFooter({ text: `Question ID: ${questionId} • Vote with the buttons below` })
    .setTimestamp();
}

/**
 * Create an embed for a resolved prediction
 * @param {Object} question The question document from MongoDB
 * @param {string} resolverUsername Username of the user who resolved the question
 * @returns {EmbedBuilder} Discord embed
 */
function createResolvedEmbed(question, resolverUsername) {
  const outcome = question.outcome ? '✅ Yes' : '❌ No';
  const color = question.outcome ? '#00ff00' : '#ff0000';
  
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('📊 Prediction Resolved')
    .setDescription(`**${question.text}**`)
    .addFields(
      { name: 'Created By', value: `<@${question.createdBy}>`, inline: true },
      { name: 'Resolved By', value: `<@${question.resolvedBy}>`, inline: true },
      { name: 'Outcome', value: outcome, inline: true },
      { name: 'Yes Votes', value: `${question.yesVotes.length}`, inline: true },
      { name: 'No Votes', value: `${question.noVotes.length}`, inline: true },
      { name: 'XP Awarded', value: `${question.outcome ? question.yesVotes.length : question.noVotes.length} users earned XP`, inline: true }
    )
    .setFooter({ text: `Question ID: ${question._id}` })
    .setTimestamp();
}

module.exports = {
  createQuestionEmbed,
  createResolvedEmbed
};