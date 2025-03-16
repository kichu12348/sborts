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
  limit: 500, //500 requests
  interval: 3 * 60 * 1000, // 3 minutes
  resetTime: Date.now() + 3 * 60 * 1000, // 3 minutes from now

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
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type");
  res.setHeader("Access-Control-Allow-Credentials", true);
  //// Set CORS headers
  if (req.url.startsWith("/fonts")) {
    const fileName = req.url.split("/").pop();
    fs.readFile(
      path.join(__dirname, "public", "fonts", fileName),
      (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading font" + err.message);
        }
        res.writeHead(200);
        res.end(data);
      }
    );
    return;
  }
  if (req.url.startsWith("/images")) {
    const fileName = req.url.split("/").pop();
    fs.readFile(
      path.join(__dirname, "public", "images", fileName),
      (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading css" + err.message);
        }
        const headers = {
          "Content-Type": "image/svg+xml",
        };
        res.writeHead(200, headers);
        res.end(data);
      }
    );
    return;
  }

  if (req.url.startsWith("/scripts")) {
    const fileName = req.url.split("/").pop();
    fs.readFile(
      path.join(__dirname, "public", "scripts", fileName),
      (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading script" + err.message);
        }
        const headers = {
          "Content-Type": "text/javascript",
        };
        res.writeHead(200, headers);
        res.end(data);
      }
    );
    return;
  }
  if (req.url.startsWith("/styles")) {
    const fileName = req.url.split("/").pop();
    fs.readFile(
      path.join(__dirname, "public", "styles", fileName),
      (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading css" + err.message);
        }
        const headers = {
          "Content-Type": "text/css",
        };
        res.writeHead(200, headers);
        res.end(data);
      }
    );
    return;
  }
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

const io = require("socket.io")(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost", "*"], // Allow common development origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["X-Requested-With", "Content-Type"],
    credentials: true
  }
});

const serviceAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAuth);

let previousScores = null;
let previousTotalScores = null;

const hashAndCompare = (data1, data2) => data1 === data2;
  //hashing is slower back to back than comparing strings
  

async function fetchScoresWithBackoff(retries = 5, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await doc.loadInfo();
      const sheet = doc.sheetsByIndex[0];
      const rows = await sheet.getRows();

      const totalScores = {
        totalAtredies: 0,
        totalArrakis: 0,
        totalWinterfell: 0,
        totalZephandor: 0,
      };

      const scores = rows.map((row) => {
        const [event,Atreides, Arrakis, Winterfell, Zephandor] = row._rawData;
        const Athreides_Score = parseInt(Atreides)||0;
        const Arrakis_Score = parseInt(Arrakis)||0;
        const Winterfell_Score = parseInt(Winterfell)||0;
        const Zephandor_Score = parseInt(Zephandor)||0;
        totalScores.totalAtredies += Athreides_Score;
        totalScores.totalArrakis += Arrakis_Score;
        totalScores.totalWinterfell += Winterfell_Score;
        totalScores.totalZephandor += Zephandor_Score;

        return {
          event,
          scores: {
            Atreides: Athreides_Score,
            Arrakis: Arrakis_Score,
            Winterfell: Winterfell_Score,
            Zephandor: Zephandor_Score,
          },
        };
      });

      return { scores, totalScores };
    } catch (error) {
      const jitter = Math.random() * delay;
      const waitTime = delay + jitter;
      console.log(
        `Fetch attempt ${i + 1} failed. Retrying in ${waitTime.toFixed(0)}ms... 
        Error: ${error.message}
        time: ${new Date().toLocaleTimeString()}
        `
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      delay *= 2;
    }
  }
  throw new Error("Max retries reached for fetching scores");
}

async function checkForUpdates() {
  try {
    const { scores: currentScores, totalScores } =
      await fetchScoresWithBackoff();
    const isSame = previousScores
      ? hashAndCompare(
          JSON.stringify(previousScores),
          JSON.stringify(currentScores)
        )
      : false;
    if (!isSame) {
      io.emit("scoreUpdate", { scores: currentScores, totalScores });
      previousScores = currentScores;
      previousTotalScores = totalScores;
    }
  } catch (error) {
    console.log("Error fetching scores:", error.message);
  }
}

setInterval(checkForUpdates, 5000);

io.on("connection", (socket) => {
  if(previousScores && previousTotalScores) {
    socket.emit("scoreUpdate", { scores: previousScores, totalScores: previousTotalScores });
    return;
  }
  fetchScoresWithBackoff().then(({ scores, totalScores }) => {
    previousScores = scores;
    previousTotalScores = totalScores;
    socket.emit("scoreUpdate", { scores, totalScores });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 😎 🚀`);
});
