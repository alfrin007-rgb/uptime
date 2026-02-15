const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

const RESTORE_URL = "https://templeadventures.com/restore_wp.php?key=temple_restore_2024";
const CLEAR_CACHE_URL = "https://templeadventures.com/clear_cache.php?key=clear_cache_secret_2026";

const LOG_FILE = "logs.json";

function loadLogs() {
    if (!fs.existsSync(LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(LOG_FILE));
}

function saveLogs(logs) {
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

async function callRestore() {
    let logs = loadLogs();

    try {
        const response = await axios.get(RESTORE_URL);
        logs.unshift({
            time: new Date().toLocaleString(),
            action: "Restore",
            status: response.status
        });
    } catch {
        logs.unshift({
            time: new Date().toLocaleString(),
            action: "Restore",
            status: "ERROR"
        });
    }

    logs = logs.slice(0, 30);
    saveLogs(logs);
}

async function clearCache() {
    let logs = loadLogs();

    try {
        await axios.get(CLEAR_CACHE_URL);
        logs.unshift({
            time: new Date().toLocaleString(),
            action: "Clear Cache",
            status: "SUCCESS"
        });
    } catch {
        logs.unshift({
            time: new Date().toLocaleString(),
            action: "Clear Cache",
            status: "ERROR"
        });
    }

    logs = logs.slice(0, 30);
    saveLogs(logs);
}

app.get("/run-now", async (req, res) => {
    await callRestore();
    res.redirect("/");
});

app.get("/clear-cache", async (req, res) => {
    await clearCache();
    res.redirect("/");
});

app.get("/", (req, res) => {
    const logs = loadLogs();

    res.send(`
  <html>
  <head>
    <title>Temple Cron Dashboard</title>
    <meta http-equiv="refresh" content="30">
    <style>
      body { font-family: Arial; background:#f4f6f9; padding:30px; }
      .card { background:white; padding:20px; border-radius:10px; max-width:900px; margin:auto; }
      table { width:100%; border-collapse:collapse; }
      th,td { padding:10px; text-align:left; }
      th { background:#eee; }
      tr:nth-child(even) { background:#fafafa; }
      .btn { padding:8px 15px; background:#3498db; color:white; text-decoration:none; border-radius:5px; margin-right:10px; }
      .error { color:red; font-weight:bold; }
      .success { color:green; font-weight:bold; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Temple Restore & Cache System</h2>
      <p>Restore: every 5 mins | Cache: every 1 hour</p>
      <a href="/run-now" class="btn">Run Restore Now</a>
      <a href="/clear-cache" class="btn">Clear Cache Now</a>
      <h3>Recent Activity</h3>
      <table>
        <tr><th>Time</th><th>Action</th><th>Status</th></tr>
        ${logs.map(log => `
          <tr>
            <td>${log.time}</td>
            <td>${log.action}</td>
            <td class="${log.status === "ERROR" ? "error" : "success"}">
              ${log.status}
            </td>
          </tr>
        `).join("")}
      </table>
    </div>
  </body>
  </html>
  `);
});

// Schedule tasks
setInterval(callRestore, 5 * 60 * 1000); // 5 minutes
setInterval(clearCache, 60 * 60 * 1000); // 1 hour

// Run immediately on start (optional, but good for testing)
callRestore();
clearCache();

app.listen(PORT, () => {
    console.log("Server running...");
});
