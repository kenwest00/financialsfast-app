import { NextRequest, NextResponse } from 'next/server';

// QuickBooks OAuth 2.0 — Step 2: Handle callback, exchange code for tokens
// Docs: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const realmId = searchParams.get('realmId'); // QuickBooks company ID
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.financialsfast.com';

  // User denied access
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/upload?qb_error=${encodeURIComponent('QuickBooks connection was declined')}`
    );
  }

  if (!code || !state || !realmId) {
    return NextResponse.redirect(
      `${baseUrl}/upload?qb_error=${encodeURIComponent('Missing authorization parameters')}`
    );
  }

  // Verify CSRF state
  const storedState = req.cookies.get('qb_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${baseUrl}/upload?qb_error=${encodeURIComponent('Security validation failed. Please try again.')}`
    );
  }

  // Exchange authorization code for tokens
  const clientId = process.env.QUICKBOOKS_CLIENT_ID!;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!;
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI!;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const tokenResponse = await fetch(QB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('QuickBooks token exchange failed:', errorData);
      return NextResponse.redirect(
        `${baseUrl}/upload?qb_error=${encodeURIComponent('Failed to connect to QuickBooks. Please try again.')}`
      );
    }

    const tokens = await tokenResponse.json();
    // tokens contains: access_token, refresh_token, token_type, expires_in, x_refresh_token_expires_in

    // Redirect to upload page with success
    const response = NextResponse.redirect(`${baseUrl}/upload?qb_connected=true`);

    // Store tokens in httpOnly cookies (not accessible to client JS)
    response.cookies.set('qb_access_token', tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 3600, // 1 hour — matches QuickBooks token lifetime
      path: '/',
    });

    response.cookies.set('qb_realm_id', realmId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 3600,
      path: '/',
    });

    // Clear the CSRF state cookie
    response.cookies.delete('qb_oauth_state');

    return response;
  } catch (err) {
    console.error('QuickBooks callback error:', err);
    return NextResponse.redirect(
      `${baseUrl}/upload?qb_error=${encodeURIComponent('Connection error. Please try again.')}`
    );
  }
}
