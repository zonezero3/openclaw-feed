import { Storage } from '@google-cloud/storage';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const storage = new Storage();
const bucketName = process.env.BUCKET_NAME || '';

export async function POST(req: Request) {
  try {
    const { filename, contentType } = await req.json();

    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only images are allowed' }, { status: 400 });
    }

    const ext = filename.split('.').pop();
    const uniqueFilename = `${crypto.randomUUID()}.${ext}`;

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(uniqueFilename);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${uniqueFilename}`;

    return NextResponse.json({ url, publicUrl });
  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
