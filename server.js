const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

const SITE_URL = "https://templeadventures.com";
const RESTORE_URL = "https://templeadventures.com/restore_wp.php?key=temple_restore_2024";
const CLEAR_CACHE_URL = "https://templeadventures.com/clear_cache.php?key=clear_cache_secret_2026";

const LOG_FILE = "logs.json";

/* ---------------- LOG SYSTEM ---------------- */

function loadLogs() {
    if (!fs.existsSync(LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOG_FILE));
}

function saveLogs(logs) {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function addLog(action, status, responseTime = null) {
    let logs = loadLogs();

    logs.unshift({
        time: new Date().toLocaleString(),
        action,
        status,
        responseTime
    });

    logs = logs.slice(0, 100);
    saveLogs(logs);
}

/* ---------------- HEALTH CHECK ---------------- */

async function isSiteDown() {
    const start = Date.now();
    try {
        const response = await axios.get(SITE_URL, { timeout: 10000 });
        const responseTime = Date.now() - start;

        addLog("Health Check", "SUCCESS", responseTime);

        return response.status >= 400;
    } catch {
        addLog("Health Check", "ERROR", null);
        return true;
    }
}

/* ---------------- RESTORE ---------------- */

async function callRestore() {
    const down = await isSiteDown();

    if (!down) return;

    try {
        await axios.get(RESTORE_URL);
        addLog("Restore Triggered", "SUCCESS");
    } catch {
        addLog("Restore Triggered", "ERROR");
    }
}

/* ---------------- CACHE ---------------- */

async function clearCache() {
    try {
        await axios.get(CLEAR_CACHE_URL);
        addLog("Cache Clear", "SUCCESS");
    } catch {
        addLog("Cache Clear", "ERROR");
    }
}

/* ---------------- DASHBOARD ---------------- */

app.get("/", async (req, res) => {

    const logs = loadLogs();
    const down = await isSiteDown();

    const successCount = logs.filter(l => l.status === "SUCCESS").length;
    const errorCount = logs.filter(l => l.status === "ERROR").length;

    const uptime = logs.length
        ? ((successCount / logs.length) * 100).toFixed(1)
        : 100;

    const chartLabels = logs.slice(0, 20).reverse().map(l => l.time);
    const chartData = logs.slice(0, 20).reverse().map(l => l.status === "SUCCESS" ? 1 : 0);

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Temple Enterprise Monitor</title>
<meta http-equiv="refresh" content="30">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{
font-family:Segoe UI;
background:linear-gradient(135deg,#141e30,#243b55);
color:#333;
}
.container{
max-width:1200px;
margin:auto;
padding:20px;
}
.header{
text-align:center;
color:white;
margin-bottom:30px;
}
.status{
display:inline-block;
padding:8px 15px;
border-radius:20px;
margin-top:10px;
background:${down ? "#e74c3c" : "#27ae60"};
color:white;
font-size:14px;
}
.cards{
display:flex;
gap:20px;
flex-wrap:wrap;
margin-bottom:30px;
}
.card{
flex:1;
min-width:250px;
background:white;
padding:20px;
border-radius:12px;
box-shadow:0 6px 20px rgba(0,0,0,0.2);
}
.card h3{color:#777;font-size:14px;margin-bottom:10px;}
.card p{font-size:24px;font-weight:bold;}
.green{color:#27ae60;}
.red{color:#e74c3c;}
.actions{margin-bottom:20px;}
.btn{
display:inline-block;
padding:10px 18px;
border-radius:8px;
text-decoration:none;
color:white;
margin-right:10px;
}
.restore{background:#3498db;}
.cache{background:#9b59b6;}
.chart-box{
background:white;
padding:20px;
border-radius:12px;
margin-bottom:20px;
}
.table-wrapper{
background:white;
border-radius:12px;
overflow:hidden;
}
table{width:100%;border-collapse:collapse;}
th,td{padding:12px;font-size:13px;}
th{background:#f4f4f4;}
tr:nth-child(even){background:#fafafa;}
@media(max-width:768px){
.cards{flex-direction:column;}
}
</style>
</head>

<body>

<div class="container">

<div class="header">
<h1>Temple Adventures Enterprise Monitor</h1>
<div class="status">${down ? "SITE DOWN" : "SITE LIVE"}</div>
<p>Auto Restore: 5 mins | Auto Cache Clear: 1 hour</p>
</div>

<div class="cards">
<div class="card">
<h3>Total Logs</h3>
<p>${logs.length}</p>
</div>

<div class="card">
<h3>Success</h3>
<p class="green">${successCount}</p>
</div>

<div class="card">
<h3>Errors</h3>
<p class="red">${errorCount}</p>
</div>

<div class="card">
<h3>Uptime %</h3>
<p class="green">${uptime}%</p>
</div>
</div>

<div class="actions">
<a href="/run-now" class="btn restore">Run Restore</a>
<a href="/clear-cache" class="btn cache">Clear Cache</a>
</div>

<div class="chart-box">
<h3>Last 20 Checks</h3>
<canvas id="uptimeChart"></canvas>
</div>

<div class="table-wrapper">
<table>
<tr>
<th>Time</th>
<th>Action</th>
<th>Status</th>
<th>Response Time</th>
</tr>

${logs.map(log => `
<tr>
<td>${log.time}</td>
<td>${log.action}</td>
<td style="color:${log.status === "ERROR" ? "#e74c3c" : "#27ae60"};font-weight:bold;">
${log.status}
</td>
<td>${log.responseTime ? log.responseTime + " ms" : "-"}</td>
</tr>
`).join("")}

</table>
</div>

</div>

<script>
new Chart(document.getElementById('uptimeChart'), {
type: 'line',
data: {
labels: ${JSON.stringify(chartLabels)},
datasets: [{
label: 'Success (1) / Error (0)',
data: ${JSON.stringify(chartData)},
tension: 0.3
}]
},
options: {
responsive: true,
scales: {
y: {
min: 0,
max: 1
}
}
}
});
</script>

</body>
</html>
`);
});

/* ---------------- ROUTES ---------------- */

app.get("/run-now", async (req, res) => {
    await callRestore();
    res.redirect("/");
});

app.get("/clear-cache", async (req, res) => {
    await clearCache();
    res.redirect("/");
});

/* ---------------- SCHEDULER ---------------- */

setInterval(callRestore, 5 * 60 * 1000);
setInterval(clearCache, 60 * 60 * 1000);

callRestore();
clearCache();

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
    console.log("Enterprise Monitor Running on Port " + PORT);
});
