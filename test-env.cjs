process.env.OPENAI_API_KEY = '';
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && !key.startsWith('#')) process.env[key.replace(/"/g,'')] = val.join('=').replace(/^"|"$/g,'');
});
console.log('API Key found:', !!process.env.OPENAI_API_KEY);
console.log('Key starts with:', process.env.OPENAI_API_KEY?.substring(0,8));