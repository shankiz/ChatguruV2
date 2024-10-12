const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { OAuth2Client } = require('google-auth-library');
const session = require('express-session');
const { ask } = require("./gemini.service");
const db = require('./db');
const { URL } = require('url');

const app = express(); // Initialize express app

const client = new OAuth2Client('514245604873-etsihper83o1d1cbi9pmhfm2hbifov9m.apps.googleusercontent.com');

// Middleware
app.use(cors({
  origin: 'https://chatguruv21-3c905pjl.b4a.run', // Allow this origin
  credentials: true, // Enable cookies and credentials
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Root route
app.get("/", (req, res) => {
  if (req.session.userId) {
    res.redirect('/chat');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Chat route
app.get("/chat", (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
  } else {
    res.redirect('/');
  }
});

// Google authentication callback route
app.post("/auth/google", async (req, res) => {
  const { token, referralCode } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'No token provided' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: '514245604873-etsihper83o1d1cbi9pmhfm2hbifov9m.apps.googleusercontent.com',
    });

    const payload = ticket.getPayload();
    const userId = payload['sub'];
    let user = await db.getUser(userId);

    // Create a new user if one doesn't exist
    if (!user) {
      user = await db.createUser(userId, payload['name'], payload['email'], 20, payload['picture'], referralCode);
    }

    req.session.userId = userId; // Save userId in session
    res.json({ success: true, name: user.name, credits: user.credits, picture: user.picture });
  } catch (error) {
    console.error("Error in /auth/google:", error);
    res.status(500).json({ success: false, message: 'Server error during authentication', error: error.message });
  }
});

// User data route
app.get("/user", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await db.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ name: user.name, email: user.email, credits: user.credits, picture: user.picture });
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: "Error fetching user data", details: error.message });
  }
});

// Chat API route
app.post("/chat", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { chat_id, message } = req.body;

  if (!chat_id || !message) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const user = await db.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (user.credits <= 0) {
      return res.status(403).json({ error: "No credits left" });
    }

    const response = await ask(chat_id, message);
    await db.updateCredits(req.session.userId, user.credits - 1);
    res.json({ response, creditsLeft: user.credits - 1 });
  } catch (error) {
    console.error("Error processing chat request:", error);
    res.status(500).json({ error: "Error processing request", details: error.message });
  }
});

// Logout route
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, message: "Error logging out" });
    } else {
      res.json({ success: true });
    }
  });
});

// Referral code route
app.get("/referral-code", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await db.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.referralCode) {
      user.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await user.save();
    }

    const referralLink = new URL(`${req.protocol}://${req.get('host')}`);
    referralLink.searchParams.append('ref', user.referralCode);

    res.json({ referralCode: user.referralCode, referralLink: referralLink.toString() });
  } catch (error) {
    res.status(500).json({ error: "Error fetching referral code", details: error.message });
  }
});

// Claim referral credits route
app.post("/claim-referral", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const result = await db.claimReferralCredits(req.session.userId);
    if (result.success) {
      res.json({ success: true, newCredits: result.newCredits, claimedCredits: result.claimedCredits });
    } else {
      res.json({ success: false, message: "No pending referrals to claim" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error claiming referral credits", details: error.message });
  }
});

// Route to get claimable referrals
app.get("/claimable-referrals", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await db.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const claimableCredits = user.pendingReferrals.length * 30; // Updated credits per referral
    res.json({ claimableReferrals: user.pendingReferrals.length, claimableCredits: claimableCredits });
  } catch (error) {
    res.status(500).json({ error: "Error fetching claimable referrals", details: error.message });
  }
});

// Start the server
app.listen(8080, () => {
  console.log("Server running on port 8080");
});

// Global error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: "An unexpected error occurred", details: err.message });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
