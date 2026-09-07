require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// TEMP DB - will move to MongoDB later
let transactions = [];

// ===== AUTH MIDDLEWARE =====
function auth(req,res,next){
  const token = req.headers.authorization?.split(" ")[1];
  if(!token) return res.status(401).json({msg:"No token"});
  try{
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  }catch{
    res.status(401).json({msg:"Invalid token"});
  }
}

// ===== ADMIN LOGIN =====
app.post('/api/admin/login', (req,res)=>{
  const {username, password} = req.body;
  if(username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS){
    const token = jwt.sign({username}, process.env.JWT_SECRET, {expiresIn:"12h"});
    return res.json({token, success:true});
  }
  res.status(401).json({msg:"Wrong admin credentials"});
});

// ===== INITIALIZE PAYMENT - THIS MATCHES YOUR HTML =====
app.post('/api/pay/initialize', async (req,res)=>{
  const {name, phone, amount, month, method} = req.body;

  if(!name ||!phone ||!amount ||!month ||!method){
    return res.status(400).json({msg:"All fields required"});
  }

  try{
    // If method is MTN or Telecel -> use Paystack Mobile Money
    if(method.includes("Mobile Money") || method.includes("Cash")){
      const response = await axios.post('https://api.paystack.co/transaction/initialize',{
        email: `${phone}@centralag-nalerigu.com`,
        amount: Number(amount) * 100, // Paystack uses pesewas
        currency: "GHS",
        channels: ["mobile_money"],
        metadata: { name, phone, month, method, church: "Central AG Nalerigu" },
        callback_url: `${process.env.FRONTEND_URL}/?reference=verify`
      },{
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      });

      return res.json({
        status: true,
        paystack: true,
        data: response.data.data // contains authorization_url
      });
    } else {
      // Bank Transfer - generate reference for manual confirmation
      const ref = `TITHE-NAL-${Date.now()}`;
      const tx = {
        id: ref,
        reference: ref,
        name, phone,
        amount: Number(amount),
        month, method,
        date: new Date().toLocaleString(),
        status: "PENDING - BANK TRANSFER"
      };
      transactions.push(tx);
      return res.json({status:true, paystack:false, transaction: tx});
    }

  }catch(err){
    console.log(err.response?.data || err.message);
    res.status(500).json({error: err.response?.data || err.message});
  }
});

// ===== VERIFY PAYMENT =====
app.get('/api/pay/verify/:reference', async (req,res)=>{
  try{
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${req.params.reference}`,{
      headers:{ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const data = response.data.data;

    if(data.status === 'success'){
      const already = transactions.find(t=> t.reference === data.reference);
      if(!already){
        const newTx = {
          id: `TITHE-NAL-${Date.now()}`,
          reference: data.reference,
          name: data.metadata.name,
          phone: data.metadata.phone,
          amount: data.amount/100,
          month: data.metadata.month,
          method: data.metadata.method,
          date: new Date().toLocaleString(),
          status: "PAID"
        };
        transactions.push(newTx);
        return res.json({verified:true, transaction: newTx});
      }
      return res.json({verified:true, transaction: already});
    }
    res.json({verified:false});

  }catch(err){
    res.status(500).json({error: err.message});
  }
});

// ===== WEBHOOK - PAYSTACK WILL CALL THIS =====
app.post('/api/webhook/paystack', express.json({verify:(req,res,buf)=>{ req.rawBody=buf }}), (req,res)=>{
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(req.rawBody).digest('hex');
  if(hash!== req.headers['x-paystack-signature']){
    return res.status(400).send("Invalid signature");
  }

  const event = req.body;
  if(event.event === 'charge.success'){
    const data = event.data;
    const exists = transactions.find(t=> t.reference === data.reference);
    if(!exists){
      transactions.push({
        id: `TITHE-NAL-${Date.now()}`,
        reference: data.reference,
        name: data.metadata.name,
        phone: data.metadata.phone,
        amount: data.amount/100,
        month: data.metadata.month,
        method: data.metadata.method,
        date: new Date().toLocaleString(),
        status: "PAID"
      });
    }
  }
  res.sendStatus(200);
});

// ===== ADMIN DATA =====
app.get('/api/admin/transactions', auth, (req,res)=>{
  res.json(transactions.reverse());
});

app.get('/api/admin/stats', auth, (req,res)=>{
  const paid = transactions.filter(t=> t.status==="PAID");
  const total = paid.reduce((a,b)=> a + b.amount, 0);
  res.json({
    totalAmount: total,
    totalCount: transactions.length,
    paidCount: paid.length
  });
});

// ===== START =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=> console.log(`Central AG Backend running on port ${PORT}`));