import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const firestore = new Firestore();
const storage = new Storage();
const collectionName = 'posts';
const bucketName = process.env.BUCKET_NAME || '';

function extractFilenameFromUrl(url: string) {
  const prefix = `https://storage.googleapis.com/${bucketName}/`;
  if (url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }
  return null;
}

async function deleteImage(imageUrl: string) {
  const filename = extractFilenameFromUrl(imageUrl);
  if (filename) {
    try {
      await storage.bucket(bucketName).file(filename).delete();
    } catch (error) {
      console.error(`Failed to delete GCS image: ${filename}`, error);
    }
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !session.admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const postRef = firestore.collection(collectionName).doc(id);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const data = postSnap.data();
    if (data?.imageUrl) {
      await deleteImage(data.imageUrl);
    }

    await postRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !session.admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const postRef = firestore.collection(collectionName).doc(id);
    const postSnap = await postRef.get();

    if (!postSnap.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const { text, imageUrl } = await req.json();
    const oldData = postSnap.data();

    // XSS mitigation for text update
    const escapedText = text
      ? text.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;')
          .replace(/\n/g, '<br />')
      : '';

    const updateData: any = {};
    if (text !== undefined) updateData.text = escapedText;
    
    // If imageUrl is explicitly provided and different from old one, update it.
    // If a new image was uploaded, frontend will send the new URL.
    if (imageUrl !== undefined && imageUrl !== oldData?.imageUrl) {
      updateData.imageUrl = imageUrl;
      // Delete old image if it exists
      if (oldData?.imageUrl) {
        await deleteImage(oldData.imageUrl);
      }
    }

    await postRef.update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating post:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
