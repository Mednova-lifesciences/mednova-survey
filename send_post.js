const fs = require('fs');
const data = fs.readFileSync('test_payload.json','utf8');
(async()=>{
  const port = process.env.TARGET_PORT || '3000';
  const url = `http://127.0.0.1:${port}/api/survey`;
  try{
    const res = await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: data
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  }catch(err){
    console.error('Request error:', err);
  }
})();
