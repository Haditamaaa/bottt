const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 5000;

// Object to store QR code data for each client
let qrCodeData = {};

// Function to create and configure WhatsApp client
function createClient(clientId, minMessages, maxMessages, replyMessage, delay) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId }), // Use unique session for each client
  });

  let keywordDetected = false;
  let messageCounter = 0;
  let randomMessageThreshold = 0;
  let isMessageSent = false;

  let outputCounter = 0; // Variabel untuk menghitung jumlah output yang dicetak

  client.on("qr", (qr) => {
    console.log(`QR code for ${clientId} received, scan it with your WhatsApp app:`);

    // Generate QR code as base64 data URL
    qrcode.toDataURL(qr, (err, url) => {
      if (err) {
        console.error("Failed to generate QR code:", err);
      } else {
        // Save QR code base64 URL to the global object
        qrCodeData[clientId] = url;
      }
    });
  });

  client.on("ready", () => {
    console.log(`${clientId} is ready!`);
  });

  client.on("auth_failure", () => {
    console.log("Autentikasi gagal! Reset proses...");
    process.exit(1); // Reset aplikasi
  });

  client.on("disconnected", (reason) => {
    console.log(`Bot terputus: ${reason}. Memaksa keluar...`);
    process.exit(1); // Reset aplikasi
  });

  client.on("message", async (message) => {
    try {
      const groupIds = new Set(["120363388373592842@g.us"]);
      const cekGroup = groupIds.has(message.from);
      const cekKunci = ["halo dek"].some((keyword) => message.body.toLowerCase().includes(keyword));

      console.log("Ini adalah ID grup:", message.from);
      console.log("Ini adalah nomor pengirim:", message.author);
      console.log("Ini adalah pesan:", message.body);

      if (cekKunci && cekGroup && !keywordDetected && !isMessageSent) {
        console.log(`Keyword terdeteksi di ${clientId}.`);
        keywordDetected = true;
        messageCounter = 0;
        randomMessageThreshold = Math.floor(Math.random() * (maxMessages - minMessages + 1)) + minMessages;
        console.log(`Menunggu ${randomMessageThreshold} pesan baru sebelum membalas.`);
      }

      if (keywordDetected && !isMessageSent) {
        messageCounter++;

        if (messageCounter >= randomMessageThreshold && !isMessageSent) {
          const detik = Math.floor(Math.random() * delay) + 1000; // Random delay between 1-10 seconds
          console.log(`Balasan akan dikirim oleh ${clientId} dalam ${detik / 1000} detik...`);

          isMessageSent = true; // Tandai bahwa pesan telah dikirim
          keywordDetected = false; // Reset deteksi kata kunci agar tidak terdeteksi ulang
          messageCounter = 0; // Reset penghitung pesan
          setTimeout(async () => {
            await client.sendMessage(message.from, replyMessage);
            console.log(`${clientId} mengirim: "${replyMessage}"`);

            // Mulai looping output setelah pesan dikirim
            loopOutput();
          }, detik);
        }
      }

      if (isMessageSent) {
        return (isMessageSent = false);
      }
    } catch (err) {
      console.error("Terjadi kesalahan:", err.message);
      process.exit(1); // Reset aplikasi
    }
  });

  function loopOutput() {
    // Looping output 50 kali setelah pesan terkirim
    const intervalId = setInterval(() => {
      if (outputCounter >= 50) {
        clearInterval(intervalId); // Hentikan looping setelah 50 teks tercetak
        console.log("Looping output selesai setelah 50 teks.");
      } else {
        console.log(`Output ${clientId}: Teks ke-${outputCounter + 1} - Menunggu pesan untuk diproses...`);
        outputCounter++;
      }
    }, 1000); // Output tiap 1 detik
  }

  return client;
}

// Create a client
const client1 = createClient("client1", 1, 2, "Spam Arrived", 1000);

// Initialize client
client1.initialize();

// Express server
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded form data

app.get("/", (req, res) => {
  // Display both QR codes on the same page with Clear Session buttons
  const client1QRCode = qrCodeData.client1 ? `<img src="${qrCodeData.client1}" alt="QR Code for Client 1">` : "QR code for Client 1 is not available yet.";

  res.send(`
        <h1>WhatsApp Web QR Codes</h1>
        <p><strong>Client 1 QR Code:</strong></p>
        ${client1QRCode}
        <form action="/clear-session" method="POST">
            <input type="hidden" name="clientId" value="client1">
            <button type="submit">Clear Client 1 Session</button>
        </form>
        
    `);
});

// Route to clear session data
app.post("/clear-session", (req, res) => {
  const { clientId } = req.body;

  if (clientId && qrCodeData[clientId]) {
    console.log(`Clearing session for ${clientId}`);

    // Delete the session directory manually using fs
    const sessionPath = path.join(__dirname, "wwebjs_auth", clientId);
    if (fs.existsSync(sessionPath)) {
      fs.rmdirSync(sessionPath, { recursive: true }); // Remove the session folder for the client
      console.log(`Session for ${clientId} cleared.`);
    } else {
      console.log(`No session found for ${clientId}`);
    }

    // Remove the QR code from memory
    delete qrCodeData[clientId];

    // Redirect to the home page to update the QR code status
    res.redirect("/");
  } else {
    res.status(400).send("Invalid client ID");
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
