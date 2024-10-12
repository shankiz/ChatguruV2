const mongoose = require('mongoose');

const mongoUri = "mongodb+srv://derderprince10:MZmsbF2YeSypSWwz@cluster0.aquqj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Connected to MongoDB Atlas");
});

const userSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  credits: Number,
  picture: String,
  referralCode: String,
  referredBy: String,
  pendingReferrals: [String],
  claimedReferrals: [String]
});

const User = mongoose.model('User', userSchema);

async function getUser(userId) {
  return await User.findOne({ userId });
}

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createUser(userId, name, email, initialCredits, picture, referralCode = null) {
  const newUserReferralCode = generateReferralCode();
  const newUser = new User({ 
    userId, 
    name, 
    email, 
    credits: initialCredits, 
    picture, 
    referralCode: newUserReferralCode, 
    referredBy: referralCode 
  });
  await newUser.save();

  console.log(`New user created: ${userId}, Referred by: ${referralCode}`);

  if (referralCode) {
    const result = await addPendingReferral(referralCode, userId);
    console.log(`Referral result for ${userId}: ${JSON.stringify(result)}`);
  }

  return newUser;
}

async function updateCredits(userId, newCredits) {
  await User.updateOne({ userId }, { $set: { credits: newCredits } });
}

async function claimReferralCredits(userId) {
  const user = await User.findOne({ userId });
  if (user && user.pendingReferrals.length > 0) {
    const creditsToAdd = 30 * user.pendingReferrals.length; // Changed from 7 to 30 credits per referral
    user.credits += creditsToAdd;
    user.claimedReferrals = [...user.claimedReferrals, ...user.pendingReferrals];
    user.pendingReferrals = [];
    await user.save();
    console.log(`User ${userId} claimed ${creditsToAdd} credits for ${user.claimedReferrals.length} referrals`);
    return { success: true, newCredits: user.credits, claimedCredits: creditsToAdd };
  }
  return { success: false };
}

async function addPendingReferral(referrerCode, newUserId) {
  console.log(`Attempting to add pending referral. Referrer code: ${referrerCode}, New user: ${newUserId}`);
  const referrer = await User.findOneAndUpdate(
    { referralCode: referrerCode },
    { $push: { pendingReferrals: newUserId } },
    { new: true }
  );
  if (referrer) {
    console.log(`Added pending referral for user ${newUserId} to referrer ${referrer.userId}. Updated pending referrals: ${referrer.pendingReferrals}`);
  } else {
    console.log(`No referrer found for code: ${referrerCode}`);
  }
  return referrer;
}

module.exports = { 
  getUser, 
  createUser, 
  updateCredits, 
  claimReferralCredits, 
  User,
  addPendingReferral  // Add this new function to the exports
};
