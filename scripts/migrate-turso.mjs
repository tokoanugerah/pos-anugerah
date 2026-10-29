import { createClient } from '@libsql/client';

const client = createClient({
  url: 'https://pos-anugerah-tokoanugerah.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI1NTgxNDksImlkIjoiMDFhMTVjODAtMDAwMS03MTNlLTg4NGQtZDdjNzRlNmI2YzYzIiwia2lkIjoiZzhvY3ZyeHdMcVZrWVh6ZWhEc1MzZVR1aEItMWNWaFN0bi1lSWZsWlF3USIsInJpZCI6ImEyN2VmMTQ2LWFlNGMtNDJjZi1iYTdjLWMyZTk5MjY5MGNjMyJ9.wLHB2RwaDO_oA2cvmvafcO21hyvWZjbCJam_YT8-JHJq6u_E5A1LatykDAA-hleLBWtrT-TePKc_Vq3FXAViDw'
});

async function main() {
  console.log('Ensuring store_settings table in Turso...');
  await client.execute(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id TEXT PRIMARY KEY,
      store_name TEXT NOT NULL,
      store_address TEXT NOT NULL,
      store_phone TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      receipt_footer TEXT NOT NULL,
      categories TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Active tables in Turso:', tables.rows.map(x => x.name));
}

main().catch(console.error);
