import { useState } from 'react';
import { User, Lock, Save, Key, ShieldCheck, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function Profile() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  
  // Edit Profile Form
  const [fullName, setFullName] = useState(user.name || user.full_name || 'System Administrator');
  const [profileSuccess, setProfileSuccess] = useState('');
  
  // Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const updatedUser = { ...user, name: fullName, full_name: fullName };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      alert('Failed to update profile.');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) return setPasswordError('Please enter your current password.');
    if (!newPassword) return setPasswordError('Please enter a new password.');
    if (newPassword.length < 4) return setPasswordError('Password must be at least 4 characters long.');
    if (newPassword !== confirmPassword) return setPasswordError('New password and confirm password do not match.');

    try {
      if (user.user_id) {
        await axios.put(`${API}/admin/users/${user.user_id}/reset-password`, { password: newPassword }, getAuthHeader());
      }
      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Password update failed. Check current password.');
    }
  };

  const firstLetter = (fullName || 'S').charAt(0).toUpperCase();

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6 max-w-5xl mx-auto">
      
      {/* 1. USER PROFILE BANNER */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-[#10b981] flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-emerald-500/20 border-2 border-[#121212]">
          {firstLetter}
        </div>
        <div className="space-y-1.5 text-center md:text-left">
          <h1 className="text-2xl font-black text-white">{fullName}</h1>
          <p className="text-xs text-slate-400 font-mono font-medium">{user.email || user.username || 'admin@jayashree.com'}</p>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> {user.role || 'System Administrator'}
            </span>
            <span className="px-3 py-1 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
              Admin
            </span>
          </div>
        </div>
      </div>

      {/* 2. EDIT PROFILE SECTION */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="border-b border-[#2a2a2a] pb-3 flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Edit Profile</h2>
        </div>

        {profileSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold p-3.5 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {profileSuccess}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-bold block mb-1.5">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-[#121212] border border-[#3a3a3a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              placeholder="Enter full name..."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md"
            >
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </form>
      </div>

      {/* 3. CHANGE PASSWORD SECTION */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="border-b border-[#2a2a2a] pb-3 flex items-center gap-2">
          <Key className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Change Password</h2>
        </div>

        {passwordSuccess && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold p-3.5 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {passwordSuccess}
          </div>
        )}

        {passwordError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-extrabold p-3.5 rounded-xl flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400" /> {passwordError}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-bold block mb-1.5">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-[#121212] border border-[#3a3a3a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-bold block mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#121212] border border-[#3a3a3a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-bold block mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#121212] border border-[#3a3a3a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              placeholder="Confirm new password"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md"
            >
              <Key className="w-4 h-4" /> Update Password
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
