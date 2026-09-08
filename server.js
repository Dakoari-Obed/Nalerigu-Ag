const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req,res)=>{
  res.send("Central AG Nalerigu Backend Running ✅");
});

app.post('/api/webhook/paystack', async (req,res)=>{
  console.log("Paystack webhook hit!");
  res.sendStatus(200);
});

app.get('/api/test', (req,res)=>{
  res.json({ message: "Backend works!" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`Running on ${PORT}`));
