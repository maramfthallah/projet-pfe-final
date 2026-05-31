const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({

  // GitHub OAuth fields (Optional for local users)
  githubId:          { type: String, sparse: true, unique: true },
  githubUsername:    { type: String, default: '' },
  githubAvatar:      { type: String, default: '' },
  githubAccessToken: { type: String, select: false },

  // Google OAuth fields (Optional)
  googleId:          { type: String, sparse: true, unique: true },

  // Local Auth fields (Optional for OAuth users)
  email:       { type: String, sparse: true, unique: true },
  password:    { type: String, select: false },
  
  firstName:   { type: String, default: '' },
  lastName:    { type: String, default: '' },

  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free'
  },

  credits: { type: Number, default: 50 },

  preferences: {
    theme:         { type: String, default: 'dark' },
    notifications: { type: Boolean, default: true },
  },

  stats: {
    totalAnalyses:  { type: Number, default: 0 },
    totalPushes:    { type: Number, default: 0 },
    lastActiveAt:   { type: Date,   default: Date.now },
  },

  isActive: { type: Boolean, default: true },

}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Public JSON (no access token or password)
UserSchema.methods.toPublicJSON = function () {
  let authType = 'local';
  if (this.githubId) authType = 'github';
  if (this.googleId) authType = 'google';

  return {
    id:             this._id,
    githubId:       this.githubId,
    googleId:       this.googleId,
    githubUsername: this.githubUsername,
    githubAvatar:   this.githubAvatar,
    firstName:      this.firstName,
    lastName:       this.lastName,
    email:          this.email,
    plan:           this.plan,
    credits:        this.credits,
    preferences:    this.preferences,
    stats:          this.stats,
    createdAt:      this.createdAt,
    authType:       authType,
  };
};

module.exports = mongoose.model('User', UserSchema);