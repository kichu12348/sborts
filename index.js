const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const creds = require("./creds_sheets.json");

const SPREADSHEET_ID = "1WlEgug-ELhb-OnJmFha15gBAO6j-cKwc0AWd0wGujas";

const rateLimitedHtml = fs.readFileSync(
  path.join(__dirname, "public", "429.html"),
  "utf8"
);

const rateLimiter = {
  clients: new Map(),
  limit: 100, //100 requests
  interval: 15 * 60 * 1000, // 15 minutes
  resetTime: Date.now() + 15 * 60 * 1000,

  isAllowed(ip) {
    const now = Date.now();
    if (now > this.resetTime) {
      this.clients.clear();
      this.resetTime = now + this.interval;
    }

    const clientRequests = this.clients.get(ip) || 0;
    if (clientRequests >= this.limit) return false;

    this.clients.set(ip, clientRequests + 1);
    return true;
  },
};

const server = http.createServer((req, res) => {
  const clientIP = req.socket.remoteAddress;

  if (!rateLimiter.isAllowed(clientIP)) {
    res.writeHead(429, { "Content-Type": "text/html" });
    return res.end(rateLimitedHtml);
  }

  fs.readFile(path.join(__dirname, "public", "index.html"), (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Error loading index.html" + err.message);
    }
    res.writeHead(200);
    res.end(data);
  });
});

const io = require("socket.io")(server);

const serviceAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

let previousScores = null;

const hashAndCompare = (data1, data2) => {
  const hash1 = crypto.createHash("sha256").update(data1).digest("hex");
  const hash2 = crypto.createHash("sha256").update(data2).digest("hex");
  return hash1 === hash2;
};

async function fetchScores() {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAuth);

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  const totalScores = {
    totalScoreRed: 0,
    totalScoreBlue: 0,
    totalScoreGreen: 0,
    totalScoreYellow: 0,
  };
  const scores = rows.map((row) => {
    const [event, red, blue, green, yellow] = row._rawData;
    totalScores.totalScoreRed += parseInt(red);
    totalScores.totalScoreBlue += parseInt(blue);
    totalScores.totalScoreGreen += parseInt(green);
    totalScores.totalScoreYellow += parseInt(yellow);
    return { event, red, blue, green, yellow };
  });
  return { scores, totalScores };
}

async function checkForUpdates() {
  try {
    const { scores: currentScores, totalScores } = await fetchScores();

    const isSame = previousScores
      ? hashAndCompare(
          JSON.stringify(previousScores),
          JSON.stringify(currentScores)
        )
      : false;
    if (!isSame) {
      io.emit("scoreUpdate", {
        scores: currentScores,
        totalScores,
      });
      previousScores = currentScores;
    }
  } catch (error) {
    console.log("Error fetching scores:", error.message);
  }
}

setInterval(checkForUpdates, 5000);

io.on("connection", (socket) => {
  fetchScores().then(({ scores, totalScores }) => {
    previousScores = scores;
    socket.emit("scoreUpdate", {
      scores,
      totalScores,
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
