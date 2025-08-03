import React, { useState, useCallback, useEffect } from 'react';
import { 
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  Code,
  Monitor,
  Volume2,
  Keyboard,
  Languages,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Eye,
  Moon,
  Sun,
  Zap,
  HardDrive,
  Wifi,
  ChevronRight,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface UserSettings {
  profile: {
    displayName: string;
    avatar?: string;
    status: string;
    bio: string;
  };
  appearance: {
    theme: 'dark' | 'light' | 'auto';
    fontSize: number;
    fontFamily: string;
    compactMode: boolean;
    showAvatars: boolean;
    animationsEnabled: boolean;
  };
  editor: {
    tabSize: number;
    insertSpaces: boolean;
    wordWrap: boolean;
    lineNumbers: boolean;
    minimap: boolean;
    autoSave: boolean;
    formatOnSave: boolean;
    fontFamily: string;
    fontSize: number;
    theme: string;
  };
  notifications: {
    desktop: boolean;
    sound: boolean;
    mentions: boolean;
    directMessages: boolean;
    roomActivity: boolean;
    volume: number;
  };
  privacy: {
    showOnlineStatus: boolean;
    showTypingIndicator: boolean;
    allowDirectMessages: boolean;
    shareActivity: boolean;
  };
  advanced: {
    developerMode: boolean;
    experimentalFeatures: boolean;
    telemetry: boolean;
    autoUpdate: boolean;
    hardwareAcceleration: boolean;
  };
}

interface SettingsPanelProps {
  roomId?: string;
  onClose?: () => void;
}

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
];

