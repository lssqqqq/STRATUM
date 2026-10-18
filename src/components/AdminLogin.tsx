import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { supabase, isAdminUid } from '../lib/supabase';

interface AdminLoginProps {
  onClose: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (signInError) {
      setError(signInError.message);
      setBusy(false);
      return;
    }
    if (!isAdminUid(data.user?.id)) {
      await supabase.auth.signOut();
      setError('This account is not an admin.');
      setBusy(false);
      return;
    }
    setBusy(false);
    // App сам закроет окно, когда увидит сессию админа
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl p-6 text-neutral-100">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">Admin login</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-white rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          {error && <p className="text-xs font-mono text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full px-5 py-2.5 text-sm font-mono rounded-lg bg-white text-black hover:bg-neutral-200 font-bold disabled:opacity-60"
          >
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
