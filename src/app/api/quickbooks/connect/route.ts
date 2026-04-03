import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// QuickBooks OAuth 2.0 — Step 1: Redirect user to Intuit authorization
// Docs: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';

export async function GET(req: NextRequest) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'QuickBooks integration not configured' },
      { status: 500 }
    );
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in a cookie so we can verify it on callback
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `${QB_AUTH_URL}?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);

  // Set state cookie (httpOnly, secure, short-lived)
  response.cookies.set('qb_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300, // 5 minutes — plenty for the OAuth round-trip
    path: '/',
  });

  return response;
}
