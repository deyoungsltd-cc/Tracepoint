'use client';

import { useState } from 'react';
import { useAuthStore, useNavStore } from '@/lib/store/app';
import { Radar, Mail, Lock, User, Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function AuthView() {
  const { login, register, setDemoMode, isLoading } = useAuthStore();
  const { navigate } = useNavStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(email, password);
    } else {
      await register(email, password, name);
    }
    navigate('dashboard');
  };

  const handleDemo = () => {
    setDemoMode();
    navigate('dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 tp-grid-overlay">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-tp-amber/10 border border-tp-amber/30 mb-4">
            <Radar className="w-8 h-8 text-tp-amber" />
          </div>
          <h1 className="text-2xl font-bold text-tp-text tracking-wider uppercase">Tracepoint</h1>
          <p className="text-xs text-tp-text-dim tracking-widest uppercase mt-1">
            Global Identity Intelligence Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="tp-panel rounded-lg p-6">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-tp-surface rounded p-0.5 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors uppercase tracking-wider ${
                mode === 'login'
                  ? 'bg-tp-amber/15 text-tp-amber'
                  : 'text-tp-text-dim hover:text-tp-text'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors uppercase tracking-wider ${
                mode === 'register'
                  ? 'bg-tp-amber/15 text-tp-amber'
                  : 'text-tp-text-dim hover:text-tp-text'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label className="tp-hud text-[10px]">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tp-text-dim" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Analyst Name"
                    className="pl-8 bg-tp-surface border-tp-border text-tp-text placeholder:text-tp-text-dim/50 h-9 text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="tp-hud text-[10px]">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tp-text-dim" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@tracepoint.io"
                  className="pl-8 bg-tp-surface border-tp-border text-tp-text placeholder:text-tp-text-dim/50 h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="tp-hud text-[10px]">Password</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tp-text-dim" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="pl-8 pr-8 bg-tp-surface border-tp-border text-tp-text placeholder:text-tp-text-dim/50 h-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tp-text-dim hover:text-tp-text"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-tp-text-dim">
                  <input type="checkbox" className="rounded border-tp-border bg-tp-surface" />
                  Remember session
                </label>
                <button type="button" className="text-xs text-tp-amber hover:underline">
                  Reset password
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-9 bg-tp-amber hover:bg-tp-amber/90 text-background font-semibold uppercase tracking-wider text-xs"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          {mode === 'register' && (
            <p className="mt-4 text-[10px] text-tp-text-dim text-center">
              By registering, you agree to the Terms of Service and Privacy Policy.
            </p>
          )}
        </div>

        {/* Demo access */}
        <Separator className="my-6 bg-tp-border" />

        <div className="text-center space-y-3">
          <button
            onClick={handleDemo}
            className="w-full py-2.5 rounded border border-dashed border-tp-amber/30 text-tp-amber hover:bg-tp-amber/5 text-xs font-medium uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
          >
            <Shield className="w-3.5 h-3.5" />
            Enter Demo Mode
          </button>
          <p className="text-[10px] text-tp-text-dim">
            Demo mode uses sample data marked with DEMO DATA — NOT REAL
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-tp-text-dim tracking-wider uppercase">
            Evidence-First Intelligence — Never Fabricate, Always Attribute
          </p>
        </div>
      </div>
    </div>
  );
}
