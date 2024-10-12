      const express = require("express");
      const cors = require("cors");
      const bodyParser = require("body-parser");
      const path = require("path");
      const { OAuth2Client } = require('google-auth-library');
      const session = require('express-session');
      const { ask } = require("./gemini.service");
      const db = require('./db');
      const { URL } = require('url');

      const app = express(); // Add this line to define the app

      const client = new OAuth2Client('514245604873-etsihper83o1d1cbi9pmhfm2hbifov9m.apps.googleusercontent.com');

      app.use(cors());
      app.use(bodyParser.json({ limit: '50mb' }));
      app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
      app.use(express.static(path.join(__dirname, 'public')));
      app.use(session({
        secret: 'your-secret-key',
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false } // Set to true if using HTTPS
      }));

      app.get("/", (req, res) => {
        console.log("Received request for root path");
        if (req.session.userId) {
          res.redirect('/chat');
        } else {
          res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
      });

      app.get("/chat", (req, res) => {
        console.log("Received request for chat path");
        if (req.session.userId) {
          res.sendFile(path.join(__dirname, 'public', 'chat.html'));
        } else {
          res.redirect('/');
        }
      });

      app.post("/auth/google", async (req, res) => {
        console.log("Received auth request");
        const { token, referralCode } = req.body;
        console.log(`Referral code received: ${referralCode}`);
        if (!token) {
          console.error("No token provided");
          return res.status(400).json({ success: false, message: 'No token provided' });
        }
        try {
          console.log("Verifying token");
          const ticket = await client.verifyIdToken({
            idToken: token,
            audience: '514245604873-etsihper83o1d1cbi9pmhfm2hbifov9m.apps.googleusercontent.com'
          });
          const payload = ticket.getPayload();
          const userId = payload['sub'];
          console.log("User ID:", userId);
          let user = await db.getUser(userId);
          if (!user) {
            console.log("Creating new user with referral code:", referralCode);
            user = await db.createUser(userId, payload['name'], payload['email'], 20, payload['picture'], referralCode);
            console.log("New user created:", JSON.stringify(user));
          } else {
            console.log("Existing user found:", JSON.stringify(user));
          }
          req.session.userId = userId;
          console.log("Session created for user:", userId);
          res.json({ success: true, name: user.name, credits: user.credits, picture: user.picture });
        } catch (error) {
          console.error("Error in /auth/google:", error);
          res.status(500).json({ success: false, message: 'Server error during authentication', error: error.message });
        }
      });

      app.get("/user", async (req, res) => {
        console.log("Received request for user data");
        if (!req.session.userId) {
          console.error("User not authenticated");
          return res.status(401).json({ error: "Not authenticated" });
        }
        try {
          const user = await db.getUser(req.session.userId);
          if (!user) {
            console.error("User not found:", req.session.userId);
            return res.status(404).json({ error: "User not found" });
          }
          console.log("Returning user data for:", user.name);
          res.json({
            name: user.name,
            email: user.email,
            credits: user.credits,
            picture: user.picture
          });
        } catch (error) {
          console.error("Error fetching user data:", error);
          res.status(500).json({ error: "Error fetching user data", details: error.message });
        }
      });

      app.post("/chat", async (req, res) => {
        console.log("Received chat request");
        if (!req.session.userId) {
          console.error("User not authenticated");
          return res.status(401).json({ error: "Not authenticated" });
        }
        const chatId = req.body.chat_id;
        const message = req.body.message;
        if (!chatId || !message) {
          console.error("Invalid request: missing chat_id or message");
          return res.status(400).json({ error: "Invalid request" });
        }
        try {
          const user = await db.getUser(req.session.userId);
          if (!user) {
            console.error("User not found:", req.session.userId);
            return res.status(404).json({ error: "User not found" });
          }
          if (user.credits <= 0) {
            console.log("User has no credits left:", req.session.userId);
            return res.status(403).json({ error: "No credits left" });
          }
          console.log("Processing chat request for user:", user.name);
          const response = await ask(chatId, message);
          await db.updateCredits(req.session.userId, user.credits - 1);
          console.log("Chat response sent, credits updated for user:", user.name);
          res.json({ response, creditsLeft: user.credits - 1 });
        } catch (error) {
          console.error("Error processing chat request:", error);
          res.status(500).json({ error: "Error processing request", details: error.message });
        }
      });

      app.post("/logout", (req, res) => {
        req.session.destroy((err) => {
          if (err) {
            console.error("Error during logout:", err);
            res.status(500).json({ success: false, message: "Error logging out" });
          } else {
            res.json({ success: true });
          }
        });
      });

      app.listen(8080, () => {
        console.log("Server running on port 8080");
      });

      // Global error handler
      app.use((err, req, res, next) => {
        console.error("Unhandled error:", err);
        res.status(500).json({ error: "An unexpected error occurred", details: err.message });
      });

      process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      });

      process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        process.exit(1);
      });

      // Add a new route to get the user's referral code
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

      // Add a new route to claim referral credits
      app.post("/claim-referral", async (req, res) => {
        if (!req.session.userId) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        try {
          console.log(`Attempting to claim referral credits for user ${req.session.userId}`);
          const result = await db.claimReferralCredits(req.session.userId);
          if (result.success) {
            console.log(`Successfully claimed ${result.claimedCredits} credits for user ${req.session.userId}`);
            res.json({ success: true, newCredits: result.newCredits, claimedCredits: result.claimedCredits });
          } else {
            console.log(`No pending referrals to claim for user ${req.session.userId}`);
            res.json({ success: false, message: "No pending referrals to claim" });
          }
        } catch (error) {
          console.error("Error claiming referral credits:", error);
          res.status(500).json({ error: "Error claiming referral credits", details: error.message });
        }
      });

      // Add this new route
      app.get("/claimable-referrals", async (req, res) => {
        if (!req.session.userId) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        try {
          const user = await db.getUser(req.session.userId);
          if (!user) {
            return res.status(404).json({ error: "User not found" });
          }
          console.log(`Checking claimable referrals for user ${user.userId}. Pending referrals:`, user.pendingReferrals);
          const claimableCredits = user.pendingReferrals.length * 30; // Changed from 7 to 30 credits per referral
          res.json({ 
            claimableReferrals: user.pendingReferrals.length,
            claimableCredits: claimableCredits
          });
        } catch (error) {
          console.error("Error fetching claimable referrals:", error);
          res.status(500).json({ error: "Error fetching claimable referrals", details: error.message });
        }
      });
