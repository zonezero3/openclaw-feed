import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { hashPassword, getAdminPasswordHash, verifyPassword, setAdminPasswordHash } from '@/lib/password';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    const storedHash = await getAdminPasswordHash();
    let isCurrentValid = false;

    if (storedHash) {
      isCurrentValid = await verifyPassword(currentPassword, storedHash);
    } else {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (adminPassword && currentPassword === adminPassword) {
        isCurrentValid = true;
      }
    }

    if (!isCurrentValid) {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 403 });
    }

    const newHash = await hashPassword(newPassword);
    await setAdminPasswordHash(newHash);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
