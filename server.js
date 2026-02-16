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

    const chartLabels = logs.slice(0, 20).reverse().map(l => l.time.split(',')[1].trim()); // Just the time for cleaner X axis
    const chartData = logs.slice(0, 20).reverse().map(l => l.status === "SUCCESS" ? 1 : 0);

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Temple Monitor</title>
    <meta http-equiv="refresh" content="30">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style>
        :root {
            --bg-dark: #0f172a;
            --card-bg: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --border-color: #334155;
            --success: #10b981;
            --error: #ef4444;
            --primary: #3b82f6;
            --warning: #f59e0b;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            line-height: 1.6;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: auto;
        }

        /* Header Styles */
        .header {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            margin-bottom: 40px;
            padding: 20px 0;
            border-bottom: 1px solid var(--border-color);
        }

        @media(min-width: 768px) {
            .header {
                flex-direction: row;
                justify-content: space-between;
                text-align: left;
            }
        }

        .header-titles h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 5px;
        }

        .header-titles p {
            color: var(--text-muted);
            font-size: 14px;
        }

        /* Status Badge with Pulse */
        .status-container {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 15px;
        }
        
        @media(min-width: 768px) { .status-container { margin-top: 0; } }

        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: ${down ? "var(--error)" : "var(--success)"};
            box-shadow: 0 0 0 0 ${down ? "rgba(239, 68, 68, 0.7)" : "rgba(16, 185, 129, 0.7)"};
            animation: pulse 2s infinite;
        }

        .status-text {
            font-weight: 600;
            letter-spacing: 1px;
            color: ${down ? "var(--error)" : "var(--success)"};
        }

        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 ${down ? "rgba(239, 68, 68, 0.7)" : "rgba(16, 185, 129, 0.7)"}; }
            70% { box-shadow: 0 0 0 10px rgba(0, 0, 0, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
        }

        /* Grid Cards */
        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: var(--card-bg);
            padding: 24px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .card h3 {
            color: var(--text-muted);
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }

        .card p {
            font-size: 32px;
            font-weight: 700;
        }

        .green { color: var(--success); }
        .red { color: var(--error); }

        /* Action Buttons */
        .actions {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            color: white;
            font-weight: 500;
            font-size: 14px;
            transition: all 0.2s ease;
            flex: 1;
            min-width: 150px;
            text-align: center;
        }
        
        @media(min-width: 768px) { .btn { flex: none; } }

        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .btn:active { transform: translateY(0); }
        
        .restore { background: var(--primary); }
        .cache { background: var(--warning); color: #000; }

        /* Chart & Table Boxes */
        .box {
            background: var(--card-bg);
            padding: 24px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            margin-bottom: 30px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .box h3 {
            margin-bottom: 20px;
            font-size: 16px;
            color: var(--text-main);
        }

        .chart-container {
            position: relative;
            height: 300px;
            width: 100%;
        }

        /* Responsive Table */
        .table-responsive {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }

        table {
            width: 100%;
            min-width: 600px;
            border-collapse: collapse;
        }

        th, td {
            padding: 14px 16px;
            text-align: left;
            font-size: 14px;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-muted);
            font-weight: 500;
        }

        tr:hover td { background: rgba(255, 255, 255, 0.02); }
        
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-success { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .badge-error { background: rgba(239, 68, 68, 0.1); color: var(--error); }
    </style>
</head>

<body>

<div class="container">

    <div class="header">
        <div class="header-titles">
            <h1>Temple Monitor</h1>
            <p>Auto Restore: 5 mins | Auto Cache Clear: 1 hour</p>
        </div>
        <div class="status-container">
            <div class="status-dot"></div>
            <span class="status-text">${down ? "SYSTEM DOWN" : "SYSTEM LIVE"}</span>
        </div>
    </div>

    <div class="cards">
        <div class="card">
            <h3>Total Logs</h3>
            <p>${logs.length}</p>
        </div>
        <div class="card">
            <h3>Successful Checks</h3>
            <p class="green">${successCount}</p>
        </div>
        <div class="card">
            <h3>Errors Detected</h3>
            <p class="red">${errorCount}</p>
        </div>
        <div class="card">
            <h3>Uptime Ratio</h3>
            <p class="green">${uptime}%</p>
        </div>
    </div>

    <div class="actions">
        <a href="/run-now" class="btn restore">Force Restore Now</a>
        <a href="/clear-cache" class="btn cache">Clear Cache Now</a>
    </div>

    <div class="box">
        <h3>Recent Uptime Activity (Last 20 Checks)</h3>
        <div class="chart-container">
            <canvas id="uptimeChart"></canvas>
        </div>
    </div>

    <div class="box">
        <h3>System Logs</h3>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Action Performed</th>
                        <th>Status</th>
                        <th>Response Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                    <tr>
                        <td style="color: var(--text-muted);">${log.time}</td>
                        <td>${log.action}</td>
                        <td>
                            <span class="badge ${log.status === "ERROR" ? "badge-error" : "badge-success"}">
                                ${log.status}
                            </span>
                        </td>
                        <td>${log.responseTime ? log.responseTime + " ms" : "-"}</td>
                    </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    </div>

</div>

<script>
    // Theme Chart.js for Dark Mode
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    new Chart(document.getElementById('uptimeChart'), {
        type: 'line',
        data: {
            labels: ${JSON.stringify(chartLabels)},
            datasets: [{
                label: 'Status (1=Up, 0=Down)',
                data: ${JSON.stringify(chartData)},
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#0f172a',
                pointBorderWidth: 2,
                pointRadius: 4,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#f8fafc',
                    borderColor: '#334155',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 1.1,
                    ticks: { stepSize: 1, callback: function(value) { return value === 1 ? 'UP' : (value === 0 ? 'DOWN' : ''); } },
                    grid: { color: '#334155' }
                },
                x: {
                    grid: { display: false }
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

