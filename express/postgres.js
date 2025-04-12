const pg = require('pg');
const { Pool, Client } = pg;
const config = require('./config.json');

const pool = new Pool({
    user: config.postgres_user,
    password: config.postgres_password,
    host: config.postgres_host,
    port: config.postgres_port,
    database: config.postgres_db,
    searchPath: ['public']
});

const client = new Client({
    user: config.postgres_user,
    password: config.postgres_password,
    host: config.postgres_host,
    port: config.postgres_port,
    database: config.postgres_db,
    searchPath: ['public']
});

(async () => {
    await client.connect();
    await client.end();
})();

module.exports = { pool, client };
