const { SlashCommandBuilder, MessageFlags, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const package = require('../../package.json');
const { getAvailableServices } = require('../../cache.js')
const { backend_address} = require('../../config.json');

const storageFields = Array.from({ length: 4 }, (_, i) => i + 1);

function generatePriceChart(result) {
    const history = result.history;

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#00000000';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = '24px DejaVu Sans", sans-serif';
    ctx.fillText(`${result.id} :`, 20, 40);

    const margin = { top: 60, right: 60, bottom: 60, left: 150 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    const prices = history.map(p => parseFloat(p.price));
    const timestamps = history.map(p => new Date(p.timestamp).getTime());

    const rawMin = Math.min(...prices);
    const minPrice = Math.max(0, Math.floor((rawMin-10) / 10) * 10);
    
    const maxPrice = Math.ceil(Math.max(...prices) / 10) * 10 + 10;

    const minTime = Math.min(...timestamps);
    const maxTime = Date.now();

    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.font = '16px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#aaaaaa';

    for (let price = minPrice; price <= maxPrice; price += 10) {
        const y = margin.top + ((maxPrice - price) / (maxPrice - minPrice)) * graphHeight;

        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();

        ctx.fillText(`${price.toFixed(2)} €`, margin.left - 60, y + 5);
    }

    ctx.strokeStyle = '#888888';
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();

const lastTimestamp = Math.max(...timestamps);

const lastDatePrices = history.filter(p => new Date(p.timestamp).getTime() === lastTimestamp);

const lastMinPrice = Math.min(...lastDatePrices.map(p => parseFloat(p.price)));

const lastMinY = margin.top + ((maxPrice - lastMinPrice) / (maxPrice - minPrice)) * graphHeight;

    ctx.strokeStyle = '#ffaaaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, lastMinY);
    ctx.lineTo(width - margin.right, lastMinY);
    ctx.stroke();

    ctx.fillStyle = '#ffaaaa';
    ctx.font = '16px "DejaVu Sans", sans-serif';
    ctx.fillText(`${lastMinPrice.toFixed(2)} €`, margin.left - 120, lastMinY + 5);


    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '16px "DejaVu Sans", sans-serif';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
        const t = minTime + ((maxTime - minTime) * i) / steps;
        const date = new Date(t);
        const label = `${date.getDate()}/${date.getMonth() + 1}`;
        const x = margin.left + (i / steps) * graphWidth;
        ctx.fillText(label, x, height - margin.bottom + 20);
    }
    ctx.strokeStyle = '#4e79a7';
    ctx.lineWidth = 2;
    ctx.beginPath();

    history.forEach((point, i) => {
        const time = new Date(point.timestamp).getTime();
        const price = parseFloat(point.price);

        const x = margin.left + ((time - minTime) / (maxTime - minTime)) * graphWidth;
        const y = margin.top + ((maxPrice - price) / (maxPrice - minPrice)) * graphHeight;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            const prev = history[i - 1];
            const prevX = margin.left + ((new Date(prev.timestamp).getTime() - minTime) / (maxTime - minTime)) * graphWidth;
            const prevY = margin.top + ((maxPrice - parseFloat(prev.price)) / (maxPrice - minPrice)) * graphHeight;

            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
        }

        ctx.fillStyle = '#4e79a7';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
    });
    ctx.stroke();

    return canvas.toBuffer();
}

const builder = new SlashCommandBuilder()
    .setName('find-service')
    .setDescription('Find services based on components provided and return cheapest results.')
    .addStringOption(option =>
        option.setName('cpu')
            .setDescription('CPU')
            .setRequired(false)
            .setAutocomplete(true)
    )
    .addStringOption(option =>
        option.setName('ram')
            .setDescription('RAM')
            .setRequired(false)
            .setAutocomplete(true)
    )
    .addStringOption(option =>
        option.setName('datacenter')
            .setDescription('Datacenter')
            .setRequired(false)
            .setAutocomplete(true)
    )
    .addStringOption(option =>
        option.setName('gpu')
            .setDescription('GPU')
            .setRequired(false)
            .setAutocomplete(true)
    )
    .addNumberOption(option =>
        option.setName('results')
            .setDescription('Number of result pages to display (1 - 100, default:20)')
            .setRequired(false)
    );
    

storageFields.forEach(i => {
    builder.addStringOption(option =>
        option.setName(`storage${i}`)
            .setDescription(`Storage disk #${i}`)
            .setRequired(false)
            .setAutocomplete(true)
    );
});

