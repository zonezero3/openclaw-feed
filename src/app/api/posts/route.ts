import { Firestore } from '@google-cloud/firestore';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const firestore = new Firestore();
const collectionName = 'posts';

export async function GET() {
  try {
    const snapshot = await firestore.collection(collectionName).orderBy('createdAt', 'desc').get();
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(posts);
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { text, imageUrl } = await req.json();

    // XSS 방어를 위한 텍스트 이스케이핑 및 줄바꿈 처리
    const escapedText = text
      ? text.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br />')
      : '';

    const postRef = firestore.collection(collectionName).doc();
    const newPost = {
      text: escapedText,
      imageUrl: imageUrl || null,
      createdAt: new Date().toISOString(),
    };
    await postRef.set(newPost);

    return NextResponse.json({ id: postRef.id, ...newPost });
  } catch (error: any) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
