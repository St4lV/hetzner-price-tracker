const { SlashCommandBuilder, MessageFlags, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const { registerFont } = require('canvas');
const path = require('path');
const package = require('../../package.json');
const { getAvailableServices } = require('../../cache.js')
const { backend_address} = require('../../config.json');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { Chart } = require('chart.js');
const annotationPlugin = require('chartjs-plugin-annotation');
const storageFields = Array.from({ length: 4 }, (_, i) => i + 1);

registerFont(path.join(__dirname, '../../assets/fonts/OpenSans-Medium.ttf'), {
    family: 'Open Sans'
});

Chart.register(annotationPlugin);

const width = 800;
const height = 500;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'transparent',chartCallback: (ChartJS) => {ChartJS.defaults.font.family = 'Open Sans';}});

const colorPalette = [
    '#4e79a7', '#f28e2b', '#962ee6', '#76b7b2',
    '#59a14f', '#edc949', '#af7aa1', '#ff9da7',
    '#9c755f', '#bab0ab'
];

async function generatePriceChart(result) {
    const history = [...result.history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const hetznerIds = Array.from(new Set(history.map(entry => entry.hetzner_id)));

    const datasets = hetznerIds.map((id, index) => {
        const filtered = history.filter(h => h.hetzner_id === id);
        const data = filtered.map(entry => ({
            x: new Date(entry.timestamp).getTime(),
            y: parseFloat(entry.price)
        }));

        const latestEntry = filtered[filtered.length - 1];
        const latestDate = new Date(latestEntry.timestamp);
        const dateLabel = `${String(latestDate.getDate()).padStart(2, '0')}/${String(latestDate.getMonth() + 1).padStart(2, '0')}/${String(latestDate.getFullYear()).slice(-2)}`;
        const price = parseFloat(latestEntry.price).toFixed(2);

        return {
            label: `${dateLabel} ${price}€`,
            data,
            borderColor: colorPalette[index % colorPalette.length],
            backgroundColor: colorPalette[index % colorPalette.length],
            pointRadius: 3,
            stepped: true,
            tension: 0,
            spanGaps: true
        };
    });

    const allTimestamps = history.map(e => new Date(e.timestamp).getTime());
    const allPrices = history.map(e => parseFloat(e.price));

    const xMin = Math.min(...allTimestamps);const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nowTs = today.getTime();
    
    const lastDataTs = Math.max(...allTimestamps);
    const xMax = Math.max(lastDataTs, nowTs);
    const yMin = Math.floor((Math.min(...allPrices) - 20) * 0.1) * 10;
    const yMax = Math.ceil((Math.max(...allPrices) + 20) * 0.1) * 10;

    const lastTimestamps = hetznerIds.map(id => {
        const filtered = history.filter(h => h.hetzner_id === id);
        return filtered[filtered.length - 1];
    });
    const lastMinPrice = Math.min(...lastTimestamps.map(e => parseFloat(e.price)));

    datasets.unshift({
        label: `Latest ${lastMinPrice}€`,
        data: [
            { x: xMin, y: lastMinPrice },
            { x: xMax, y: lastMinPrice }
        ],
        borderColor: '#ffaaaa',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [5, 5],
        stepped: false,
        spanGaps: true
    });

    const configuration = {
        type: 'line',
        data: {
            datasets
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: `Service ID : ${result.id}`,
                    color: '#ffffff',
                    font: {
                        family: 'Open Sans',
                        size: 18
                    }
                },
                legend: {
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: 'Open Sans',
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => {
                            const ts = tooltipItems[0].parsed.x;
                            const d = new Date(ts);
                            return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
                        },
                        label: (tooltipItem) => {
                            return `${tooltipItem.dataset.label} : ${tooltipItem.formattedValue}€`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: xMin,
                    max: xMax,
                    ticks: {
                        callback: function(value) {
                            const d = new Date(value);
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                        },
                        color: '#cccccc',
                        font: {
                            family: 'Open Sans'
                        }
                    },
                    grid: {
                        color: '#8c8c8c'
                    }
                },
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: {
                        stepSize: 10,
                        color: '#cccccc',
                        font: {
                            family: 'Open Sans'
                        }
                    },
                    grid: {
                        color: '#8c8c8c'
                    },
                    title: {
                        display: true,
                        text: 'Price (€)',
                        color: '#ffffff',
                        font: {
                            family: 'Open Sans'
                        }
                    }
                }
            }
        },
        plugins: []
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
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
            let chartBuffer = await generatePriceChart(response.result[index]);
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
                if (i.customId === 'next') index++;
                if (i.customId === 'previous') index--;
                index = Math.max(0, Math.min(results.length - 1, index));
                act_sel_service = av_services.find(
                    service => service.service_id === hetznerIds[index]
                );
                if (i.customId === 'set-alert') {
                    const alert_reply = {
                        content: `**Copy paste** this command and set a **price**:\n\`\`\`/set-alert service_id:${response.result[index].id} price:\`\`\`\n-# - **${package.displayName} ${package.version}**`,
                        flags: MessageFlags.Ephemeral
                    };
                    await i.update(message_send);
                    await interaction.followUp(alert_reply);
                } else {
                    chartBuffer = await generatePriceChart(response.result[index]);
                    attachment = new AttachmentBuilder(chartBuffer, { name: 'price_chart.png' });
                    await actGetServiceData();
                    message_send = {
                        files: [attachment],
                        content:
                            `-# page ${index + 1}:\n${service_specs}\n-# Cheapests last ${response.result.length} entries for selected config *(parsed from ${hetznerIds.length} services)* \n-# - **${package.displayName} ${package.version}**`,
                        components: [getRow(index)],
                        flags: MessageFlags.Ephemeral,
                    };
                    await i.update(message_send);
                }
            });
            collector.on('end', async () => {
            });
        } catch (error){
            console.log(error)
        }

    }
    
    
};
