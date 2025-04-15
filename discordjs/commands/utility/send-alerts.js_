const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const package = require('../../package.json');
const { SendAlerts } = require('../../mongo/mongo-db-connect')


const builder = new SlashCommandBuilder()
    .setName('send-alerts')
    .setDescription('Provides the most recent service information for a given component ID.')

module.exports = {
    data: builder,
    async execute(interaction) {
    await SendAlerts();
    return await interaction.reply({
            content: 
           `Alerts sent. \n-# - **${package.displayName} ${package.version}**`,
            flags: MessageFlags.Ephemeral
        });
    }
    
}