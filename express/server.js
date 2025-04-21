const express = require("express");
const { pool } = require('./postgres.js');
const app = express()
app.use(express.json());
app.listen(3000);

//GET
app.get('/service/get-all', async (req, res) => {
    try {
        const serviceData = await pool.query(`
        SELECT 
            services.*, 
            cpus.cpu_name AS cpu_name, 
            cpus.cpu_vendor, 
            rams.ram_total_size_gb AS ram_total_size_gb, 
            rams.ram_type, 
            rams.ram_amount, 
            rams.ram_size_mb, 
            rams.is_ecc,
            JSON_AGG(
            DISTINCT jsonb_build_object(
                    'id', disks.id,
                    'capacity_gb', disks.capacity_gb,
                    'type', disks.type,
                    'quantity', disks.quantity
                )
            ) FILTER (WHERE disks.id IS NOT NULL) AS disks,
            gpu.name AS gpu_name
            FROM services
            JOIN cpus ON services.cpu_id = cpus.id
            JOIN rams ON services.ram_id = rams.id
            LEFT JOIN diskgroup_disks dgd ON services.disk_group_id = dgd.disk_group_id
            LEFT JOIN disks ON dgd.disk_id = disks.id
            LEFT JOIN gpu ON services.gpu_id = gpu.id
            LEFT JOIN hetznerservice ON services.id = hetznerservice.service_id
            GROUP BY 
                services.id, 
                cpus.cpu_name, cpus.cpu_vendor, 
                rams.ram_total_size_gb, rams.ram_type, rams.ram_amount, rams.ram_size_mb, rams.is_ecc,
                gpu.name
        `);
        const available_services = serviceData.rows.map(row => ({
            cpu_constructor: row.cpu_vendor,
            cpu: row.cpu_name,
            region: row.region,
            ram: `${row.ram_total_size_gb}-${row.ram_type}`,
            ram_count: `${row.ram_amount} x ${row.ram_size_mb}MB`,
            ram_ecc: row.is_ecc,
            service_id:row.id,
            disks: row.disks?.map(disk => ({
                type: disk.type,
                capacity_gb: disk.capacity_gb,
                quantity: disk.quantity
            })) ?? [],
            ...(row.gpu_name ? { gpu: row.gpu_name } : {})
        }));
        res.json({ response: available_services });
    
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
})

//POST
app.post('/service/get-price-latest', async (req, res) => {
    const service_ids = req.body.service_ids;
    try {
        const priceQueries = service_ids.map(id =>
            pool.query(
                `SELECT price
                FROM distinctservicesprices
                WHERE service_id = $1
                ORDER BY timestamp DESC, price ASC
                LIMIT 1`,
                [id]
            ).then(res => ({
                id,
                latestPrice: res.rows.length > 0 ? parseFloat(res.rows[0].price) : null
            }))
        );
        const latestPricesRaw = await Promise.all(priceQueries);
        const latestPrices = latestPricesRaw.filter(p => p.latestPrice !== null);
        return res.json({response:latestPrices})
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
})

app.post('/service/get-price-hetzner-ids', async (req, res) => {
    const hetzner_ids = req.body.hetzner_ids;
    const { max_services_return } = req.body
    if (max_services_return<1) max_services_return =1
    if (max_services_return>100) max_services_return =100
    if (!Array.isArray(hetzner_ids) || hetzner_ids.length === 0 || !hetzner_ids.every(Number.isInteger)) {
        return res.status(400).json({ error: "Invalid hetzner_ids in request body." });
    }

    try {
        const priceQueries = hetzner_ids.map(id =>
            pool.query(
                `SELECT price
                FROM distinctservicesprices
                WHERE service_id = $1
                ORDER BY timestamp DESC
                LIMIT 1`,
                [id]
            ).then(res => ({
                id,
                latestPrice: res.rows.length > 0 ? parseFloat(res.rows[0].price) : null
            }))
        );
        
        const latestPricesRaw = await Promise.all(priceQueries);
        const latestPrices = latestPricesRaw.filter(p => p.latestPrice !== null);

        const cheapestServices = latestPrices
            .sort((a, b) => a.latestPrice - b.latestPrice)
            .slice(0, max_services_return);

        const historyQueries = cheapestServices.map(entry =>
            pool.query(
                `SELECT timestamp, price, hetzner_id
                FROM distinctservicesprices
                WHERE service_id = $1
                ORDER BY timestamp DESC`,
                [entry.id]
            ).then(res => {
                const seenPrices = new Set();
                const history = [];
        
                for (const row of res.rows) {
                    if (!seenPrices.has(row.price)) {
                        seenPrices.add(row.price);
                        history.push({
                            timestamp: row.timestamp,
                            price: row.price,
                            hetzner_id: row.hetzner_id
                        });
                    }
                }
                return {
                    id: entry.id,
                    history
                };
            })
        );
        
        const result = await Promise.all(historyQueries);
        return res.json({ result });

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
});
