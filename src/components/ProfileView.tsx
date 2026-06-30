import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader as Loader2, LogOut, ArrowLeft, User } from 'lucide-react';
import { AppUser } from '../lib/authUser';

export function ProfileView({ user, onBack }: { user: AppUser; onBack: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const meta = data.user?.user_metadata as { displayName?: string } | undefined;
        setDisplayName(meta?.displayName || user.displayName || '');
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { displayName },
      });
      if (error) throw error;
      alert('Profile updated successfully');
    } catch (err) {
      console.error(err);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-4 mb-12">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-serif italic text-white">Your Profile</h1>
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 shadow-xl">
        <div className="flex items-center gap-6 mb-8 pb-8 border-b border-white/10">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center border border-white/20">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-white/40" />
            )}
          </div>
          <div>
            <h2 className="text-xl text-white font-medium mb-1">{user.email}</h2>
            <p className="text-[10px] uppercase tracking-widest text-[#D4AF37]">Active Member</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 ml-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#D4AF37] transition-colors"
              placeholder="How should we call you?"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#D4AF37] hover:bg-[#c4a133] text-black py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
