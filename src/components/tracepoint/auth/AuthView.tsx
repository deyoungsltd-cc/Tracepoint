'use client';

import { useState, useEffect } from 'react';
import { useAuthStore, useNavStore } from '@/lib/store/app';
import { Radar, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { getProfile } from '@/lib/supabase/data';

export default function AuthView() {
  const { setDemoMode, isLoading } = useAuthStore();
  const { navigate } = useNavStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Check for existing Supabase session on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) restoreSession(session.user);
    });
    // Listen for auth changes (Google OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) restoreSession(session.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const restoreSession = async (user: any) => {
    const profile = await getProfile();
    useAuthStore.setState({
      user: {
        id: user.id,
        email: user.email || '',
        displayName: profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.display_name || null,
        role: profile?.role || 'standard',
        mfaEnabled: false,
        emailVerified: !!user.email_confirmed_at,
        isDemo: false,
        createdAt: user.created_at,
      },
      isAuthenticated: true,
    });
    navigate('dashboard');
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isSupabaseConfigured()) {
      // Offline/demo mode
      await login(email, password);
      navigate('dashboard');
      return;
    }

    try {
      if (mode === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        if (data.user) {
          await restoreSession(data.user);
          return;
        }
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: email.split('@')[0] } },
        });
        if (authError) throw authError;
        if (data.user) {
          await restoreSession(data.user);
          return;
        }
      }
      navigate('dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  const handleGoogleAuth = async () => {
    if (!isSupabaseConfigured()) {
      setError('Configure Supabase to use Google Auth');
      return;
    }
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || 'Google Auth failed');
    }
  };

  const handleDemo = () => {
    setDemoMode();
    navigate('dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[#c8a24e]/8 border border-[#c8a24e]/15 mb-3">
            <Radar className="w-6 h-6 text-[#c8a24e]" />
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-wide">Tracepoint</h1>
          <p className="text-xs text-muted-foreground mt-1">Evidence-First Intelligence Platform</p>
        </div>

        {/* Auth Card */}
        <div className="surface p-5">
          {/* Mode tabs */}
          <div className="flex gap-0.5 bg-accent rounded p-0.5 mb-5">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'login' ? 'bg-[#c8a24e]/10 text-[#c8a24e]' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'register' ? 'bg-[#c8a24e]/10 text-[#c8a24e]' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Register
            </button>
          </div>

          {/* Google Auth */}
          {isSupabaseConfigured() && (
            <button
              onClick={handleGoogleAuth}
              className="w-full flex items-center justify-center gap-2 py-2 rounded border border-border text-foreground text-sm hover:bg-accent transition-colors mb-4"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
          )}

          {/* Divider */}
          {isSupabaseConfigured() && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div className="space-y-1">
              <label className="mono-label text-[10px]">Email</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@tracepoint.io"
                  className="w-full pl-8 pr-3 py-1.5 bg-accent border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="mono-label text-[10px]">Password</label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-8 pr-8 py-1.5 bg-accent border border-border rounded text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-[#c8a24e] hover:bg-[#c8a24e]/85 text-background font-medium text-sm rounded transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Demo */}
        <div className="mt-4">
          <button
            onClick={handleDemo}
            className="w-full py-2 rounded border border-dashed border-[#c8a24e]/20 text-[#c8a24e] text-xs hover:bg-[#c8a24e]/4 transition-colors"
          >
            Enter Demo Mode
          </button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Demo uses sample data marked DEMO DATA — NOT REAL
          </p>
        </div>
      </div>
    </div>
  );
}