import { NextResponse } from 'next/server';

// Users database (in production, use a proper database)
const USERS = {
  'perrine@smart-value.fr': { password: 'Smart2026@', name: 'Perrine' },
  'jeremy@smart-value.fr': { password: 'Smart2026@', name: 'Jeremy' },
};

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = USERS[normalizedEmail];

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 });
    }

    // Create response with auth cookie
    const response = NextResponse.json({ success: true, name: user.name });

    // Set cookie - expires in 30 days
    response.cookies.set('smartvalue_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    response.cookies.set('smartvalue_user', user.name, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
