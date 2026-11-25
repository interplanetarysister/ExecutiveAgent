const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: __dirname + '/../.env' });

const sql = fs.readFileSync(__dirname + '/../supabase/migrations/20231123_init.sql', 'utf8');

const client = new Client({
  connectionString: `postgresql://postgres:${process.env.SUPABASE_SERVICE_ROLE_KEY}@${process.env.SUPABASE_URL.replace(/^https:\/\//, '')}:5432/postgres`
});

(async () => {
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration applied successfully');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
})();
