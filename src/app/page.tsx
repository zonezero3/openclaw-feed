'use client';

import { useState, useEffect } from 'react';

type Post = {
  id: string;
  text: string;
  imageUrl: string | null;
  location?: {
    lat: number;
    lng: number;
  } | null;
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
  
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeMsg, setPasswordChangeMsg] = useState({ type: '', text: '' });

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);

  const [includeLocation, setIncludeLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  // App Config state
  const [appTitle, setAppTitle] = useState('My Thoughts');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleText, setEditTitleText] = useState('');
  
  useEffect(() => {
    fetchPosts();
    checkAdmin();
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setAppTitle(data.title);
        setEditTitleText(data.title);
      }
    } catch (err) {}
  };

  const handleTitleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitleText.trim()) return;
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitleText }),
      });
      if (res.ok) {
        setAppTitle(editTitleText);
        setIsEditingTitle(false);
      }
    } catch (err) {
      alert('Failed to update title');
    }
  };

  const getLocalYYYYMMDD = (isoString: string) => {
    const d = new Date(isoString);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleJumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value;
    if (!dateStr) return;
    const target = document.querySelector(`[data-date="${dateStr}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      alert('해당 날짜에 작성된 포스트가 없습니다.');
    }
  };

  const handleLocationToggle = () => {
    if (!includeLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setIncludeLocation(true);
          },
          (error) => {
            console.error("Error getting location", error);
            alert("Could not get location. Please allow location access.");
            setIncludeLocation(false);
          }
        );
      } else {
        alert("Geolocation is not supported by this browser.");
      }
    } else {
      setIncludeLocation(false);
      setCurrentLocation(null);
    }
  };

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
      setShowPasswordChange(false);
    } catch (err) {}
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPasswordChangeMsg({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => setShowPasswordChange(false), 2000);
      } else {
        const data = await res.json();
        setPasswordChangeMsg({ type: 'error', text: data.error || 'Failed to update password' });
      }
    } catch (err) {
      setPasswordChangeMsg({ type: 'error', text: 'Server error' });
    }
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
    if (!text && !file && !includeLocation) {
      setError('Please provide text, an image, or a location.');
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
        body: JSON.stringify({ 
          text, 
          imageUrl,
          location: includeLocation ? currentLocation : null
        }),
      });

      if (!postRes.ok) {
        throw new Error('Failed to create post.');
      }

      setText('');
      setFile(null);
      setIncludeLocation(false);
      setCurrentLocation(null);
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
        {isAdmin && isEditingTitle ? (
          <form onSubmit={handleTitleUpdate} className="flex space-x-2 w-full max-w-sm">
            <input
              type="text"
              value={editTitleText}
              onChange={(e) => setEditTitleText(e.target.value)}
              className="flex-1 border rounded-md p-2 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded text-sm">Save</button>
            <button type="button" onClick={() => { setIsEditingTitle(false); setEditTitleText(appTitle); }} className="bg-gray-300 px-3 py-1 rounded text-sm">Cancel</button>
          </form>
        ) : (
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold text-black">{appTitle}</h1>
            {isAdmin && (
              <button onClick={() => setIsEditingTitle(true)} className="text-xs text-gray-400 hover:text-blue-500">Edit Title</button>
            )}
          </div>
        )}
        {isAdmin ? (
          <div className="space-x-3">
            <button onClick={() => setShowPasswordChange(!showPasswordChange)} className="text-sm text-gray-500 hover:text-black">Change Password</button>
            <button onClick={handleAdminLogout} className="text-sm text-gray-500 hover:text-black">Logout</button>
          </div>
        ) : (
          <button onClick={() => setShowAdminLogin(!showAdminLogin)} className="text-sm text-gray-500 hover:text-black">Admin</button>
        )}
      </div>

      {showPasswordChange && isAdmin && (
        <form onSubmit={handlePasswordChange} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col space-y-3">
          <h3 className="text-sm font-semibold">Change Admin Password</h3>
          <div className="flex space-x-2">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current Password"
              className="flex-1 border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              className="flex-1 border rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm">Update</button>
          </div>
          {passwordChangeMsg.text && (
            <div className={`text-sm ${passwordChangeMsg.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
              {passwordChangeMsg.text}
            </div>
          )}
        </form>
      )}

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

          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 cursor-pointer w-max">
              <input 
                type="checkbox" 
                checked={includeLocation}
                onChange={handleLocationToggle}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Include my current location</span>
            </label>
            {includeLocation && currentLocation && (
              <div className="mt-2 text-xs text-green-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Location attached
              </div>
            )}
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

      {posts.length > 0 && (
        <div className="flex justify-end mb-4">
          <div className="relative flex items-center bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
            <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input 
              type="date" 
              onChange={handleJumpToDate}
              className="bg-transparent text-sm font-medium text-gray-700 outline-none cursor-pointer"
              title="Jump to date"
            />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {posts.map((post) => (
          <div 
            key={post.id} 
            data-date={getLocalYYYYMMDD(post.createdAt)}
            className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 space-y-4 scroll-mt-24"
          >
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
                  <p
                    className="text-gray-800 break-words leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: post.text }}
                  />
                )}
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="Uploaded" className="max-w-full rounded-md object-cover max-h-96" />
                )}
                {post.location && (
                  <div className="mt-2">
                    <img 
                      src={`https://maps.googleapis.com/maps/api/staticmap?center=${post.location.lat},${post.location.lng}&zoom=14&size=400x200&markers=color:red%7C${post.location.lat},${post.location.lng}&key=AIzaSyDci1DPwVUHO78bNhLPVuJehyEi9Ri05gU`} 
                      alt="Location Map" 
                      className="w-full rounded-md object-cover border border-gray-200"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
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
    </div>
  );
}
