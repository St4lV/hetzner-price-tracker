const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const package = require('../../package.json');
const { getAvailableServices } = require('../../cache.js')
const { RemoveAlert, getUserAlerts } = require('../../mongo/mongo-db-connect.js');


const builder = new SlashCommandBuilder()
    .setName('remove-alert')
    .setDescription('Remove a previous set alert.')
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
            .setAutocomplete(true)
    )
module.exports = {
    data: builder,
    async autocomplete(interaction) {
        const user_id = interaction.user.id;
        const req = { body: { user_id } };
        const user_alerts = await getUserAlerts(req);
        const alert_service_ids = user_alerts.map(entry => entry.service_id.toString());
        const services = await getAvailableServices();
        const focusedOption = interaction.options.getFocused(true);
        if (focusedOption.name === 'service_id') {
        const focusedValue = focusedOption.value.toString();
        const choices = services
            .filter(s =>
            alert_service_ids.includes(s.service_id.toString()) &&
            s.service_id.toString().includes(focusedValue)
            )
            .slice(0, 25)
            .map(s => ({
            name: `${s.service_id} - ${s.cpu} (${s.region})`,
            value: s.service_id
            }));
        return await interaction.respond(choices);
        }
        if (focusedOption.name === 'price') {
        const focusedValue = focusedOption.value.toString();
        const selectedServiceId = interaction.options.getNumber('service_id');
        let prices = [];
        if (selectedServiceId !== null) {
            const serviceAlert = user_alerts.find(alert => alert.service_id === selectedServiceId);
            if (serviceAlert) {
            prices = serviceAlert.alert_prices;
            }
        } else {
            user_alerts.forEach(alert => {
            prices.push(...alert.alert_prices);
            });
        }
        const filteredPrices = prices
            .filter(p => p.toString().includes(focusedValue))
            .slice(0, 25)
            .map(p => ({
            name: `${p}€`,
            value: p
            }));
        return await interaction.respond(filteredPrices);
        }
    },
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
            `-# Alert configuration for service ${service_id}:\n 🔔 **❌ Alert removed successfully ** 🔔\n- Service **${service_id}**\n- ↘️ **${service_price}€**\n-# - **${package.displayName} ${package.version}**`,
            flags: MessageFlags.Ephemeral
        }
        const req = {
            body : {
                user_id:interaction.user.id,
                service_id:service_id,
                alert_price : service_price
            }
        }
        const response = await RemoveAlert(req);//console.log(response)
        if (response.error) return await interaction.reply({ content: `❌ Suppression failed. \n-# - **${package.displayName} ${package.version}**`, flags: MessageFlags.Ephemeral });
        if (response.no_alert) return await interaction.reply({
            content: 
           `❌ User not assigned to alert. \n-# - **${package.displayName} ${package.version}**`,
            flags: MessageFlags.Ephemeral
        });
        if (response.response) return await interaction.reply(set_alert_msg);
    }
    
}