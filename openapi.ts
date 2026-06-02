import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL + '/rest/v1/';
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key
    }
  });
  console.log(await res.json());
}

run();
