// controllers/authController.js
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

function normalizeEmail(email) {
  if (typeof email !== 'string') return undefined;
  const normalized = email.trim().toLowerCase();
  return normalized || undefined;
}

// ─── POST /api/auth/register — Local Email/Password Registration ───
exports.register = async (req, res) => {
  try {
    const { password, firstName, lastName } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields (firstName, lastName, email, password)' });
    }

    // Password complexity: At least 8 chars, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.' });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    user = await User.create({
      email,
      password,
      firstName,
      lastName,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('[authController] register error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/auth/login — Local Email/Password Login ───
exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check user and password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last active
    user.stats.lastActiveAt = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    console.error('[authController] login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/auth/github — Redirect to GitHub OAuth ───
exports.githubAuth = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

  if (!clientId) {
    return res.status(500).json({
      success: false,
      message: 'GITHUB_CLIENT_ID not configured. Check your .env.development file.',
    });
  }

  const callbackUrl = `${backendUrl}/api/auth/github/callback`;

  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: callbackUrl,
    scope:        'repo read:user user:email',
    state:        Math.random().toString(36).substring(2),
  });

  console.log('[GitHub OAuth] Redirecting to GitHub with callback:', callbackUrl);
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
};

// ─── GET /api/auth/github/callback — Handle OAuth callback ───
exports.githubCallback = async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!code) {
    console.error('[GitHub OAuth] No code received');
    return res.redirect(`${frontendUrl}?error=no_code`);
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not configured');
    }

    // 1. Exchange code for access token
    console.log('[GitHub OAuth] Exchanging code for token...');
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const callbackUrl = `${backendUrl}/api/auth/github/callback`;

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  callbackUrl,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('[GitHub OAuth] Token error:', tokenData);
      return res.redirect(`${frontendUrl}?error=token_failed&details=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const accessToken = tokenData.access_token;
    console.log('[GitHub OAuth] Got access token, fetching user profile...');

    // 2. Get GitHub user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'SmartCodeReview',
      },
    });
    const ghUser = await userRes.json();

    if (!ghUser.id) {
      console.error('[GitHub OAuth] Failed to get user profile:', ghUser);
      throw new Error('Failed to get GitHub user profile');
    }

    // 3. Get GitHub user email (may be private)
    let email = normalizeEmail(ghUser.email);
    if (!email) {
      try {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'SmartCodeReview',
          },
        });
        const emails = await emailsRes.json();
        if (Array.isArray(emails)) {
          const primary = emails.find(e => e.primary && e.verified);
          email = normalizeEmail(primary?.email || emails[0]?.email);
        }
      } catch (emailErr) {
        console.warn('[GitHub OAuth] Could not fetch emails:', emailErr.message);
      }
    }

    console.log('[GitHub OAuth] User:', ghUser.login, '| Email:', email);

    // 4. Create or update user in MongoDB
    // Try to find by GitHub ID first, then fallback to Email (account merging)
    let user = await User.findOne({ githubId: String(ghUser.id) });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    // Parse GitHub name
    const [firstName, ...lastNames] = (ghUser.name || ghUser.login).split(' ');
    const lastName = lastNames.join(' ') || '';

    if (user) {
      // Update token and profile info
      user.githubId          = String(ghUser.id);
      user.githubAccessToken = accessToken;
      user.githubAvatar      = ghUser.avatar_url || '';
      user.githubUsername    = ghUser.login;
      
      // Don't overwrite names if user already set them via local auth
      if (!user.firstName) user.firstName = firstName;
      if (!user.lastName) user.lastName = lastName;
      
      if (email) user.email = email;
      user.stats.lastActiveAt = new Date();
      await user.save();
      console.log('[GitHub OAuth] Updated existing user:', user._id);
    } else {
      // Create new user
      user = await User.create({
        githubId:          String(ghUser.id),
        githubUsername:    ghUser.login,
        githubAvatar:      ghUser.avatar_url || '',
        githubAccessToken: accessToken,
        firstName,
        lastName,
        ...(email ? { email } : {}),
      });
      console.log('[GitHub OAuth] Created new user:', user._id);
    }

    // 5. Generate JWT and redirect to frontend
    const jwt = generateToken(user._id);
    console.log('[GitHub OAuth] Success! Redirecting to frontend...');

    res.redirect(`${frontendUrl}?token=${jwt}`);

  } catch (error) {
    console.error('[GitHub OAuth] Callback error:', error);
    res.redirect(`${frontendUrl}?error=server_error&details=${encodeURIComponent(error.message)}`);
  }
};

// ─── GET /api/auth/profile — Get current user ───
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: user.toPublicJSON()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/auth/logout — Invalidate (client-side only for JWT) ───
exports.logout = (req, res) => {
  res.status(200).json({ success: true, message: 'Logged out' });
};

// ─── GET /api/auth/google — Redirect to Google OAuth ───
exports.googleAuth = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

  if (!clientId) {
    return res.status(500).json({
      success: false,
      message: 'GOOGLE_CLIENT_ID not configured. Check your .env.development file.',
    });
  }

  const callbackUrl = `${backendUrl}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  callbackUrl,
    response_type: 'code',
    scope:         'email profile',
    access_type:   'offline',
    prompt:        'consent',
  });

  console.log('[Google OAuth] Redirecting to Google with callback:', callbackUrl);
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};

// ─── GET /api/auth/google/callback — Handle Google OAuth callback ───
exports.googleCallback = async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!code) {
    console.error('[Google OAuth] No code received');
    return res.redirect(`${frontendUrl}?error=no_code`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const callbackUrl = `${backendUrl}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured');
    }

    // 1. Exchange code for tokens
    console.log('[Google OAuth] Exchanging code for token...');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  callbackUrl,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('[Google OAuth] Token error:', tokenData);
      return res.redirect(`${frontendUrl}?error=token_failed&details=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const accessToken = tokenData.access_token;
    console.log('[Google OAuth] Got access token, fetching user profile...');

    // 2. Get Google user profile
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const goUser = await userRes.json();

    if (!goUser.id) {
      console.error('[Google OAuth] Failed to get user profile:', goUser);
      throw new Error('Failed to get Google user profile');
    }

    const email = normalizeEmail(goUser.email);
    console.log('[Google OAuth] User:', goUser.name, '| Email:', email);

    // 3. Create or update user in MongoDB
    // Try to find by Google ID first, then fallback to Email (account merging)
    let user = await User.findOne({ googleId: String(goUser.id) });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (user) {
      // Update token and profile info
      user.googleId          = String(goUser.id);
      
      // Don't overwrite names if user already set them via local auth
      if (!user.firstName) user.firstName = goUser.given_name || '';
      if (!user.lastName) user.lastName = goUser.family_name || '';
      if (email && !user.email) user.email = email;
      
      user.stats.lastActiveAt = new Date();
      await user.save();
      console.log('[Google OAuth] Updated existing user:', user._id);
    } else {
      // Create new user
      user = await User.create({
        googleId:  String(goUser.id),
        firstName: goUser.given_name || '',
        lastName:  goUser.family_name || '',
        ...(email ? { email } : {}),
      });
      console.log('[Google OAuth] Created new user:', user._id);
    }

    // 4. Generate JWT and redirect to frontend
    const jwt = generateToken(user._id);
    console.log('[Google OAuth] Success! Redirecting to frontend...');

    res.redirect(`${frontendUrl}?token=${jwt}`);

  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    res.redirect(`${frontendUrl}?error=server_error&details=${encodeURIComponent(error.message)}`);
  }
};
