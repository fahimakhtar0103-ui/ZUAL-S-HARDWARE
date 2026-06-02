import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL + '/graphql/v1';
const key = process.env.VITE_SUPABASE_ANON_KEY;

const query = `
  query {
    __schema {
      types {
        name
      }
    }
  }
`;

async function run() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  if (data.data && data.data.__schema) {
    const types = data.data.__schema.types.filter((t: any) => t.name.toLowerCase() === t.name && !t.name.startsWith('__'));
    console.log(types.map((t: any) => t.name));
  } else {
    console.log(data);
  }
}

run();
