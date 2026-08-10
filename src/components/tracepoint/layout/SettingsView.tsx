'use client';

import { useSettingsStore, useAuthStore, useNavStore } from '@/lib/store/app';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save, Key, Globe, Bot, Trash2, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
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
          <h3 className="text-xs font-medium text-foreground">Connection Status</h3>
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
                <span className="text-foreground">Google Auth</span>
              </div>
              <span className="text-muted-foreground">{supabaseReady ? 'Available' : 'Requires Supabase'}</span>
            </div>
          </div>
          {!supabaseReady && (
            <div className="bg-[#c8a24e]/5 border border-[#c8a24e]/15 rounded p-2.5 text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-[#c8a24e]">To connect:</strong> Set <code className="bg-accent px-1 rounded text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-accent px-1 rounded text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your <code className="bg-accent px-1 rounded text-foreground">.env</code> file. Then run the schema from <code className="bg-accent px-1 rounded text-foreground">supabase-schema.sql</code> in the Supabase SQL Editor.
            </div>
          )}
        </div>

        {/* API Keys */}
        <div className="surface p-4 space-y-3.5">
          <h3 className="text-xs font-medium text-foreground">API Keys</h3>
          <p className="text-[11px] text-muted-foreground">Keys are stored in your browser only. They never leave your machine.</p>

          <div className="space-y-3">
            {/* OpenAI */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-foreground">OpenAI</label>
                {settings.aiApiKey ? <CheckCircle className="w-3 h-3 text-[#4a9e5a]" /> : null}
              </div>
              <Input
                type="password"
                value={settings.aiApiKey}
                onChange={(e) => updateSettings({ aiApiKey: e.target.value })}
                placeholder="sk-..."
                className="bg-accent border-border text-foreground placeholder:text-muted-foreground/40 h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Powers AI assessments. Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-[#c8a24e] hover:underline">platform.openai.com/api-keys</a></p>
            </div>

            {/* Serper.dev */}
            <div className="space-y-1">
              <label className="text-xs text-foreground">Serper.dev (Web Search)</label>
              <Input
                type="password"
                value={settings.serperApiKey || ''}
                onChange={(e) => updateSettings({ serperApiKey: e.target.value })}
                placeholder="API key"
                className="bg-accent border-border text-foreground placeholder:text-muted-foreground/40 h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Public source discovery. Free tier: 2,500 searches/month. <a href="https://serper.dev" target="_blank" rel="noopener" className="text-[#c8a24e] hover:underline">serper.dev</a></p>
            </div>

            {/* NumVerify */}
            <div className="space-y-1">
              <label className="text-xs text-foreground">NumVerify (Phone Validation)</label>
              <Input
                type="password"
                value={settings.numverifyApiKey || ''}
                onChange={(e) => updateSettings({ numverifyApiKey: e.target.value })}
                placeholder="API key"
                className="bg-accent border-border text-foreground placeholder:text-muted-foreground/40 h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Phone validation + carrier lookup. Free: 100/month. <a href="https://numverify.com" target="_blank" rel="noopener" className="text-[#c8a24e] hover:underline">numverify.com</a></p>
            </div>

            {/* Mapbox */}
            <div className="space-y-1">
              <label className="text-xs text-foreground">Mapbox (2D Maps)</label>
              <Input
                type="password"
                value={settings.mapboxToken}
                onChange={(e) => updateSettings({ mapboxToken: e.target.value })}
                placeholder="pk.eyJ1..."
                className="bg-accent border-border text-foreground placeholder:text-muted-foreground/40 h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">2D map rendering. Free: 100K loads/month. <a href="https://account.mapbox.com/access-tokens" target="_blank" rel="noopener" className="text-[#c8a24e] hover:underline">account.mapbox.com</a></p>
            </div>
          </div>
        </div>

        {/* Investigation */}
        <div className="surface p-4 space-y-3">
          <h3 className="text-xs font-medium text-foreground">Investigation</h3>
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
