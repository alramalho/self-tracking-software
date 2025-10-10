import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

const router: Router = createRouter();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_IOS_CLIENT_ID
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Exchange iOS Google idToken for Supabase session
 * POST /auth/ios-google-signin
 * Body: { idToken: string }
 */
router.post('/ios-google-signin', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    // Verify the iOS token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_IOS_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    // Check if user exists in Supabase by listing users with this email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users.users?.find((u) => u.email === payload.email);

    let userId: string;

    if (existingUser) {
      // User exists, use their ID
      userId = existingUser.id;
    } else {
      // Create new user in Supabase
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: payload.email,
        email_confirm: true,
        user_metadata: {
          full_name: payload.name,
          avatar_url: payload.picture,
          provider: 'google',
        },
      });

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      userId = newUser.user.id;
    }

    // Create a session token for this user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: payload.email,
    });

    if (sessionError || !sessionData) {
      console.error('Error generating session:', sessionError);
      return res.status(500).json({ error: 'Failed to generate session' });
    }

    // Return the verification token that the client can use
    return res.json({
      user: {
        id: userId,
        email: payload.email,
        user_metadata: {
          full_name: payload.name,
          avatar_url: payload.picture,
        },
      },
      // Client should use this verification URL to sign in
      verificationUrl: sessionData.properties.action_link,
    });
  } catch (error) {
    console.error('iOS Google sign-in error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
