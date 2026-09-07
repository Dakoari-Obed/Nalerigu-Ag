const API = "https://your-render-link.onrender.com";
let transactions = JSON.parse(localStorage.getItem("central_ag_tx") || "[]");

// PAGE SWITCHING
function showPage(pageId){
  document.querySelectorAll('.page').forEach(p=> p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  if(pageId==='history') renderHistory();
  if(pageId==='admin') renderAdmin();
}

// PAY TITHE FORM
document.getElementById("titheForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const amount = document.getElementById("amount").value;
  const month = document.getElementById("month").value;
  const method = document.getElementById("method").value;

  const btn = e.target.querySelector("button");
  btn.innerText = "Processing...";
  btn.disabled = true;

  try{
    // OPTION A: If backend is ready - use Paystack
    // const res = await fetch(`${API}/api/pay/initialize`,{...})
    // window.location.href = res.data.authorization_url;

    // OPTION B: Offline Demo for Nalerigu (works without backend) - REMOVE when Paystack is live
    const reference = `TITHE-NAL-${Date.now()}`;
    const date = new Date().toLocaleString();
    
    const tx = { id: reference, name, phone, amount: parseFloat(amount), month, method, date, reference };
    transactions.push(tx);
    localStorage.setItem("central_ag_tx", JSON.stringify(transactions));

    // Show Receipt
    document.getElementById("receiptName").innerText = name;
    document.getElementById("receiptPhone").innerText = phone;
    document.getElementById("receiptAmount").innerText = amount;
    document.getElementById("receiptMonth").innerText = month;
    document.getElementById("receiptMethod").innerText = method;
    document.getElementById("receiptReference").innerText = reference;
    document.getElementById("receiptDate").innerText = date;
    
    showPage('receipt');
    e.target.reset();

  } catch(err){
    alert("Payment error: " + err.message);
  } finally {
    btn.innerText = "Continue Payment";
    btn.disabled = false;
  }
});

function renderHistory(){
  const list = document.getElementById("historyList");
  if(transactions.length===0){ list.innerHTML = "<p>No payments yet.</p>"; return; }
  list.innerHTML = transactions.slice().reverse().map(t=>`
    <div class="tx">
      <b>${t.month} - GH₵ ${t.amount}</b><br>
      <small>${t.date} | ${t.reference}</small>
    </div>
  `).join("");
}

function renderAdmin(){
  const total = transactions.reduce((a,b)=>a+b.amount,0);
  document.getElementById("totalPayments").innerText = transactions.length;
  document.getElementById("totalAmount").innerText = total.toFixed(2);
  
  const adminList = document.getElementById("adminTransactions");
  adminList.innerHTML = transactions.slice().reverse().map(t=>`
    <div class="tx">
      <b>${t.name} (${t.phone})</b> - GH₵ ${t.amount} - ${t.month}<br>
      <small>${t.method} | ${t.reference} | ${t.date}</small>
    </div>
  `).join("");
}