'use client';

import { useSettingsStore, useAuthStore, useNavStore } from '@/lib/store/app';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

export default function SettingsView() {
  const { settings, updateSettings } = useSettingsStore();
  const user = useAuthStore((s) => s.user);
  const [saved, setSaved] = useState(false);
  const supabaseReady = isSupabaseConfigured();

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const handleSignOut = async () => {
    if (supabaseReady) await supabase.auth.signOut();
    useAuthStore.getState().logout();
    useNavStore.getState().navigate('login');
  };

  return (
    <div className="p-4 lg:p-6 h-full overflow-y-auto">
      <div className="max-w-xl mx-auto space-y-5">
        <h2 className="text-base font-semibold text-foreground">Settings</h2>

        {/* Connection Status */}
        <div className="surface p-4 space-y-2.5">
          <h3 className="text-xs font-medium text-foreground">System Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {supabaseReady ? <CheckCircle className="w-3.5 h-3.5 text-[#4a9e5a]" /> : <XCircle className="w-3.5 h-3.5 text-[#c8a24e]" />}
                <span className="text-foreground">Supabase Database</span>
              </div>
              <span className="text-muted-foreground">{supabaseReady ? 'Connected' : 'Not configured'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {supabaseReady ? <CheckCircle className="w-3.5 h-3.5 text-[#4a9e5a]" /> : <XCircle className="w-3.5 h-3.5 text-[#c8a24e]" />}
                <span className="text-foreground">Google OAuth</span>
              </div>
              <span className="text-muted-foreground">{supabaseReady ? 'Available' : 'Requires Supabase'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#4a9e5a]" />
                <span className="text-foreground">AI Assessment (OpenAI GPT-4o)</span>
              </div>
              <span className="text-muted-foreground">Server-side proxy</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#4a9e5a]" />
                <span className="text-foreground">Web Search (Serper.dev)</span>
              </div>
              <span className="text-muted-foreground">Server-side proxy</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#4a9e5a]" />
                <span className="text-foreground">Phone Validation (NumVerify)</span>
              </div>
              <span className="text-muted-foreground">Server-side proxy</span>
            </div>
          </div>
          {!supabaseReady && (
            <div className="bg-[#c8a24e]/5 border border-[#c8a24e]/15 rounded p-2.5 text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-[#c8a24e]">To connect:</strong> Set <code className="bg-accent px-1 rounded text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-accent px-1 rounded text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your <code className="bg-accent px-1 rounded text-foreground">.env</code> file. Then run the schema from <code className="bg-accent px-1 rounded text-foreground">supabase-schema.sql</code> in the Supabase SQL Editor.
            </div>
          )}
        </div>

        {/* Provider Info */}
        <div className="surface p-4 space-y-3">
          <h3 className="text-xs font-medium text-foreground">Intelligence Providers</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">All API keys are configured server-side and never exposed to the browser. Each provider is proxied through secure API routes.</p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-border">
              <div>
                <span className="text-foreground">OpenAI GPT-4o</span>
                <span className="text-muted-foreground ml-2 mono-label">AI Analysis</span>
              </div>
              <span className="mono-label">/api/ai</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border">
              <div>
                <span className="text-foreground">Serper.dev</span>
                <span className="text-muted-foreground ml-2 mono-label">Web Search / OSINT</span>
              </div>
              <span className="mono-label">/api/serper</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-foreground">NumVerify</span>
                <span className="text-muted-foreground ml-2 mono-label">Phone Validation</span>
              </div>
              <span className="mono-label">/api/numverify</span>
            </div>
          </div>
        </div>

        {/* Investigation Preferences */}
        <div className="surface p-4 space-y-3">
          <h3 className="text-xs font-medium text-foreground">Investigation Preferences</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-foreground">Batch max size</div>
              <div className="text-[10px] text-muted-foreground">Items per batch upload</div>
            </div>
            <Input
              type="number" value={settings.batchMaxSize}
              onChange={(e) => updateSettings({ batchMaxSize: parseInt(e.target.value) || 10 })}
              className="w-16 bg-accent border-border text-foreground h-7 text-xs text-right"
              min={1} max={100}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-foreground">Historical locations</div>
              <div className="text-[10px] text-muted-foreground">Max per investigation</div>
            </div>
            <Input
              type="number" value={settings.historicalLocationCount}
              onChange={(e) => updateSettings({ historicalLocationCount: parseInt(e.target.value) || 5 })}
              className="w-16 bg-accent border-border text-foreground h-7 text-xs text-right"
              min={1} max={20}
            />
          </div>
        </div>

        {/* Account */}
        <div className="surface p-4 space-y-3">
          <h3 className="text-xs font-medium text-foreground">Account</h3>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground font-mono">{user?.email || '—'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Role</span>
            <span className="mono-label">{user?.role || 'standard'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Session</span>
            <span className="text-foreground">Authenticated</span>
          </div>
        </div>

        {/* Danger */}
        <div className="surface p-4 space-y-2.5 border-[#c44040]/20">
          <h3 className="text-xs font-medium text-[#c44040]">Danger Zone</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="border-[#c44040]/30 text-[#c44040] hover:bg-[#c44040]/10 text-xs h-7"
          >
            Sign Out
          </Button>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} className="bg-[#c8a24e] hover:bg-[#c8a24e]/85 text-background font-medium text-xs h-8">
            <Save className="w-3 h-3 mr-1" /> {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
