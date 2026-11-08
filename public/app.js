(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { profile: null, workspace: null, accounts: [], businesses: [], transactions: [], documents: [], page: "dashboard", lang: "en", report: null, pendingScan: null };
  const labels = {
    en: { dashboard:"Dashboard", transactions:"Transactions", accounts:"Accounts & Wallets", businesses:"Businesses", reports:"Reports", team:"Team & Permissions", audit:"Activity Log", addTransaction:"Add transaction" },
    ur: { dashboard:"Dashboard", transactions:"Len Den", accounts:"Bank Accounts aur Wallets", businesses:"Businesses", reports:"Reports", team:"Team aur Permissions", audit:"Activity Log", addTransaction:"Transaction add karein" }
  };
  const roleDefaults = {
    owner:["*"],
    accountant:["dashboard_view","transaction_view","transaction_create","transaction_edit","transaction_void","account_view","account_manage","business_view","business_manage","report_view","proof_upload","proof_view","export_view","team_view"],
    cashier:["dashboard_view","transaction_view","transaction_create","account_view","business_view","proof_upload","proof_view"],
    staff:["dashboard_view","transaction_view","account_view","business_view","proof_view"],
    viewer:["dashboard_view","transaction_view","account_view","business_view","report_view","proof_view"]
  };
  const permissionLabels = {
    dashboard_view:"View dashboard", transaction_view:"View transactions", transaction_create:"Add transactions",
    transaction_edit:"Edit transactions", transaction_void:"Void transactions", account_view:"View accounts",
    account_manage:"Manage accounts", business_view:"View businesses", business_manage:"Manage businesses",
    report_view:"View reports", proof_upload:"Upload proof", proof_view:"View proof", export_view:"Export CSV",
    team_view:"View team"
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
  function money(value) {
    const n = Number(value || 0);
    return "Rs " + n.toLocaleString("en-PK", { minimumFractionDigits:2, maximumFractionDigits:2 });
  }
  function dateLabel(value) {
    if (!value) return "—";
    const d = new Date(String(value).slice(0,10) + "T00:00:00");
    return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleDateString("en-PK", { day:"2-digit", month:"short", year:"numeric" });
  }
  function today() { return new Date().toISOString().slice(0,10); }
  function toast(message, isError=false) {
    const el = $("toast");
    el.textContent = message;
    el.className = "toast show" + (isError ? " error" : "");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { el.className = "toast"; }, 3400);
  }
  async function api(path, options={}) {
    const res = await fetch("/api/" + path, { credentials:"same-origin", ...options });
    if (!res.ok) {
      let body = {};
      try { body = await res.json(); } catch {}
      const error = new Error(body.error || ("Request failed (" + res.status + ")"));
      error.status = res.status;
      error.body = body;
      throw error;
    }
    const type = res.headers.get("content-type") || "";
    return type.includes("application/json") ? res.json() : res;
  }
  function can(permission) {
    const p = state.profile;
    if (!p || p.status !== "active") return false;
    if (p.role === "owner") return true;
    if (Object.prototype.hasOwnProperty.call(p.permissions || {}, permission)) return p.permissions[permission] === true;
    const defaults = roleDefaults[p.role] || [];
    return defaults.includes("*") || defaults.includes(permission);
  }
  function applyPermissions() {
    document.querySelectorAll(".role-owner").forEach(el => el.hidden = state.profile?.role !== "owner");
    $("quickAdd").hidden = !can("transaction_create");
    $("addTransactionPage").hidden = !can("transaction_create");
    $("addAccount").hidden = !can("account_manage");
    $("addBusiness").hidden = !can("business_manage");
    $("exportTransactions").hidden = !can("export_view");
    $("reportExport").hidden = !can("export_view");
    document.querySelector('[data-page="documents"]').hidden = !can("proof_view");
    $("saveDocumentOnly").hidden = !can("proof_upload");
    if (!can("team_view")) document.querySelector('[data-page="team"]').hidden = true;
    if (!can("audit_view")) document.querySelector('[data-page="audit"]').hidden = true;
  }
  function applyLanguage() {
    document.documentElement.lang = state.lang === "ur" ? "en" : "en";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (labels[state.lang][key]) el.textContent = labels[state.lang][key];
    });
    $("languageSwitch").innerHTML = state.lang === "en" ? "EN <span>·</span> اردو-رومن" : "اردو-رومن <span>·</span> EN";
  }
  function showPage(page) {
    const target = $("page-" + page);
    if (!target || (page === "team" && !can("team_view")) || (page === "audit" && !can("audit_view"))) return;
    state.page = page;
    document.querySelectorAll(".page-view").forEach(el => el.classList.toggle("active", el.id === "page-" + page));
    document.querySelectorAll(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.page === page));
    const titles = { dashboard:"Dashboard", transactions:"Transactions", documents:"Documents & Bills", accounts:"Accounts & Wallets", businesses:"Businesses", reports:"Reports", team:"Team & Permissions", audit:"Activity Log" };
    $("pageTitle").textContent = titles[page] || "MEC Finance";
    $("pageEyebrow").textContent = page === "dashboard" ? "MUGHAL ERA CREATION" : "MEC FINANCE WORKSPACE";
    $("sidebar").classList.remove("open");
    $("mobileScrim").classList.remove("show");
    if (page === "dashboard") loadDashboard();
    if (page === "transactions") loadTransactions();
    if (page === "documents") loadDocuments();
    if (page === "accounts") loadAccounts();
    if (page === "businesses") loadBusinesses();
    if (page === "reports") loadReports();
    if (page === "team") loadTeam();
    if (page === "audit") loadAudit();
  }
  function optionsForAccounts(selected="") {
    const options = state.accounts.filter(a => a.active).map(a => `<option value="${esc(a.id)}" ${String(a.id)===String(selected)?"selected":""}>${esc(a.name)} · ${esc(a.institution || a.account_type)}</option>`).join("");
    return '<option value="">Choose account</option>' + options;
  }
  function optionsForBusinesses(selected="") {
    return '<option value="">Choose business</option>' + state.businesses.filter(b => b.active).map(b => `<option value="${esc(b.id)}" ${String(b.id)===String(selected)?"selected":""}>${esc(b.name)}</option>`).join("");
  }
  async function refreshLookups() {
    const [a,b] = await Promise.all([api("accounts"), api("businesses")]);
    state.accounts = a.accounts || [];
    state.businesses = b.businesses || [];
  }
  async function loadDashboard() {
    if (!can("dashboard_view")) return;
    try {
      const d = await api("dashboard");
      $("statBalance").textContent = money(d.assets?.total_balance);
      $("statIncome").textContent = money(d.month?.income);
      $("statExpense").textContent = money(d.month?.expense);
      $("statNet").textContent = money(d.summary?.net_cashflow);
      $("statIncomeCount").textContent = (d.month?.count || 0) + " entries this month";
      $("statExpenseCount").textContent = "This month · posted records";
      $("snapAccounts").textContent = state.accounts.filter(a => a.active).length;
      $("snapBusinesses").textContent = state.businesses.filter(b => b.active).length;
      $("snapTransactions").textContent = d.summary?.transaction_count || 0;
      renderChart($("cashflowChart"), d.monthly || []);
      renderRecent(d.recent || []);
    } catch (e) { toast(e.message, true); }
  }
  function renderChart(el, rows) {
    if (!rows.length) { el.innerHTML = '<div class="empty-state small">No monthly data yet.</div>'; return; }
    const max = Math.max(1, ...rows.flatMap(r => [Number(r.income||0),Number(r.expense||0)]));
    el.innerHTML = rows.map(r => {
      const h1 = Math.max(2, Number(r.income||0)/max*100);
      const h2 = Math.max(2, Number(r.expense||0)/max*100);
      return `<div class="chart-group" title="${esc(r.month)} · Income ${money(r.income)} · Expense ${money(r.expense)}"><span class="chart-bar income" style="height:${h1}%"></span><span class="chart-bar expense" style="height:${h2}%"></span><small class="chart-month">${esc(r.month)}</small></div>`;
    }).join("");
  }
  function renderRecent(rows) {
    if (!rows.length) { $("recentTransactions").innerHTML = '<div class="empty-state">No transactions yet. Add your first entry to start tracking cash flow.</div>'; return; }
    $("recentTransactions").innerHTML = transactionTable(rows, true);
  }
  function transactionTable(rows, compact=false) {
    return `<table><thead><tr><th>Date</th><th>Transaction</th><th>Type</th><th>Account</th><th>Scope</th><th>Amount</th>${compact?"":"<th>Proof / Action</th>"}</tr></thead><tbody>` +
      rows.map((t,i) => {
        const account = t.transaction_type === "income" ? t.to_account_name : t.transaction_type === "expense" ? t.from_account_name : (t.from_account_name || "—") + " → " + (t.to_account_name || "—");
        const sign = t.transaction_type === "income" ? "+" : t.transaction_type === "expense" ? "−" : "";
        const scanParties = [t.sender_name ? "From: "+t.sender_name : "", t.receiver_name ? "To: "+t.receiver_name : ""].filter(Boolean).join(" · ");
        const scanMeta = [t.provider_name, t.bill_number ? "Bill "+t.bill_number : "", t.invoice_number ? "Invoice "+t.invoice_number : "", t.payment_status].filter(Boolean).join(" · ");
        const scanText = t.ocr_text || t.scan_data?.report_text || "";
        const proofs = (t.proofs || []).map(p => `<a class="proof-link" href="/api/proofs/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">▧ Proof</a>`).join(" ");
        return `<tr><td>${dateLabel(t.transaction_date)}</td><td><span class="tx-main">${esc(t.counterparty || t.category || "Transaction")}</span><span class="tx-sub">${esc(t.description || t.reference || "")}</span>${scanParties?`<span class="tx-sub">${esc(scanParties)}</span>`:""}${scanMeta?`<span class="tx-sub">${esc(scanMeta)}</span>`:""}${scanText?`<details class="tx-scan-details"><summary>View complete payment slip text</summary><pre>${esc(scanText)}</pre></details>`:""}</td><td><span class="type-pill ${esc(t.transaction_type)}">${esc(t.transaction_type)}</span></td><td>${esc(account || "—")}</td><td><span class="scope-pill">${esc(t.scope)}</span></td><td class="amount-cell ${esc(t.transaction_type)}">${sign}${money(t.amount)}</td>${compact?"":`<td>${proofs || '<span class="tx-sub">No proof</span>'} ${t.status==="posted" && can("transaction_edit") ? `<button class="text-link" data-edit="${esc(t.id)}">Edit</button>` : ""} ${t.status==="posted" && can("transaction_void") ? `<button class="text-link" data-void="${esc(t.id)}">Void</button>` : ""} ${t.status==="voided" ? '<span class="status-pill voided">Voided</span>' : ""}</td>`}</tr>`;
      }).join("") + "</tbody></table>";
  }
  async function loadTransactions() {
    if (!can("transaction_view")) return;
    try {
      const q = $("transactionSearch").value.trim();
      const type = $("filterType").value, scope = $("filterScope").value;
      const params = new URLSearchParams();
      if (q) params.set("q",q);
      if (type) params.set("type",type);
      if (scope) params.set("scope",scope);
      params.set("limit","500");
      const d = await api("transactions?" + params.toString());
      state.transactions = d.transactions || [];
      $("transactionsTable").innerHTML = state.transactions.length ? transactionTable(state.transactions,false) : '<div class="empty-state">No matching transactions. Add a record or change the filters.</div>';
    } catch (e) { toast(e.message,true); }
  }
  async function loadDocuments() {
    if (!can("proof_view")) return;
    try {
      const q=$("documentSearch").value.trim();
      const d=await api("documents"+(q?"?q="+encodeURIComponent(q):""));
      state.documents=d.documents||[];
      $("documentCount").textContent=state.documents.length+" records";
      $("documentsTable").innerHTML=state.documents.length?'<table><thead><tr><th>Date</th><th>Document</th><th>Party / Provider</th><th>Reference</th><th>Status</th><th>Amount</th><th>Extracted scan</th><th>Original file</th></tr></thead><tbody>'+
        state.documents.map(x=>{
          const ex=x.extracted_data||{};
          const lineItems=Array.isArray(ex.line_items)?ex.line_items:[];
          const parties=[ex.sender_name?"From: "+ex.sender_name:"",ex.receiver_name?"To: "+ex.receiver_name:""].filter(Boolean).join(" · ");
          const fields=[
            ["Document type",ex.document_type],["Payment direction",ex.direction],
            ["Payment amount",ex.transaction_amount],["Invoice total",ex.invoice_total],
            ["Paid amount",x.paid_amount],["Balance due",x.balance_due],
            ["Sender / payer",ex.sender_name],["Sender account (masked)",ex.sender_account_hint],
            ["Receiver / payee",ex.receiver_name],["Receiver account (masked)",ex.receiver_account_hint],
            ["Bank / wallet / biller",ex.provider_name||ex.merchant_or_biller],
            ["Date / time",[ex.transaction_date,ex.transaction_time].filter(Boolean).join(" ")],
            ["Transaction reference",ex.transaction_reference||ex.rrn_or_trace],
            ["Bill number",ex.bill_number],["Invoice number",ex.invoice_number],
            ["Consumer reference",ex.consumer_or_customer_reference],
            ["Fee",ex.fee_amount],["Tax",ex.tax_amount],["Discount",ex.discount_amount],
            ["Due date",ex.due_date],["Billing period",ex.billing_period],
            ["Channel",ex.channel],["Narration",ex.narration]
          ].filter(pair=>pair[1]!==null&&pair[1]!==undefined&&String(pair[1]).trim()!=="");
          const detail='<details class="document-extracted"><summary>View all detected fields ('+fields.length+')</summary><div class="document-detail-grid">'+fields.map(pair=>'<div><small>'+esc(pair[0])+'</small><b>'+esc(pair[1])+'</b></div>').join("")+'</div>'+
            (lineItems.length?'<strong>Line items</strong><ul>'+lineItems.map(li=>'<li>'+esc(li.description)+' · Qty '+esc(li.quantity??"—")+' · Unit '+esc(li.unit_price??"—")+' · Total '+esc(li.line_total??"—")+'</li>').join("")+'</ul>':"")+
            (ex.field_confidence&&Object.keys(ex.field_confidence).length?'<strong>Field confidence</strong><ul>'+Object.entries(ex.field_confidence).map(([k,v])=>'<li>'+esc(k.replaceAll("_"," "))+": "+Math.round(Math.max(0,Math.min(1,Number(v)||0))*100)+"%</li>").join("")+'</ul>':"")+
            (ex.other_details&&Object.keys(ex.other_details).length?'<strong>Other detected details</strong><pre>'+esc(JSON.stringify(ex.other_details,null,2))+'</pre>':"")+
            (Array.isArray(ex.warnings)&&ex.warnings.length?'<strong>Scan warnings</strong><ul>'+ex.warnings.map(w=>'<li>'+esc(w)+'</li>').join("")+'</ul>':"")+
            '<details><summary>Complete automatic detail report</summary><pre>'+esc(x.ocr_text||ex.report_text||ex.full_text||"No readable text saved.")+'</pre></details>'+
            '<details><summary>Original OCR transcription</summary><pre>'+esc(ex.raw_full_text||"No separate raw transcription was saved.")+'</pre></details></details>';
          return '<tr><td>'+dateLabel(x.document_date)+'</td><td><span class="tx-main">'+esc(x.title||x.document_type)+'</span><span class="tx-sub">'+esc(x.document_type)+' · '+esc(x.original_filename)+'</span></td><td>'+esc(x.party_name||x.provider_name||"—")+(parties?'<span class="tx-sub">'+esc(parties)+'</span>':"")+'</td><td>'+esc(x.reference_number||"—")+'</td><td><span class="status-pill '+(x.payment_status==="successful"?"active":x.payment_status==="failed"||x.payment_status==="reversed"?"voided":"pending")+'">'+esc(x.payment_status||"unknown")+'</span>'+(x.due_date?'<span class="tx-sub">Due '+dateLabel(x.due_date)+'</span>':"")+'</td><td>'+(x.amount===null||x.amount===undefined?"—":money(x.amount))+'</td><td>'+detail+'</td><td><a class="proof-link" href="/api/documents/'+encodeURIComponent(x.id)+'" target="_blank" rel="noopener">▧ View file</a></td></tr>';
        }).join("")+'</tbody></table>' : '<div class="empty-state">No saved documents yet. Upload a bill or payment proof, scan it, then choose “Save as document only”.</div>';
    } catch(e){toast(e.message,true);}
  }
  async function loadAccounts() {
    if (!can("account_view")) return;
    try {
      await refreshLookups();
      const active = state.accounts.filter(a=>a.active);
      $("accountSummary").innerHTML = `<div class="account-summary-chip">Bank accounts<b>${active.filter(a=>a.account_type==="bank").length}</b></div><div class="account-summary-chip">Mobile wallets<b>${active.filter(a=>a.account_type==="wallet").length}</b></div><div class="account-summary-chip">Combined balance<b>${money(active.reduce((s,a)=>s+Number(a.current_balance||0),0))}</b></div>`;
      $("accountsGrid").innerHTML = active.length ? active.map(a => `<article class="account-card"><div class="account-card-head"><span class="account-emblem">${a.account_type==="bank"?"▣":"◉"}</span><div><h3>${esc(a.name)}</h3><small>${esc(a.institution || (a.account_type==="bank"?"Bank account":"Mobile wallet"))} · ${esc(a.scope)}</small></div></div><div class="account-balance-label">Current balance</div><div class="account-balance">${money(a.current_balance)}</div><div class="account-card-foot"><small>${a.account_number_hint ? "•••• "+esc(a.account_number_hint) : "No account hint saved"}</small>${can("account_manage")?`<button class="text-link" data-account-toggle="${esc(a.id)}">Deactivate</button>`:""}</div></article>`).join("") : '<div class="empty-state">No active accounts. Add your bank account or mobile wallet to begin.</div>';
    } catch(e) { toast(e.message,true); }
  }
  async function loadBusinesses() {
    if (!can("business_view")) return;
    try {
      const d = await api("businesses"); state.businesses = d.businesses || [];
      $("businessGrid").innerHTML = state.businesses.filter(b=>b.active).length ? state.businesses.filter(b=>b.active).map(b=>`<article class="business-card"><div class="business-icon">▤</div><h3>${esc(b.name)}</h3><small>Business cash-flow profile</small><div class="business-meta">${Number(b.transaction_count||0)} recorded transactions</div><div class="account-card-foot"><span class="status-pill active">Active</span>${can("business_manage")?`<button class="text-link" data-business-toggle="${esc(b.id)}">Deactivate</button>`:""}</div></article>`).join("") : '<div class="empty-state">No active business profiles. Add a business to separate its income and expenses.</div>';
    } catch(e) { toast(e.message,true); }
  }
  async function loadReports() {
    if (!can("report_view")) return;
    const from = $("reportFrom").value || new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10);
    const to = $("reportTo").value || today();
    $("reportFrom").value = from; $("reportTo").value = to;
    try {
      const d = await api("reports?from="+encodeURIComponent(from)+"&to="+encodeURIComponent(to));
      state.report=d;
      $("reportIncome").textContent=money(d.totals.income); $("reportExpense").textContent=money(d.totals.expense);
      $("reportNet").textContent=money(d.totals.net); $("reportCount").textContent=d.totals.transactions || 0;
      const max = Math.max(1,...(d.categories||[]).map(x=>Number(x.amount||0)));
      $("categoryBreakdown").innerHTML = d.categories?.length ? d.categories.map(x=>`<div class="breakdown-row"><span>${esc(x.category)} · ${esc(x.transaction_type)}</span><b>${money(x.amount)}</b><div class="progress-track"><div class="progress-fill" style="width:${Number(x.amount)/max*100}%"></div></div></div>`).join("") : '<div class="empty-state small">No transactions in this date range.</div>';
      renderChart($("reportChart"),(d.monthly||[]).map(x=>({month:x.month,income:x.income,expense:x.expense})));
    } catch(e){toast(e.message,true);}
  }
  async function loadTeam() {
    if (!can("team_view")) return;
    try {
      const d = await api("admin/users");
      const permKeys = Object.keys(permissionLabels);
      const userRows = (d.users||[]).map(u=>{
        const isOwner = u.role==="owner";
        const checks = permKeys.map(k=>{
          const defaults=roleDefaults[u.role]||[];
          const effective=Object.prototype.hasOwnProperty.call(u.permissions||{},k)?u.permissions[k]:(defaults.includes("*")||defaults.includes(k));
          return `<label class="permission-choice"><input type="checkbox" data-permission="${k}" ${effective?"checked":""} ${isOwner?"disabled":""}><span>${permissionLabels[k]}</span></label>`;
        }).join("");
        return `<tr><td><span class="tx-main">${esc(u.full_name || u.email)}</span><span class="tx-sub">${esc(u.email)}</span></td><td>${isOwner?'<span class="scope-pill">Owner</span>':`<select data-member-role="${esc(u.user_id)}"><option value="accountant" ${u.role==="accountant"?"selected":""}>Accountant</option><option value="cashier" ${u.role==="cashier"?"selected":""}>Cashier</option><option value="staff" ${u.role==="staff"?"selected":""}>Staff</option><option value="viewer" ${u.role==="viewer"?"selected":""}>Viewer</option></select>`}</td><td><span class="status-pill ${esc(u.status)}">${esc(u.status)}</span></td><td>${isOwner? "Full control" : `<details class="permission-details"><summary>Custom access</summary><div class="permission-grid">${checks}</div><select data-member-status="${esc(u.user_id)}"><option value="active" ${u.status==="active"?"selected":""}>Active</option><option value="pending" ${u.status==="pending"?"selected":""}>Pending</option><option value="suspended" ${u.status==="suspended"?"selected":""}>Suspended</option></select><button class="btn btn-outline btn-small" data-save-member="${esc(u.user_id)}">Save access</button></details>`}</td></tr>`;
      }).join("");
      const inviteRows=(d.invitations||[]).map(i=>`<tr><td>${esc(i.email)}</td><td>${esc(i.role)}</td><td><span class="status-pill pending">Invitation pending</span></td><td>Awaiting first sign-in</td></tr>`).join("");
      $("teamTable").innerHTML = `<table><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Permissions / action</th></tr></thead><tbody>${userRows}${inviteRows}</tbody></table>` || '<div class="empty-state">No team members yet.</div>';
    } catch(e){toast(e.message,true);}
  }
  async function loadAudit() {
    if (!can("audit_view")) return;
    try {
      const d=await api("audit");
      $("auditTable").innerHTML=d.logs?.length?`<table><thead><tr><th>Time</th><th>Action</th><th>Record</th><th>Details</th></tr></thead><tbody>${d.logs.map(l=>`<tr><td>${new Date(l.created_at).toLocaleString()}</td><td><span class="tx-main">${esc(l.action.replaceAll("_"," "))}</span></td><td>${esc(l.entity_type)} · ${esc(l.entity_id)}</td><td>${esc(JSON.stringify(l.details||{}))}</td></tr>`).join("")}</tbody></table>`:'<div class="empty-state">No activity recorded yet.</div>';
    } catch(e){toast(e.message,true);}
  }
  function updateTransactionFields() {
    const type=$("transactionType").value, scope=$("transactionScope").value;
    $("fromAccountWrap").hidden=type==="income"; $("toAccountWrap").hidden=type==="expense";
    $("businessWrap").hidden=scope!=="business";
    $("transactionFrom").innerHTML=optionsForAccounts($("transactionFrom").value);
    $("transactionTo").innerHTML=optionsForAccounts($("transactionTo").value);
    $("transactionBusiness").innerHTML=optionsForBusinesses($("transactionBusiness").value);
  }
  function resetScanFields() {
    state.pendingScan=null;
    $("scanReview").hidden=true;
    ["scanSenderName","scanSenderAccount","scanReceiverName","scanReceiverAccount","scanProvider","scanTime","scanFee","scanTax","scanBillNumber","scanInvoiceNumber","scanConsumerReference","scanDueDate","scanBillingPeriod","scanBiller"].forEach(id=>$(id).value="");
    $("scanPaymentStatus").value="unknown";
    $("scanWarnings").innerHTML="";
    $("scanFullText").textContent="";
    $("scanLineItems").textContent="";
    $("scanReportText").value="";
  }
  function buildScanTextReport(x={}) {
    const value=(v)=>v===null||v===undefined||String(v).trim()===""?"Not detected":String(v);
    const rows=[
      ["Document type",x.document_type],["Transaction direction",x.direction],
      ["Payment status",x.payment_status],["Amount paid / transferred",x.transaction_amount===null||x.transaction_amount===undefined?null:(value(x.currency||"PKR")+" "+value(x.transaction_amount))],
      ["Invoice / bill total",x.invoice_total],["Subtotal",x.subtotal],["Discount",x.discount_amount],
      ["Sender / payer",x.sender_name],["Sender account / mobile (masked)",x.sender_account_hint],
      ["Receiver / payee",x.receiver_name],["Receiver account / mobile (masked)",x.receiver_account_hint],
      ["Merchant / biller",x.merchant_or_biller],["Bank / wallet / provider",x.provider_name],
      ["Payment channel",x.channel],["Transaction date",x.transaction_date],["Transaction time",x.transaction_time],
      ["Matched source account ID",x.matched_from_account_id],["Matched receiving account ID",x.matched_to_account_id],
      ["Transaction reference",x.transaction_reference],["RRN / trace / UTR",x.rrn_or_trace],
      ["Bill number",x.bill_number],["Invoice number",x.invoice_number],
      ["Consumer / customer reference",x.consumer_or_customer_reference],["Billing period",x.billing_period],
      ["Due date",x.due_date],["Fee / service charges",x.fee_amount],["Tax / GST",x.tax_amount],
      ["Paid amount",x.transaction_amount],["Balance due",x.balance_due],["Narration",x.narration]
    ];
    const lines=["MEC DETAIL BANKING SYSTEM — AUTOMATIC DOCUMENT SCAN","==============================================="];
    rows.forEach(([label,v])=>lines.push(label+": "+value(v)));
    if(x.line_items?.length){
      lines.push("","LINE ITEMS","----------");
      x.line_items.forEach((item,i)=>lines.push((i+1)+". "+value(item.description)+" | Qty: "+value(item.quantity)+" | Unit price: "+value(item.unit_price)+" | Line total: "+value(item.line_total)));
    }
    if(x.other_details&&Object.keys(x.other_details).length){
      lines.push("","OTHER DETECTED DETAILS","-----------------------");
      for(const [k,v] of Object.entries(x.other_details)) lines.push(k.replaceAll("_"," ")+": "+(typeof v==="object"?JSON.stringify(v):value(v)));
    }
    if(x.field_confidence&&Object.keys(x.field_confidence).length){
      lines.push("","SCAN CONFIDENCE","---------------");
      for(const [k,v] of Object.entries(x.field_confidence)) lines.push(k.replaceAll("_"," ")+": "+Math.round(Math.max(0,Math.min(1,Number(v)||0))*100)+"%");
    }
    if(Array.isArray(x.warnings)&&x.warnings.length){
      lines.push("","REVIEW WARNINGS","---------------");
      x.warnings.forEach((w,i)=>lines.push((i+1)+". "+w));
    }
    lines.push("","FULL READABLE TEXT FROM ORIGINAL SLIP / BILL","---------------------------------------------",value(x.full_text));
    lines.push("","IMPORTANT: This is an automatic reading, not bank verification. Compare it with the original document before posting a transaction.");
    return lines.join("\n");
  }
  function fillScanDetails(x,meta={},suggest=true) {
    if(!x||typeof x!=="object")return;
    state.pendingScan=x;
    if(suggest) {
      if(x.transaction_amount!==null&&x.transaction_amount!==undefined&&x.transaction_amount!=="") $("transactionAmount").value=x.transaction_amount;
      if(/^\d{4}-\d{2}-\d{2}$/.test(x.transaction_date||"")) $("transactionDate").value=x.transaction_date;
      $("transactionReference").value=x.transaction_reference||x.rrn_or_trace||x.bill_number||x.invoice_number||$("transactionReference").value;
      if(x.direction==="debit") $("transactionType").value="expense";
      else if(x.direction==="credit") $("transactionType").value="income";
      else if(x.direction==="internal_transfer") $("transactionType").value="transfer";
      else if(x.direction==="third_party"||x.direction==="unknown") $("transactionType").value="";
      if(x.direction==="debit"&&x.matched_from_account_id) $("transactionFrom").value=x.matched_from_account_id;
      if(x.direction==="credit"&&x.matched_to_account_id) $("transactionTo").value=x.matched_to_account_id;
      if(x.direction==="internal_transfer") {
        if(x.matched_from_account_id) $("transactionFrom").value=x.matched_from_account_id;
        if(x.matched_to_account_id) $("transactionTo").value=x.matched_to_account_id;
      }
      const counterparty=x.direction==="debit"?(x.receiver_name||x.merchant_or_biller):(x.direction==="credit"?(x.sender_name||x.merchant_or_biller):(x.merchant_or_biller||x.receiver_name||x.sender_name));
      if(counterparty) $("transactionCounterparty").value=counterparty;
      const type=x.document_type||"";
      if(type==="utility_bill") $("transactionCategory").value="Utilities";
      else if(type==="invoice"||type==="retail_receipt") $("transactionCategory").value="Purchase";
    }
    updateTransactionFields();
    const fields={
      scanSenderName:x.sender_name,scanSenderAccount:x.sender_account_hint,scanReceiverName:x.receiver_name,
      scanReceiverAccount:x.receiver_account_hint,scanProvider:x.provider_name||x.merchant_or_biller,
      scanTime:x.transaction_time,scanFee:x.fee_amount,scanTax:x.tax_amount,scanBillNumber:x.bill_number,
      scanInvoiceNumber:x.invoice_number,scanConsumerReference:x.consumer_or_customer_reference,
      scanDueDate:x.due_date,scanBillingPeriod:x.billing_period,scanBiller:x.merchant_or_biller
    };
    Object.entries(fields).forEach(([id,value])=>$(id).value=value===null||value===undefined?"":String(value));
    $("scanPaymentStatus").value=["successful","pending","failed","reversed","unpaid","partial","unknown"].includes(x.payment_status)?x.payment_status:"unknown";
    $("scanDocumentType").textContent=String(x.document_type||"Financial document").replaceAll("_"," ");
    $("scanSummary").textContent=(meta.engine||"Smart document scan")+" · Please verify every important value before saving.";
    $("scanFullText").textContent=x.full_text||"No readable text transcription returned.";
    $("scanLineItems").textContent=x.line_items?.length?"Line items:\n"+JSON.stringify(x.line_items,null,2):"No line items were detected.";
    $("scanReportText").value=buildScanTextReport(x);
    const warnings=[...(Array.isArray(x.warnings)?x.warnings:[])];
    if(meta.possible_duplicate) warnings.push("Possible duplicate: a saved transaction has the same reference, amount and date. Check Transactions before recording it again.");
    const confidence=x.field_confidence||{};
    ["transaction_amount","transaction_date","transaction_reference","sender_name","receiver_name","payment_status"].forEach(k=>{
      if(confidence[k]!==undefined&&Number(confidence[k])>0&&Number(confidence[k])<0.75) warnings.push(k.replaceAll("_"," ")+" has low scan confidence ("+Math.round(Number(confidence[k])*100)+"%).");
    });
    $("scanWarnings").innerHTML=warnings.length?'<strong>Review required</strong><ul>'+warnings.map(w=>"<li>"+esc(w)+"</li>").join("")+"</ul>":'<span class="scan-ok">No critical scan warnings were returned. Still compare the values with the original document.</span>';
    $("scanReview").hidden=false;
  }
  function openTransaction(tx=null) {
    $("transactionForm").reset();
    resetScanFields();
    $("transactionId").value=tx?.id||"";
    $("transactionType").value=tx?.transaction_type||"income";
    $("transactionScope").value=tx?.scope||"personal";
    $("transactionAmount").value=tx?.amount||"";
    $("transactionFrom").innerHTML=optionsForAccounts(tx?.from_account_id);
    $("transactionTo").innerHTML=optionsForAccounts(tx?.to_account_id);
    $("transactionBusiness").innerHTML=optionsForBusinesses(tx?.business_id);
    $("transactionCategory").value=tx?.category||"General";
    $("transactionDate").value=String(tx?.transaction_date||today()).slice(0,10);
    $("transactionCounterparty").value=tx?.counterparty||"";
    $("transactionReference").value=tx?.reference||"";
    $("transactionDescription").value=tx?.description||"";
    $("transactionProof").value="";
    $("ocrStatus").textContent="Upload a bill or payment proof. Smart scan will extract details for your review before saving.";
    $("transactionModalTitle").textContent=tx?"Update transaction":"Add transaction";
    $("saveTransaction").textContent=tx?"Save changes":"Save transaction";
    updateTransactionFields();
    if(tx?.scan_data&&Object.keys(tx.scan_data).length) fillScanDetails(tx.scan_data,{engine:"Previously saved scan"},false);
    if(tx?.ocr_text||tx?.scan_data?.report_text) $("scanReportText").value=tx.ocr_text||tx.scan_data.report_text;
    $("scanFee").value=tx?.fee_amount??$("scanFee").value;
    $("scanTax").value=tx?.tax_amount??$("scanTax").value;
    $("scanSenderName").value=tx?.sender_name||$("scanSenderName").value;
    $("scanSenderAccount").value=tx?.sender_account_hint||$("scanSenderAccount").value;
    $("scanReceiverName").value=tx?.receiver_name||$("scanReceiverName").value;
    $("scanReceiverAccount").value=tx?.receiver_account_hint||$("scanReceiverAccount").value;
    $("scanProvider").value=tx?.provider_name||$("scanProvider").value;
    $("scanTime").value=tx?.transaction_time||$("scanTime").value;
    $("scanBillNumber").value=tx?.bill_number||$("scanBillNumber").value;
    $("scanInvoiceNumber").value=tx?.invoice_number||$("scanInvoiceNumber").value;
    $("scanPaymentStatus").value=tx?.payment_status||$("scanPaymentStatus").value;
    $("transactionModal").showModal();
  }
  function openDialog(id){$(id).showModal();}
  function closeDialog(id){$(id).close();}
  async function refreshAll() {
    await refreshLookups();
    await Promise.all([loadDashboard(),loadTransactions(),loadAccounts(),loadBusinesses()]);
  }
  async function saveTransaction(e) {
    e.preventDefault();
    const id=$("transactionId").value;
    const type=$("transactionType").value;
    const body={
      id:id||undefined, transaction_type:type, scope:$("transactionScope").value,
      amount:Number($("transactionAmount").value),
      from_account_id:type==="income"?null:$("transactionFrom").value||null,
      to_account_id:type==="expense"?null:$("transactionTo").value||null,
      business_id:$("transactionScope").value==="business"?$("transactionBusiness").value:null,
      category:$("transactionCategory").value,
      transaction_date:$("transactionDate").value,
      counterparty:$("transactionCounterparty").value.trim(),
      reference:$("transactionReference").value.trim(),
      description:$("transactionDescription").value.trim(),
      sender_name:$("scanSenderName").value.trim(),
      sender_account_hint:$("scanSenderAccount").value.trim(),
      receiver_name:$("scanReceiverName").value.trim(),
      receiver_account_hint:$("scanReceiverAccount").value.trim(),
      provider_name:$("scanProvider").value.trim(),
      transaction_time:$("scanTime").value.trim(),
      fee_amount:Number($("scanFee").value||0),
      tax_amount:Number($("scanTax").value||0),
      bill_number:$("scanBillNumber").value.trim(),
      invoice_number:$("scanInvoiceNumber").value.trim(),
      payment_status:$("scanPaymentStatus").value,
      scan_data:{
        ...(state.pendingScan||{}),
        sender_name:$("scanSenderName").value.trim(),
        sender_account_hint:$("scanSenderAccount").value.trim(),
        receiver_name:$("scanReceiverName").value.trim(),
        receiver_account_hint:$("scanReceiverAccount").value.trim(),
        provider_name:$("scanProvider").value.trim(),
        transaction_time:$("scanTime").value.trim(),
        fee_amount:Number($("scanFee").value||0),
        tax_amount:Number($("scanTax").value||0),
        bill_number:$("scanBillNumber").value.trim(),
        invoice_number:$("scanInvoiceNumber").value.trim(),
        consumer_or_customer_reference:$("scanConsumerReference").value.trim(),
        due_date:$("scanDueDate").value,
        billing_period:$("scanBillingPeriod").value.trim(),
        merchant_or_biller:$("scanBiller").value.trim(),
        payment_status:$("scanPaymentStatus").value,
        report_text:$("scanReportText").value.trim(),
        raw_full_text:state.pendingScan?.full_text||""
      },
      ocr_text:$("scanReportText").value.trim()||state.pendingScan?.full_text||""
    };
    if(state.pendingScan && ["unpaid","failed","reversed","pending","unknown"].includes(body.payment_status)) return toast("This scan is not confirmed as a completed payment. Save it as a document only, or verify the status as Successful / Partial before posting a cash-flow transaction.",true);
    if (type==="income" && !body.to_account_id) return toast("Choose the account that received the money.",true);
    if (type==="expense" && !body.from_account_id) return toast("Choose the account that paid the money.",true);
    if (type==="transfer" && (!body.from_account_id || !body.to_account_id)) return toast("Choose both transfer accounts.",true);
    if (type==="transfer" && body.from_account_id===body.to_account_id) return toast("Source and destination accounts must be different.",true);
    if (body.scope==="business" && !body.business_id) return toast("Choose a business for this record.",true);
    const submit=$("saveTransaction"); submit.disabled=true;
    try {
      const saved=await api("transactions",{method:id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const tx=saved.transaction;
      const file=$("transactionProof").files[0];
      let proofNote="";
      if (file && !id) {
        const fd=new FormData(); fd.append("transaction_id",tx.id); fd.append("file",file);
        try { await api("proofs",{method:"POST",body:fd}); }
        catch (err) { proofNote=" Transaction saved, but proof upload failed: "+err.message; }
      } else if (file && id) {
        const fd=new FormData(); fd.append("transaction_id",tx.id); fd.append("file",file);
        try { await api("proofs",{method:"POST",body:fd}); }
        catch (err) { proofNote=" Changes saved, but proof upload failed: "+err.message; }
      }
      closeDialog("transactionModal");
      toast((id?"Transaction updated.":"Transaction saved.")+proofNote,!!proofNote);
      await refreshAll();
      if (state.page==="transactions") loadTransactions();
    } catch(err) { toast(err.message,true); }
    finally { submit.disabled=false; }
  }
  async function saveDocumentOnly() {
    const file=$("transactionProof").files[0];
    if(!file) return toast("Attach the original bill or payment proof first.",true);
    const button=$("saveDocumentOnly");button.disabled=true;
    try {
      const x={
        ...(state.pendingScan||{}),
        transaction_amount:state.pendingScan?.transaction_amount??(Number($("transactionAmount").value)||null),
        transaction_date:$("transactionDate").value,
        transaction_reference:$("transactionReference").value.trim(),
        sender_name:$("scanSenderName").value.trim(),
        sender_account_hint:$("scanSenderAccount").value.trim(),
        receiver_name:$("scanReceiverName").value.trim(),
        receiver_account_hint:$("scanReceiverAccount").value.trim(),
        provider_name:$("scanProvider").value.trim(),
        transaction_time:$("scanTime").value.trim(),
        fee_amount:Number($("scanFee").value||0),
        tax_amount:Number($("scanTax").value||0),
        bill_number:$("scanBillNumber").value.trim(),
        invoice_number:$("scanInvoiceNumber").value.trim(),
        consumer_or_customer_reference:$("scanConsumerReference").value.trim(),
        due_date:$("scanDueDate").value,
        billing_period:$("scanBillingPeriod").value.trim(),
        merchant_or_biller:$("scanBiller").value.trim(),
        payment_status:$("scanPaymentStatus").value,
        full_text:$("scanReportText").value.trim()||state.pendingScan?.full_text||"",
        report_text:$("scanReportText").value.trim(),
        raw_full_text:state.pendingScan?.full_text||""
      };
      x.title=x.bill_number?"Bill "+x.bill_number:x.invoice_number?"Invoice "+x.invoice_number:(x.merchant_or_biller||x.provider_name||"Financial document");
      const fd=new FormData();fd.append("metadata",JSON.stringify(x));fd.append("file",file);
      await api("documents",{method:"POST",body:fd});
      closeDialog("transactionModal");
      toast("Document saved in Documents & Bills. It has not changed account balances.");
      $("transactionForm").reset();resetScanFields();
      if(state.page==="documents")await loadDocuments();
    } catch(e){toast(e.message,true);}
    finally{button.disabled=false;}
  }
  async function uploadReceiptOCR(file) {
    if (!file) return;
    resetScanFields();
    const status=$("ocrStatus");
    if (file.size>5*1024*1024) { status.textContent="File is over 5 MB. Choose a smaller image or compress it first."; $("transactionProof").value=""; return; }
    if (!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)) { status.textContent="Unsupported file type. Use JPG, PNG, WebP or PDF."; return; }
    status.textContent="Smart scanning document… Reading sender, receiver, payment, bill and invoice details. Please keep this window open.";
    try {
      const fd=new FormData(); fd.append("file",file);
      const result=await api("scan",{method:"POST",body:fd});
      fillScanDetails(result.extraction,{engine:result.engine,possible_duplicate:result.possible_duplicate});
      const x=result.extraction||{};
      status.textContent="Smart scan completed. Detected "+String(x.document_type||"financial document").replaceAll("_"," ")+". Review every field and compare it with the original before saving. The document is not stored until you choose Save.";
      if(result.possible_duplicate) status.textContent+=" Possible duplicate detected—check existing transactions.";
    } catch(aiError) {
      status.textContent="AI smart scan was unavailable: "+aiError.message+". Trying local OCR fallback where possible.";
      if(file.type==="application/pdf") {
        status.textContent+=" PDF text scan needs AI provider access; you can still save this PDF as a document and enter the details manually.";
        return;
      }
      if(!window.Tesseract?.createWorker) {
        status.textContent+=" Local OCR is unavailable. You can still save the original file as a document.";
        return;
      }
      let worker;
      try {
        worker=await window.Tesseract.createWorker("eng");
        const result=await worker.recognize(file);
        const text=result.data.text||"";
        const compact=text.replace(/\s+/g," ").trim();
        const amountMatch=compact.match(/(?:amount|total|paid|debit|credit|rs\.?|pkr)\s*[:\-]?\s*(?:rs\.?\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)/i);
        const dateMatch=compact.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2}|\d{2})\b/);
        let iso="";
        if(dateMatch){let y=Number(dateMatch[3]);if(y<100)y+=2000;iso=y+"-"+String(Number(dateMatch[2])).padStart(2,"0")+"-"+String(Number(dateMatch[1])).padStart(2,"0");}
        const refMatch=compact.match(/(?:transaction|reference|txn|trx|trace|rrn|receipt)\s*(?:id|no|number|#)?\s*[:#\-]?\s*([A-Z0-9-]{6,})/i);
        const fallback={
          document_type:"other",direction:"unknown",payment_status:"unknown",
          transaction_amount:amountMatch?Number(amountMatch[1].replace(/,/g,"")):null,
          transaction_date:iso,transaction_time:"",transaction_reference:refMatch?refMatch[1]:"",
          sender_name:"",sender_account_hint:"",receiver_name:"",receiver_account_hint:"",provider_name:"",merchant_or_biller:"",fee_amount:null,tax_amount:null,
          bill_number:"",invoice_number:"",consumer_or_customer_reference:"",due_date:"",billing_period:"",line_items:[],field_confidence:{},
          warnings:["Only basic browser OCR was available. Sender, receiver, fee, tax and payment status may be missing. Verify every value."],
          full_text:text.slice(0,12000)
        };
        fillScanDetails(fallback,{engine:"Basic local OCR fallback"});
        status.textContent=text.trim()?"Basic local OCR completed. AI smart extraction was unavailable, so important fields may be missing. Carefully review the text and fields.":"No readable text found. Save the original file and enter details manually.";
      } catch(localError) {
        status.textContent+=" Local OCR also failed. Save the original file as a document and add details manually.";
      } finally { if(worker) await worker.terminate().catch(()=>{}); }
    }
  }
  async function saveAccount(e) {
    e.preventDefault();
    try {
      const body={name:$("accountName").value.trim(),institution:$("accountInstitution").value.trim(),account_type:$("accountType").value,scope:$("accountScope").value,opening_balance:Number($("accountOpening").value||0),opening_date:$("accountOpeningDate").value||today(),account_number_hint:$("accountHint").value.trim(),business_id:$("accountBusiness").value||null,notes:$("accountNotes").value.trim()};
      await api("accounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      closeDialog("accountModal"); $("accountForm").reset(); toast("Account saved."); await refreshLookups(); await loadAccounts(); await loadDashboard();
    } catch(e){toast(e.message,true);}
  }
  async function saveBusiness(e) {
    e.preventDefault();
    try {
      await api("businesses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:$("businessName").value.trim(),notes:$("businessNotes").value.trim()})});
      closeDialog("businessModal"); $("businessForm").reset(); toast("Business saved."); await refreshLookups(); await loadBusinesses(); await loadDashboard();
    } catch(e){toast(e.message,true);}
  }
  async function saveInvite(e) {
    e.preventDefault();
    try {
      const r=await api("admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("inviteEmail").value.trim(),role:$("inviteRole").value})});
      $("inviteForm").reset(); toast(r.invited?"Invitation added. Ask the member to sign up with this exact email.":"Existing member activated."); loadTeam();
    } catch(e){toast(e.message,true);}
  }
  async function saveMember(id,button) {
    const row=button.closest("tr");
    const role=row.querySelector("[data-member-role]")?.value;
    const status=row.querySelector("[data-member-status]")?.value;
    const permissions={};
    row.querySelectorAll("[data-permission]").forEach(el=>permissions[el.dataset.permission]=el.checked);
    button.disabled=true;
    try {
      await api("admin/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:id,role,status,permissions})});
      toast("Member access updated."); loadTeam();
    } catch(e){toast(e.message,true);}
    finally{button.disabled=false;}
  }
  async function voidTransaction(id) {
    $("voidTransactionId").value=id; $("voidReason").value=""; openDialog("voidModal");
  }
  async function submitVoid(e) {
    e.preventDefault();
    try {
      await api("transactions",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:$("voidTransactionId").value,action:"void",reason:$("voidReason").value.trim()})});
      closeDialog("voidModal"); toast("Transaction voided; the audit record is preserved."); await loadTransactions(); await loadDashboard();
    } catch(e){toast(e.message,true);}
  }
  async function toggleAccount(id,button) {
    const a=state.accounts.find(x=>x.id===id); if(!a)return;
    if(!confirm("Deactivate "+a.name+"? Previous transactions remain unchanged."))return;
    try { await api("accounts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,active:false})}); toast("Account deactivated."); loadAccounts(); }
    catch(e){toast(e.message,true);}
  }
  async function toggleBusiness(id) {
    const b=state.businesses.find(x=>x.id===id); if(!b)return;
    if(!confirm("Deactivate "+b.name+"? Existing financial records remain unchanged."))return;
    try { await api("businesses",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,active:false})}); toast("Business deactivated."); loadBusinesses(); }
    catch(e){toast(e.message,true);}
  }
  async function exportCSV() {
    try {
      const res=await fetch("/api/export",{credentials:"same-origin"});
      if(!res.ok){let d={};try{d=await res.json()}catch{};throw new Error(d.error||"Export failed.");}
      const blob=await res.blob(), url=URL.createObjectURL(blob), a=document.createElement("a");
      a.href=url;a.download="mec-transactions.csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    } catch(e){toast(e.message,true);}
  }
  async function start() {
    $("todayLabel").textContent=new Date().toLocaleDateString("en-PK",{weekday:"short",day:"2-digit",month:"short",year:"numeric"});
    $("transactionDate").value=today(); $("accountOpeningDate").value=today();
    $("reportFrom").value=new Date(new Date().getFullYear(),0,1).toISOString().slice(0,10); $("reportTo").value=today();
    try {
      const session=await window.hatchable.auth.getSession();
      if(!session?.user){location.replace("/login?next=/");return;}
      const data=await api("bootstrap");
      state.profile=data.profile;state.workspace=data.workspace;
      if(data.profile.status!=="active"){
        $("appLoading").hidden=true;$("pendingScreen").hidden=false;
        $("pendingSignOut").addEventListener("click",async()=>{await window.hatchable.auth.signOut();location.replace("/login");});
        return;
      }
      $("userName").textContent=data.profile.full_name||data.profile.email||"MEC User";
      $("userRole").textContent=data.profile.role;
      $("userAvatar").textContent=(data.profile.full_name||data.profile.email||"M").slice(0,1).toUpperCase();
      applyPermissions(); applyLanguage();
      await refreshLookups();
      $("appLoading").hidden=true;$("appShell").hidden=false;
      showPage("dashboard");
    } catch(e){
      $("appLoading").innerHTML='<img src="/mec-logo.webp" alt="MEC"><h2>Workspace could not be opened</h2><p>'+esc(e.message)+'</p><button class="btn btn-outline" onclick="location.reload()">Retry</button>';
    }
  }

  document.querySelectorAll(".nav-link[data-page]").forEach(el=>el.addEventListener("click",()=>showPage(el.dataset.page)));
  document.querySelectorAll("[data-go]").forEach(el=>el.addEventListener("click",()=>showPage(el.dataset.go)));
  $("quickAdd").addEventListener("click",()=>openTransaction());
  $("addTransactionPage").addEventListener("click",()=>openTransaction());
  $("addAccount").addEventListener("click",async()=>{await refreshLookups();$("accountBusiness").innerHTML=optionsForBusinesses();openDialog("accountModal");});
  $("addBusiness").addEventListener("click",()=>openDialog("businessModal"));
  $("transactionType").addEventListener("change",updateTransactionFields);
  $("transactionScope").addEventListener("change",updateTransactionFields);
  $("transactionForm").addEventListener("submit",saveTransaction);
  $("accountForm").addEventListener("submit",saveAccount);
  $("businessForm").addEventListener("submit",saveBusiness);
  $("inviteForm").addEventListener("submit",saveInvite);
  $("voidForm").addEventListener("submit",submitVoid);
  $("transactionProof").addEventListener("change",e=>uploadReceiptOCR(e.target.files?.[0]));
  $("saveDocumentOnly").addEventListener("click",saveDocumentOnly);
  $("refreshDocuments").addEventListener("click",loadDocuments);
  $("documentSearch").addEventListener("input",()=>{clearTimeout(loadDocuments._timer);loadDocuments._timer=setTimeout(loadDocuments,300);});
  $("transactionSearch").addEventListener("input",()=>{clearTimeout(loadTransactions._timer);loadTransactions._timer=setTimeout(loadTransactions,280);});
  $("filterType").addEventListener("change",loadTransactions);$("filterScope").addEventListener("change",loadTransactions);
  $("refreshTransactions").addEventListener("click",loadTransactions);
  $("exportTransactions").addEventListener("click",exportCSV);$("reportExport").addEventListener("click",exportCSV);
  $("runReport").addEventListener("click",loadReports);
  $("languageSwitch").addEventListener("click",()=>{state.lang=state.lang==="en"?"ur":"en";applyLanguage();});
  $("signOut").addEventListener("click",async()=>{await window.hatchable.auth.signOut();location.replace("/login");});
  $("mobileMenu").addEventListener("click",()=>{$("sidebar").classList.add("open");$("mobileScrim").classList.add("show");});
  $("mobileScrim").addEventListener("click",()=>{$("sidebar").classList.remove("open");$("mobileScrim").classList.remove("show");});
  document.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",()=>closeDialog(el.dataset.close)));
  document.addEventListener("click",e=>{
    const ed=e.target.closest("[data-edit]");if(ed){const tx=state.transactions.find(x=>x.id===ed.dataset.edit);if(tx)openTransaction(tx);}
    const v=e.target.closest("[data-void]");if(v)voidTransaction(v.dataset.void);
    const t=e.target.closest("[data-account-toggle]");if(t)toggleAccount(t.dataset.accountToggle,t);
    const b=e.target.closest("[data-business-toggle]");if(b)toggleBusiness(b.dataset.businessToggle);
    const m=e.target.closest("[data-save-member]");if(m)saveMember(m.dataset.saveMember,m);
  });
  start();
})();