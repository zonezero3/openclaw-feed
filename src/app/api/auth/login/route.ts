import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/session';
import { getAdminPasswordHash, verifyPassword } from '@/lib/password';

const failedAttempts = new Map<string, { count: number; lastTime: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, lastTime: 0 };
  
  if (record.count >= 5 && now - record.lastTime < 60000) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const { password } = await req.json();
    const storedHash = await getAdminPasswordHash();
    let isValid = false;

    if (storedHash) {
      isValid = await verifyPassword(password, storedHash);
    } else {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (adminPassword && password === adminPassword) {
        isValid = true;
      }
    }

    if (!isValid) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      failedAttempts.set(ip, { count: record.count + 1, lastTime: now });
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    failedAttempts.delete(ip);
    
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const sessionToken = await encrypt({ admin: true, expires });

    (await cookies()).set('admin_session', sessionToken, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