const EDITOR_FONT_FAMILIES = [
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Consolas', label: 'Consolas' },
  { value: 'Source Code Pro', label: 'Source Code Pro' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
];

const EDITOR_THEMES = [
  { value: 'vs-dark', label: 'Dark' },
  { value: 'vs', label: 'Light' },
  { value: 'hc-black', label: 'High Contrast Dark' },
  { value: 'hc-light', label: 'High Contrast Light' },
];

const SettingSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ title, icon, children, isOpen, onToggle }) => {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-discord-sidebar-hover cursor-pointer">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-discord-text" />
          ) : (
            <ChevronRight className="w-4 h-4 text-discord-text" />
          )}
          {icon}
          <span className="text-sm font-medium text-discord-text">{title}</span>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-6 pb-4 space-y-4">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const SettingItem: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
}> = ({ label, description, children }) => {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm text-discord-text">{label}</Label>
        {description && (
          <p className="text-xs text-discord-muted mt-1">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  roomId,
  onClose,
}) => {
  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      displayName: 'John Doe',
      status: 'Building amazing things',
      bio: 'Full-stack developer passionate about creating beautiful and functional applications.',
    },
    appearance: {
      theme: 'dark',
      fontSize: 14,
      fontFamily: 'Inter',
      compactMode: false,
      showAvatars: true,
      animationsEnabled: true,
    },
    editor: {
      tabSize: 2,
      insertSpaces: true,
      wordWrap: true,
      lineNumbers: true,
      minimap: true,
      autoSave: true,
      formatOnSave: true,
      fontFamily: 'Fira Code',
      fontSize: 14,
      theme: 'vs-dark',
    },
    notifications: {
      desktop: true,
      sound: true,
      mentions: true,
      directMessages: true,
      roomActivity: false,
      volume: 50,
    },
    privacy: {
      showOnlineStatus: true,
      showTypingIndicator: true,
      allowDirectMessages: true,
      shareActivity: true,
    },
    advanced: {
      developerMode: false,
      experimentalFeatures: false,
      telemetry: true,
      autoUpdate: true,
      hardwareAcceleration: true,
    },
  });

  const [expandedSections, setExpandedSections] = useState({
    profile: true,
    appearance: false,
    editor: false,
    notifications: false,
    privacy: false,
    advanced: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings,
    }));
    setHasUnsavedChanges(true);
  }, []);

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      
      // TODO: Implement actual save settings API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHasUnsavedChanges(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = () => {
    // TODO: Reset to default settings
    toast.info('Settings reset to defaults');
    setHasUnsavedChanges(true);
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hivecodex-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Settings exported');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="h-full bg-discord-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-discord-border">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-5 h-5 text-discord-text" />
          <h2 className="text-lg font-semibold text-white">Settings</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-none">
              Unsaved changes
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-discord-sidebar-hover"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings Content */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Profile Settings */}
          <SettingSection
            title="Profile"
            icon={<User className="w-4 h-4 text-discord-text" />}
            isOpen={expandedSections.profile}
            onToggle={() => toggleSection('profile')}
          >
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={settings.profile.avatar} alt={settings.profile.displayName} />
                <AvatarFallback className="text-lg bg-discord-primary text-white">
                  {getInitials(settings.profile.displayName)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <Button variant="outline" size="sm" className="mb-2">
                  Change Avatar
                </Button>
                <p className="text-xs text-discord-muted">
                  JPG, PNG or GIF. Max size 8MB.
                </p>
              </div>
            </div>
            
            <SettingItem label="Display Name">
              <Input
                value={settings.profile.displayName}
                onChange={(e) => updateSettings({
                  profile: { ...settings.profile, displayName: e.target.value }
                })}
                className="w-48 bg-discord-editor border-discord-border text-white"
              />
            </SettingItem>
            
            <SettingItem label="Status">
              <Input
                value={settings.profile.status}
                onChange={(e) => updateSettings({
                  profile: { ...settings.profile, status: e.target.value }
                })}
                className="w-48 bg-discord-editor border-discord-border text-white"
                placeholder="What's your status?"
              />
            </SettingItem>
            
            <SettingItem label="Bio">
              <textarea
                value={settings.profile.bio}
                onChange={(e) => updateSettings({
                  profile: { ...settings.profile, bio: e.target.value }
                })}
                className="w-48 h-20 p-2 text-sm bg-discord-editor border border-discord-border rounded text-white placeholder:text-discord-muted resize-none"
                placeholder="Tell us about yourself..."
              />
            </SettingItem>
          </SettingSection>

          <Separator className="bg-discord-border" />

          {/* Appearance Settings */}
          <SettingSection
            title="Appearance"
            icon={<Palette className="w-4 h-4 text-discord-text" />}
            isOpen={expandedSections.appearance}
            onToggle={() => toggleSection('appearance')}
          >
            <SettingItem label="Theme">
              <Select
                value={settings.appearance.theme}
                onValueChange={(value: 'dark' | 'light' | 'auto') =>
                  updateSettings({
                    appearance: { ...settings.appearance, theme: value }
                  })
                }
              >
                <SelectTrigger className="w-32 bg-discord-editor border-discord-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-discord-sidebar border-discord-border">
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>
            
            <SettingItem 
              label="Font Size"
              description="Adjust the font size of the interface"
            >
              <div className="flex items-center gap-2">
                <Slider
                  value={[settings.appearance.fontSize]}
                  onValueChange={(value) => updateSettings({
                    appearance: { ...settings.appearance, fontSize: value[0] }
                  })}
                  min={12}
                  max={18}
                  step={1}
                  className="w-24"
                />
                <span className="text-xs text-discord-muted w-8">
                  {settings.appearance.fontSize}px
                </span>
              </div>
            </SettingItem>
            
            <SettingItem label="Font Family">
              <Select
                value={settings.appearance.fontFamily}
                onValueChange={(value) =>
                  updateSettings({
                    appearance: { ...settings.appearance, fontFamily: value }
                  })
                }
              >
                <SelectTrigger className="w-32 bg-discord-editor border-discord-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-discord-sidebar border-discord-border">
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingItem>
            
            <SettingItem 
              label="Compact Mode"
              description="Reduce spacing and padding in the interface"
            >
              <Switch
                checked={settings.appearance.compactMode}
                onCheckedChange={(checked) => updateSettings({
                  appearance: { ...settings.appearance, compactMode: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Show Avatars">
              <Switch
                checked={settings.appearance.showAvatars}
                onCheckedChange={(checked) => updateSettings({
                  appearance: { ...settings.appearance, showAvatars: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Animations">
              <Switch
                checked={settings.appearance.animationsEnabled}
                onCheckedChange={(checked) => updateSettings({
                  appearance: { ...settings.appearance, animationsEnabled: checked }
                })}
              />
            </SettingItem>
          </SettingSection>

          <Separator className="bg-discord-border" />

          {/* Editor Settings */}
          <SettingSection
            title="Editor"
            icon={<Code className="w-4 h-4 text-discord-text" />}
            isOpen={expandedSections.editor}
            onToggle={() => toggleSection('editor')}
          >
            <SettingItem label="Tab Size">
              <Select
                value={settings.editor.tabSize.toString()}
                onValueChange={(value) =>
                  updateSettings({
                    editor: { ...settings.editor, tabSize: parseInt(value) }
                  })
                }
              >
                <SelectTrigger className="w-20 bg-discord-editor border-discord-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-discord-sidebar border-discord-border">
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>
            
            <SettingItem label="Insert Spaces">
              <Switch
                checked={settings.editor.insertSpaces}
                onCheckedChange={(checked) => updateSettings({
                  editor: { ...settings.editor, insertSpaces: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Word Wrap">
              <Switch
                checked={settings.editor.wordWrap}
                onCheckedChange={(checked) => updateSettings({
                  editor: { ...settings.editor, wordWrap: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Line Numbers">
              <Switch
                checked={settings.editor.lineNumbers}
                onCheckedChange={(checked) => updateSettings({
                  editor: { ...settings.editor, lineNumbers: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Minimap">
              <Switch
                checked={settings.editor.minimap}
                onCheckedChange={(checked) => updateSettings({
                  editor: { ...settings.editor, minimap: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Auto Save">
              <Switch
                checked={settings.editor.autoSave}
                onCheckedChange={(checked) => updateSettings({
                  editor: { ...settings.editor, autoSave: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Format on Save">
              <Switch
                checked={settings.editor.formatOnSave}
                onCheckedChange={(checked) => updateSettings({
                  editor: { ...settings.editor, formatOnSave: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Font Family">
              <Select
                value={settings.editor.fontFamily}
                onValueChange={(value) =>
                  updateSettings({
                    editor: { ...settings.editor, fontFamily: value }
                  })
                }
              >
                <SelectTrigger className="w-36 bg-discord-editor border-discord-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-discord-sidebar border-discord-border">
                  {EDITOR_FONT_FAMILIES.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingItem>
            
            <SettingItem label="Font Size">
              <div className="flex items-center gap-2">
                <Slider
                  value={[settings.editor.fontSize]}
                  onValueChange={(value) => updateSettings({
                    editor: { ...settings.editor, fontSize: value[0] }
                  })}
                  min={10}
                  max={20}
                  step={1}
                  className="w-24"
                />
                <span className="text-xs text-discord-muted w-8">
                  {settings.editor.fontSize}px
                </span>
              </div>
            </SettingItem>
            
            <SettingItem label="Theme">
              <Select
                value={settings.editor.theme}
                onValueChange={(value) =>
                  updateSettings({
                    editor: { ...settings.editor, theme: value }
                  })
                }
              >
                <SelectTrigger className="w-36 bg-discord-editor border-discord-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-discord-sidebar border-discord-border">
                  {EDITOR_THEMES.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingItem>
          </SettingSection>

          <Separator className="bg-discord-border" />

          {/* Notifications Settings */}
          <SettingSection
            title="Notifications"
            icon={<Bell className="w-4 h-4 text-discord-text" />}
            isOpen={expandedSections.notifications}
            onToggle={() => toggleSection('notifications')}
          >
            <SettingItem 
              label="Desktop Notifications"
              description="Show notifications even when the app is not focused"
            >
              <Switch
                checked={settings.notifications.desktop}
                onCheckedChange={(checked) => updateSettings({
                  notifications: { ...settings.notifications, desktop: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Sound">
              <Switch
                checked={settings.notifications.sound}
                onCheckedChange={(checked) => updateSettings({
                  notifications: { ...settings.notifications, sound: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Mentions">
              <Switch
                checked={settings.notifications.mentions}
                onCheckedChange={(checked) => updateSettings({
                  notifications: { ...settings.notifications, mentions: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Direct Messages">
              <Switch
                checked={settings.notifications.directMessages}
                onCheckedChange={(checked) => updateSettings({
                  notifications: { ...settings.notifications, directMessages: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Room Activity">
              <Switch
                checked={settings.notifications.roomActivity}
                onCheckedChange={(checked) => updateSettings({
                  notifications: { ...settings.notifications, roomActivity: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem label="Volume">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-discord-muted" />
                <Slider
                  value={[settings.notifications.volume]}
                  onValueChange={(value) => updateSettings({
                    notifications: { ...settings.notifications, volume: value[0] }
                  })}
                  min={0}
                  max={100}
                  step={5}
                  className="w-24"
                />
                <span className="text-xs text-discord-muted w-8">
                  {settings.notifications.volume}%
                </span>
              </div>
            </SettingItem>
          </SettingSection>

          <Separator className="bg-discord-border" />

          {/* Privacy Settings */}
          <SettingSection
            title="Privacy"
            icon={<Shield className="w-4 h-4 text-discord-text" />}
            isOpen={expandedSections.privacy}
            onToggle={() => toggleSection('privacy')}
          >
            <SettingItem 
              label="Show Online Status"
              description="Let others see when you're online"
            >
              <Switch
                checked={settings.privacy.showOnlineStatus}
                onCheckedChange={(checked) => updateSettings({
                  privacy: { ...settings.privacy, showOnlineStatus: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem 
              label="Show Typing Indicator"
              description="Let others see when you're typing"
            >
              <Switch
                checked={settings.privacy.showTypingIndicator}
                onCheckedChange={(checked) => updateSettings({
                  privacy: { ...settings.privacy, showTypingIndicator: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem 
              label="Allow Direct Messages"
              description="Allow other users to send you direct messages"
            >
              <Switch
                checked={settings.privacy.allowDirectMessages}
                onCheckedChange={(checked) => updateSettings({
                  privacy: { ...settings.privacy, allowDirectMessages: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem 
              label="Share Activity"
              description="Share what you're working on with other users"
            >
              <Switch
                checked={settings.privacy.shareActivity}
                onCheckedChange={(checked) => updateSettings({
                  privacy: { ...settings.privacy, shareActivity: checked }
                })}
              />
            </SettingItem>
          </SettingSection>

          <Separator className="bg-discord-border" />

          {/* Advanced Settings */}
          <SettingSection
            title="Advanced"
            icon={<Zap className="w-4 h-4 text-discord-text" />}
            isOpen={expandedSections.advanced}
            onToggle={() => toggleSection('advanced')}
          >
            <SettingItem 
              label="Developer Mode"
              description="Enable developer tools and debug features"
            >
              <Switch
                checked={settings.advanced.developerMode}
                onCheckedChange={(checked) => updateSettings({
                  advanced: { ...settings.advanced, developerMode: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem 
              label="Experimental Features"
              description="Enable experimental features (may be unstable)"
            >
              <Switch
                checked={settings.advanced.experimentalFeatures}
                onCheckedChange={(checked) => updateSettings({
                  advanced: { ...settings.advanced, experimentalFeatures: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem 
              label="Telemetry"
              description="Help improve the app by sharing usage data"
            >
              <Switch
                checked={settings.advanced.telemetry}
                onCheckedChange={(checked) => updateSettings({
                  advanced: { ...settings.advanced, telemetry: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem 
              label="Auto Update"
              description="Automatically download and install updates"
            >
              <Switch
                checked={settings.advanced.autoUpdate}
                onCheckedChange={(checked) => updateSettings({
                  advanced: { ...settings.advanced, autoUpdate: checked }
                })}
              />
            </SettingItem>
            
            <SettingItem 
              label="Hardware Acceleration"
              description="Use GPU acceleration for better performance"
            >
              <Switch
                checked={settings.advanced.hardwareAcceleration}
                onCheckedChange={(checked) => updateSettings({
                  advanced: { ...settings.advanced, hardwareAcceleration: checked }
                })}
              />
            </SettingItem>
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-discord-border">
              <Button
                variant="outline"
                size="sm"
                onClick={exportSettings}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Settings
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={resetSettings}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
          </SettingSection>
        </div>
      </ScrollArea>

      {/* Footer */}
      {hasUnsavedChanges && (
        <div className="p-4 border-t border-discord-border bg-discord-editor/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-discord-muted">
              You have unsaved changes
            </span>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Reset to last saved state
                  setHasUnsavedChanges(false);
                }}
              >
                Discard
              </Button>
              
              <Button
                size="sm"
                onClick={saveSettings}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
