'use client';

import { useSettingsStore, useAuthStore } from '@/lib/store/app';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Save, Key, Globe, Bot, Trash2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export default function SettingsView() {
  const { settings, updateSettings } = useSettingsStore();
  const user = useAuthStore((s) => s.user);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-lg font-semibold text-tp-text">Platform Settings</h2>

        {/* AI Provider */}
        <div className="tp-panel rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-tp-amber" />
            <h3 className="text-sm font-medium text-tp-text">AI Provider</h3>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="tp-hud text-[10px]">Provider</Label>
              <select
                value={settings.aiProvider}
                onChange={(e) => updateSettings({ aiProvider: e.target.value as typeof settings.aiProvider })}
                className="w-full bg-tp-surface border border-tp-border rounded px-3 py-1.5 text-xs text-tp-text h-9"
              >
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="local">Local / Open-source</option>
                <option value="custom">Custom Endpoint</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="tp-hud text-[10px]">API Key</Label>
              <div className="relative">
                <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tp-text-dim" />
                <Input
                  type="password"
                  value={settings.aiApiKey}
                  onChange={(e) => updateSettings({ aiApiKey: e.target.value })}
                  placeholder="sk-... (stored in browser only)"
                  className="pl-8 bg-tp-surface border-tp-border text-tp-text placeholder:text-tp-text-dim/50 h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="tp-hud text-[10px]">Model</Label>
              <Input
                value={settings.aiModel}
                onChange={(e) => updateSettings({ aiModel: e.target.value })}
                placeholder="gpt-4o"
                className="bg-tp-surface border-tp-border text-tp-text placeholder:text-tp-text-dim/50 h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Map Configuration */}
        <div className="tp-panel rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-tp-amber" />
            <h3 className="text-sm font-medium text-tp-text">Map Configuration</h3>
          </div>
          <div className="space-y-1.5">
            <Label className="tp-hud text-[10px]">Mapbox Access Token</Label>
            <Input
              type="password"
              value={settings.mapboxToken}
              onChange={(e) => updateSettings({ mapboxToken: e.target.value })}
              placeholder="pk.eyJ1... (get at mapbox.com)"
              className="bg-tp-surface border-tp-border text-tp-text placeholder:text-tp-text-dim/50 h-9 text-sm"
            />
            <p className="text-[10px] text-tp-text-dim">Required for 2D map view. Falls back to OpenStreetMap if not set.</p>
          </div>
        </div>

        {/* Investigation Settings */}
        <div className="tp-panel rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-medium text-tp-text">Investigation Settings</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-tp-text">Demo Mode</div>
              <div className="text-[10px] text-tp-text-dim">Uses clearly labeled sample data</div>
            </div>
            <Switch
              checked={settings.demoMode}
              onCheckedChange={(v) => updateSettings({ demoMode: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-tp-text">Batch Max Size</div>
              <div className="text-[10px] text-tp-text-dim">Maximum items per batch investigation</div>
            </div>
            <Input
              type="number"
              value={settings.batchMaxSize}
              onChange={(e) => updateSettings({ batchMaxSize: parseInt(e.target.value) || 10 })}
              className="w-20 bg-tp-surface border-tp-border text-tp-text h-8 text-xs text-right"
              min={1}
              max={100}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-tp-text">Historical Locations</div>
              <div className="text-[10px] text-tp-text-dim">Number of historical locations to display</div>
            </div>
            <Input
              type="number"
              value={settings.historicalLocationCount}
              onChange={(e) => updateSettings({ historicalLocationCount: parseInt(e.target.value) || 5 })}
              className="w-20 bg-tp-surface border-tp-border text-tp-text h-8 text-xs text-right"
              min={1}
              max={20}
            />
          </div>
        </div>

        {/* Data Retention */}
        <div className="tp-panel rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-tp-text">Data Retention</h3>
          <div className="tp-panel rounded p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-tp-text-dim">Full data retention</span>
              <span className="tp-hud-value text-xs">30 days</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tp-text-dim">Summary archive</span>
              <span className="tp-hud-value text-xs">1 year</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tp-text-dim">Auto-purge</span>
              <span className="tp-hud-value text-xs">After archive</span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="tp-panel rounded-lg p-4 space-y-3 border-tp-red/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-tp-red" />
            <h3 className="text-sm font-medium text-tp-red">Danger Zone</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-tp-text">Delete All Investigations</div>
              <div className="text-[10px] text-tp-text-dim">Permanently remove all investigation data</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-tp-red/30 text-tp-red hover:bg-tp-red/10 text-xs h-8"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Purge All
            </Button>
          </div>
          <Separator className="bg-tp-border" />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-tp-text">Delete Account</div>
              <div className="text-[10px] text-tp-text-dim">Permanently delete your account and all data</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-tp-red/30 text-tp-red hover:bg-tp-red/10 text-xs h-8"
            >
              Delete Account
            </Button>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            className="bg-tp-amber hover:bg-tp-amber/90 text-background font-medium text-xs uppercase tracking-wider h-9"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saved ? 'Settings Saved' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}