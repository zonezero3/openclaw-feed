'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

function formatText(htmlText: string) {
  if (!htmlText) return '';
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  return htmlText.replace(urlRegex, (url) => {
    if (url.includes('google.com/maps') || url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="not-prose my-3 flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded-lg h-32 hover:bg-blue-100 transition-colors group relative overflow-hidden" style="text-decoration: none;">
        <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(#64748b 1px, transparent 1px); background-size: 10px 10px;"></div>
        <div class="z-10 flex flex-col items-center text-blue-600 group-hover:scale-105 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-1"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span class="font-semibold text-sm">View on Google Maps</span>
        </div>
      </a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline break-all">${url}</a>`;
  });
}

type Post = {
  id: string;
  text: string;
  imageUrl: string | null;
  createdAt: string;
};

export default function Home() {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.authenticated);
      }
    } catch (err) {}
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        setIsAdmin(true);
        setShowAdminLogin(false);
        setAdminPassword('');
      } else {
        const data = await res.json();
        setAdminError(data.error || 'Login failed');
      }
    } catch (err) {
      setAdminError('Login failed');
    }
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsAdmin(false);
    } catch (err) {}
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  };

  const uploadImage = async (uploadFile: File) => {
    if (!uploadFile.type.startsWith('image/')) {
      throw new Error('Only images are allowed.');
    }
    if (uploadFile.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB.');
    }

    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: uploadFile.name, contentType: uploadFile.type }),
    });

    if (!uploadRes.ok) {
      throw new Error('Failed to get signed URL.');
    }

    const { url, publicUrl } = await uploadRes.json();
    
    const gcsRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': uploadFile.type },
      body: uploadFile,
    });

    if (!gcsRes.ok) {
      throw new Error('Failed to upload image to GCS.');
    }

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text && !file) {
      setError('Please provide text or an image.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      let imageUrl = null;
      if (file) {
        imageUrl = await uploadImage(file);
      }

      const postRes = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageUrl }),
      });

      if (!postRes.ok) {
        throw new Error('Failed to create post.');
      }

      setText('');
      setFile(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      fetchPosts();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPosts();
      } else {
        alert('Failed to delete');
      }
    } catch (err) {
      alert('Error deleting post');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    
    setLoading(true);
    try {
      let imageUrl = editingPost.imageUrl;
      if (editFile) {
        imageUrl = await uploadImage(editFile);
      }

      // To un-escape for editing, one would ideally handle it on backend, 
      // but for simple text, let's just pass it.
      const res = await fetch(`/api/posts/${editingPost.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText, imageUrl }),
      });

      if (res.ok) {
        setEditingPost(null);
        setEditFile(null);
        fetchPosts();
      } else {
        alert('Failed to update post');
      }
    } catch (err) {
      alert('Error updating post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-8 min-h-screen bg-gray-50 text-gray-900 pb-20">
      <div className="flex justify-between items-center mt-8">
        <h1 className="text-3xl font-bold text-black">My Thoughts</h1>
        {isAdmin ? (
          <button onClick={handleAdminLogout} className="text-sm text-gray-500 hover:text-black">Logout</button>
        ) : (
          <button onClick={() => setShowAdminLogin(!showAdminLogin)} className="text-sm text-gray-500 hover:text-black">Admin</button>
        )}
      </div>

      {showAdminLogin && !isAdmin && (
        <form onSubmit={handleAdminLogin} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex space-x-2">
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Admin Password"
            className="flex-1 border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm">Login</button>
        </form>
      )}
      {adminError && <div className="text-red-500 text-sm">{adminError}</div>}

      {(isAdmin || posts.length === 0) && (
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          {error && <div className="text-red-500 text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium mb-1">What's on your mind?</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full border rounded-md p-3 text-black focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={4}
              placeholder="Share your thoughts..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Photo (optional)</label>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium rounded-md p-3 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Posting...' : 'Post'}
          </button>
        </form>
      )}

      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 space-y-4">
            {editingPost?.id === post.id ? (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full border rounded-md p-2 focus:outline-none"
                  rows={4}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
                <div className="flex space-x-2">
                  <button type="submit" disabled={loading} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Save</button>
                  <button type="button" onClick={() => setEditingPost(null)} className="bg-gray-300 px-3 py-1 rounded text-sm">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                {post.text && (
                  <div
                    className="text-gray-800 break-words leading-relaxed space-y-2"
                    dangerouslySetInnerHTML={{ __html: formatText(post.text) }}
                  />
                )}
                {post.imageUrl && (
                  <img 
                    src={post.imageUrl} 
                    alt="Uploaded" 
                    className="max-w-full rounded-md object-cover max-h-96 cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => setSelectedImage(post.imageUrl as string)}
                  />
                )}
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-400">
                    {new Date(post.createdAt).toLocaleString()}
                  </div>
                  {isAdmin && (
                    <div className="space-x-3 text-sm">
                      <button 
                        onClick={() => {
                          setEditingPost(post);
                          setEditText(post.text.replace(/<br \/>/g, '\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'"));
                          setEditFile(null);
                        }} 
                        className="text-blue-500 hover:underline"
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDelete(post.id)} className="text-red-500 hover:underline">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
        {posts.length === 0 && (
          <p className="text-center text-gray-500 py-10">No posts yet. Be the first to share a thought!</p>
        )}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X size={24} />
            </button>
            <img
              src={selectedImage}
              alt="Full screen"
              className="max-w-full max-h-full object-contain rounded-md"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
