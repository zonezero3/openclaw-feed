import { Firestore } from '@google-cloud/firestore';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const firestore = new Firestore();
const CONFIG_COLLECTION = process.env.CONFIG_COLLECTION || 'config';
const CONFIG_DOC = 'app';

export async function GET() {
  try {
    const doc = await firestore.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
    const data = doc.data() || {};
    return NextResponse.json({ title: data.title || 'My Thoughts' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !session.admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title } = await req.json();
    await firestore.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).set({ title }, { merge: true });
    return NextResponse.json({ success: true, title });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
