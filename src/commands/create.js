const { SlashCommandBuilder } = require('discord.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ms = require('ms');
const Question = require('../models/Question');
const User = require('../models/User');
const { createQuestionEmbed } = require('../utils/embeds');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new yes/no prediction question')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('The yes/no question to predict')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('How long the prediction will be open (e.g., 1h, 1d, 3d)')
        .setRequired(true)),
        
  async execute(interaction) {
    try {
      // Get the question and duration
      const questionText = interaction.options.getString('question');
      const durationText = interaction.options.getString('duration');
      
      // Parse the duration
      let durationMs;
      try {
        durationMs = ms(durationText);
      } catch (error) {
        return interaction.reply({
          content: 'Invalid duration format. Please use formats like "1h" for 1 hour or "2d" for 2 days.',
          ephemeral: true
        });
      }
      
      // Ensure duration is between 1 hour and 7 days
      if (durationMs < ms('1h') || durationMs > ms('7d')) {
        return interaction.reply({
          content: 'Duration must be between 1 hour and 7 days.',
          ephemeral: true
        });
      }
      
      // Calculate end time
      const endTime = new Date(Date.now() + durationMs);
      
      // Create or get the user
      await User.findOrCreate(
        interaction.user.id,
        interaction.user.username
      );
      
      // Get predictions channel
      const predictionsChannel = interaction.client.channels.cache.get(config.predictionsChannelId);
      
      if (!predictionsChannel) {
        return interaction.reply({
          content: 'Predictions channel not found. Please contact an administrator.',
          ephemeral: true
        });
      }
      
      // Acknowledge the command
      await interaction.deferReply();
      
      // Create a new question document (without messageId for now)
      const question = await Question.create({
        text: questionText,
        createdBy: interaction.user.id,
        endTime: endTime,
        messageId: 'placeholder' // Will update after sending the message
      });
      
      // Create buttons
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_yes_${question.id}`)
            .setLabel('Vote Yes')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`vote_no_${question.id}`)
            .setLabel('Vote No')
            .setStyle(ButtonStyle.Danger)
        );
      
      // Create embed
      const embed = createQuestionEmbed(
        questionText,
        interaction.user.id,
        interaction.user.username,
        interaction.user.displayAvatarURL(),
        endTime,
        question.id
      );
      
      // Send the message to the predictions channel
      const message = await predictionsChannel.send({
        embeds: [embed],
        components: [buttons]
      });
      
      // Update the question with the message ID
      await Question.updateMessageId(question.id, message.id);
      
      // Reply to the command
      await interaction.editReply({
        content: `Your prediction question has been posted in <#${predictionsChannel.id}>!`,
        components: []
      });
      
    } catch (error) {
      console.error('Error creating prediction:', error);
      return interaction.reply({
        content: 'An error occurred while creating the prediction. Please try again later.',
        ephemeral: true
      });
    }
  }
};