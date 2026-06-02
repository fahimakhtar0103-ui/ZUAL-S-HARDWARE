Object.keys(process.env).filter(k => k.toLowerCase().includes('supabase')).forEach(k => console.log(k, process.env[k]));