module.exports = {
    data: builder,

    async autocomplete(interaction) {
            const focusedOption = interaction.options.getFocused(true);
            const selectedOptions = interaction.options.data.filter(opt => opt.name !== focusedOption.name);
        const services = await getAvailableServices();

        const parseDisk = (diskStr) => {
            const match = diskStr.match(/^(\d+)x-(\d+)gb-(\w+)$/i);
            if (!match) return null;
            return {
                quantity: parseInt(match[1]),
                capacity_gb: parseInt(match[2]),
                type: match[3].toLowerCase()
            };
        };

        const selectedDisks = selectedOptions
            .filter(opt => opt.name.startsWith('storage'))
            .map(opt => parseDisk(opt.value))
            .filter(Boolean);

        const hardwareFiltered = services.filter(service => {
            const matchBase = selectedOptions.every(opt => {
                if (opt.name === 'cpu') return service.cpu === opt.value;
                if (opt.name === 'ram') return service.ram === opt.value;
                if (opt.name === 'datacenter') return service.region === opt.value;
                if (opt.name === 'gpu') return service.gpu === opt.value;
                return true;
            });

            if (!matchBase) return false;

            return selectedDisks.every(disk =>
                service.disks.some(s =>
                    s.quantity === disk.quantity &&
                    s.capacity_gb === disk.capacity_gb &&
                    s.type.toLowerCase() === disk.type
                )
            );
        });

            let results = [];

            switch (focusedOption.name) {
                case 'cpu':
                    results = [...new Set(hardwareFiltered.map(s => s.cpu))]
                        .filter(cpu => cpu.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .slice(0, 25)
                        .map(cpu => ({ name: cpu, value: cpu }));
                    break;

                case 'ram':
                    results = [...new Set(hardwareFiltered.map(s => s.ram))]
                        .filter(ram => ram.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .slice(0, 25)
                        .map(ram => ({ name: ram, value: ram }));
                    break;

                case 'datacenter':
                    results = [...new Set(hardwareFiltered.map(s => s.region))]
                        .filter(region => region.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .slice(0, 25)
                        .map(region => ({ name: region, value: region }));
                    break;

                case 'gpu':
                    results = [...new Set(hardwareFiltered.map(s => s.gpu).filter(Boolean))]
                        .filter(gpu => gpu.toLowerCase().includes(focusedOption.value.toLowerCase()))
                        .slice(0, 25)
                        .map(gpu => ({ name: gpu, value: gpu }));
                    break;

                default:

                if (focusedOption.name.startsWith('storage')) {
                    const inputValue = focusedOption.value.trim().toLowerCase();
                
                    const allSelectedStorage = selectedDisks.map(disk => {
                        return `${disk.quantity}x-${disk.capacity_gb}GB-${disk.type}`;
                    });
                
                    const allDisks = hardwareFiltered.flatMap(s => s.disks);
                
                    const storageOptions = allDisks.map(disk => {
                        const value = `${disk.quantity}x-${disk.capacity_gb}GB-${disk.type.toLowerCase()}`;
                        const label = `${disk.quantity}x ${disk.capacity_gb}GB ${disk.type.toUpperCase()}`;
                        return { value, label };
                    });
                
                    const uniqueStorage = Array.from(
                        new Map(storageOptions.map(opt => [opt.value, opt])).values()
                    ).filter(opt => !allSelectedStorage.includes(opt.value));
                
                    results = uniqueStorage
                        .filter(opt => opt.label.toLowerCase().includes(inputValue))
                        .slice(0, 25)
                        .map(opt => ({ name: opt.label, value: opt.value }));
                }
                
                    break;
            }
            await interaction.respond(results);
    },

    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;
    
        const cpu = interaction.options.getString('cpu');
        const ram = interaction.options.getString('ram');
        const datacenter = interaction.options.getString('datacenter');
        const gpu = interaction.options.getString('gpu');
        const results_return_value = interaction.options.getNumber('results') ?? 20;
        const storageValues = storageFields.map(i => interaction.options.getString(`storage${i}`));
    
        const services = await getAvailableServices();

        if (!services) {
            return await interaction.reply({ content: 'Aucune donnée disponible.', ephemeral: true });
        }
    
        const matching = services.filter(service => {
            if (cpu && service.cpu !== cpu) return false;
            if (ram && service.ram !== ram) return false;
            if (datacenter && service.region !== datacenter) return false;
            if (gpu && service.gpu !== gpu) return false;
    
            for (let i = 0; i < storageFields.length; i++) {
                const userValue = storageValues[i];
                if (!userValue) continue;
            
                const match = userValue.match(/^(\d+)x-(\d+)GB-(\w+)$/i);
                if (!match) return false;
            
                const [, qtyStr, capStr, type] = match;
                const quantity = parseInt(qtyStr);
                const capacity = parseInt(capStr.toLowerCase());
                const diskType = type.toLowerCase();
            
                const found = service.disks.some(disk =>
                    disk.quantity === quantity &&
                    disk.capacity_gb === capacity &&
                    disk.type.toLowerCase() === diskType
                );
            
                if (!found) return false;
            }            
    
            return true;
        });

        const hetznerIds = matching.map(s => s.service_id);
        if (hetznerIds.length === 0) {
            return await interaction.reply({ content: `❌ Nothing found with selected config. \n-# - **${package.displayName} ${package.version}**`, flags: MessageFlags.Ephemeral });
        }
        const max_entries=550;
        if (hetznerIds.length > max_entries) {
            return await interaction.reply({ content: `❌ Too much entries, please precise filter.\n-# (${hetznerIds.length}/${max_entries}) \n-# - **${package.displayName} ${package.version}**`, flags: MessageFlags.Ephemeral });
        }

        try {
            const res = await fetch(`${backend_address}/service/get-price-hetzner-ids`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hetzner_ids:hetznerIds,
                    max_services_return:results_return_value
                })
            });
            const response = await res.json();
            const results = response.result;

            let index = 0;
            function getRow(index) {
                const buttonPrev = new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('◀️ Previous entry')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(index === 0);

                const buttonNext = new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next entry ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(index >= results.length - 1);

                const buttonSetAlert = new ButtonBuilder()
                    .setCustomId('set-alert')
                    .setLabel('🔔Set alert')
                    .setStyle(ButtonStyle.Secondary)

                if (index === 0) {
                    return new ActionRowBuilder().addComponents(buttonSetAlert, buttonNext);
                } else if (index > 0 && index < results.length - 1) {
                    return new ActionRowBuilder().addComponents(buttonSetAlert, buttonPrev, buttonNext);
                } else {
                    return new ActionRowBuilder().addComponents(buttonSetAlert, buttonPrev);
                }
            };
            //console.log(JSON.stringify(response.result[index]))
            let chartBuffer = generatePriceChart(response.result[index]);
            let attachment = new AttachmentBuilder(chartBuffer, { name: 'price_chart.png' });
            let act_sel_service
            let DC_message
            let GPU_message
            let service_specs
            const av_services = await getAvailableServices();
            async function actGetServiceData(){
            
            act_sel_service = av_services.find(
                service => service.service_id === hetznerIds[index]
            );

            const maxDisks= act_sel_service.disks.slice(0, 10);
            const storage_message = maxDisks.map((disk) => {
                const sel_disk = disk.type !== 'hdd' ? `SSD (${disk.type})` : 'HDD';
                return `\n  - ${disk.quantity} x ${disk.capacity_gb} Go ${sel_disk}`;
            }).join(',');
            DC_message = `${act_sel_service.region}`

            if (["FSN", "NBG"].includes(DC_message)) {
                DC_message += ' 🇩🇪 ';
            } else if (DC_message === "HEL") {
                DC_message += ' 🇫🇮 ';
            } else {
                DC_message = `No datacenter found ❌`;
            }

            GPU_message = ''
            if (act_sel_service.gpu) GPU_message = `- 🖥️  - **GPU :** ${act_sel_service.gpu}\n`
            service_specs = `- 🔲  - **CPU :** ${act_sel_service.cpu}\n` +
              `- 📟  - **RAM :** ${act_sel_service.ram} *(${act_sel_service.ram_count})*\n` +
              `- 💽  - **Storage :** ${storage_message}\n` +
              `- 🏢  - **Datacenter :** ${DC_message}\n` + `${GPU_message}` +
              `- 📡  - **Bandwith :** 1000 mb/s \n`
            }
            await actGetServiceData();
            let message_send={
                files: [attachment],
                content: 
                `-# page ${index+1}:\n${service_specs}\n-# Cheapests last ${response.result.length} entries for selected config *(parsed from ${hetznerIds.length} services)* \n-# - **${package.displayName} ${package.version}**`,
                components: [getRow(index)],
                flags: MessageFlags.Ephemeral,
                withResponse: true
            }
            // `\`\`json\n ${JSON.stringify(response.result[index])}\`\`\`\

            await interaction.reply(message_send); //deferReply
            const sentMessage = await interaction.fetchReply();

            const collector = sentMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id
            });
            
            collector.on('collect', async i => {
                if (i.customId === 'set-alert') {
                    const alert_reply = {
                        content:` **Copy paste** this command and set a **price**:\n\`\`\`/set-alert service_id:${act_sel_service.service_id} price:\`\`\`\n-# - **${package.displayName} ${package.version}**`,
                        flags: MessageFlags.Ephemeral
                    }
                    await interaction.followUp(alert_reply);
                    await i.update(message_send);
                } else {
                    if (i.customId === 'next') index++;
                    if (i.customId === 'previous') index--;
                
                    index = Math.max(0, Math.min(results.length - 1, index));
                    chartBuffer = generatePriceChart(response.result[index]);
                    attachment = new AttachmentBuilder(chartBuffer, { name: 'price_chart.png' });
                    act_sel_service = av_services.find(
                        service => service.service_id === hetznerIds[index]
                        ); 
                    await actGetServiceData();
                    message_send={
                        files: [attachment],
                        content: 
                        `-# page ${index+1}:\n${service_specs}\n-# Cheapests last ${response.result.length} entries for selected config *(parsed from ${hetznerIds.length} services)* \n-# - **${package.displayName} ${package.version}**`,
                        components: [getRow(index)],
                        flags: MessageFlags.Ephemeral,
                    }
                    await i.update(message_send);//editReply
                }
            });

            collector.on('end', async () => {

            });
        } catch (error){
            console.log(error)
        }

    }
    
    
};
