const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const package = require('../../package.json');
const { getAvailableServices } = require('../../cache.js')
const { UpdateAlert } = require("../../mongo/mongo-db-connect");


const builder = new SlashCommandBuilder()
    .setName('set-alert')
    .setDescription('Set an alert based on service id and desired price.')
    .addNumberOption(option =>
        option.setName('service_id')
            .setDescription('Service_id')
            .setRequired(true)
            .setAutocomplete(true)
    )
    .addNumberOption(option =>
        option.setName('price')
            .setDescription('Price')
            .setRequired(true)
    )
module.exports = {
    data: builder,

    async autocomplete(interaction) {
        const services = await getAvailableServices();
        const focusedOption = interaction.options.getFocused(true);
    
        if (focusedOption.name === 'service_id') {
            const focusedValue = focusedOption.value.toString();
    
            const choices = services
                .filter(s => s.service_id.toString().includes(focusedValue))
                .slice(0, 25)
                .map(s => ({
                    name: `${s.service_id} - ${s.cpu} (${s.region})`,
                    value: s.service_id
                }));
    
            await interaction.respond(choices);
        }
    }
    ,
    async execute(interaction) {
        const service_id = interaction.options.getNumber('service_id');
        const service_price = interaction.options.getNumber('price');
        
        if (service_id<0) return await interaction.reply({ content: `❌ Service id needs to be a positive integer. \n-# - **${package.displayName} ${package.version}**`, flags: MessageFlags.Ephemeral });
        if (service_price<0) return await interaction.reply({ content: `❌ Service price needs to be a positive integer. \n-# - **${package.displayName} ${package.version}**`, flags: MessageFlags.Ephemeral });
        
        const services = await getAvailableServices();
        const foundService = services.find(s => s.service_id === service_id);
        if (!foundService) return await interaction.reply({ content: `❌ Service not found. \n-# - **${package.displayName} ${package.version}**`, flags: MessageFlags.Ephemeral });
        
        



        const set_alert_msg = {
            content: 
            `-# Alert configuration for service ${service_id}:\n 🔔 **New Alert set ** 🔔\n- Service **${service_id}**\n- ↘️ **${service_price}€**\n-# - **${package.displayName} ${package.version}**`,
            flags: MessageFlags.Ephemeral
        }
        const req = {
            body : {
                user_id:interaction.user.id,
                service_id:service_id,
                alert_price : service_price
            }
        }
        const response = await UpdateAlert(req);//console.log(response)
        if (response.error) return await interaction.reply({ content: `❌ Update failed. \n-# - **${package.displayName} ${package.version}**`, flags: MessageFlags.Ephemeral });
        if (response.update) return await interaction.reply({
            content: 
            `-# Alert configuration for service ${service_id}:\n 🔔 **Updated Alert ** 🔔\n- Service **${service_id}**\n- ↘️ **${service_price}€**\n-# - **${package.displayName} ${package.version}**`,
            flags: MessageFlags.Ephemeral
        });
        if (response.response) return await interaction.reply(set_alert_msg);
    }
    
}