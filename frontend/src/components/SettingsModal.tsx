import React, { useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/lib/api';

// Only include tabs/features relevant to your app
const TABS = [
  { key: 'general', label: 'General', icon: 'gear' },
  { key: 'profile', label: 'Account', icon: 'avatar' },
  { key: 'preferences', label: 'Preferences', icon: 'sliders' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'connections', label: 'Connections', icon: 'arrowUpRightSquare' },
  { key: 'people', label: 'People', icon: 'people' },
  { key: 'teamspaces', label: 'Teamspaces', icon: 'teamspace' },
  { key: 'import', label: 'Import', icon: 'arrowLineDown' },
  { key: 'danger', label: 'Danger zone', icon: 'alert' },
  { key: 'setup', label: 'Setup info', icon: 'info' },
];

const SettingsModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  // Form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open && user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setProfilePic(null);
      setPreviewUrl(null);
      setSuccess(false);
      setError(null);
    }
  }, [open, user]);

  const handleProfilePicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProfilePic(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const data = await authAPI.updateProfile({ name, email, profilePic });
      setSuccess(true);
      // Update user in context/localStorage
      if (setUser) {
        setUser(prev => ({
          ...prev!,
          name: data.name,
          email: data.email,
          profilePicId: data.profilePicId,
        }));
        const storedUser = localStorage.getItem('user');
        if (storedUser && storedUser !== 'undefined') {
          const parsed = JSON.parse(storedUser);
          parsed.name = data.name;
          parsed.email = data.email;
          parsed.profilePicId = data.profilePicId;
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      }
    } catch (err: unknown) {
      interface APIError {
        response?: {
          data?: {
            message?: string;
          };
        };
      }
      const apiError = err as APIError;
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        apiError.response?.data?.message
      ) {
        setError(apiError.response.data.message);
      } else {
        setError('Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 max-w-4xl w-full h-[80vh] flex flex-row bg-[#202020] text-white rounded-lg overflow-hidden shadow-2xl">
        {/* Accessibility: DialogTitle and DialogDescription */}
        <div className="sr-only">
          <span id="settings-modal-title">
            <strong>Settings</strong>
          </span>
          <span id="settings-modal-desc">
            Manage your account, preferences, notifications, and more.
          </span>
        </div>
        {/* Sidebar */}
        <div className="h-full bg-[#202020] w-60 flex flex-col justify-between overflow-y-auto border-r border-white/10">
          <div className="flex flex-col gap-2 p-3">
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left ${activeTab === tab.key ? 'bg-white/10 font-semibold' : 'hover:bg-white/5'}`}
                onClick={() => setActiveTab(tab.key)}
                aria-selected={activeTab === tab.key}
                role="tab"
              >
                {/* Replace with your icon system */}
                <span className="w-5 h-5 inline-block bg-white/20 rounded-full" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Main panel */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto p-10">
          {activeTab === 'general' && (
            <div>
              {/* Use DialogTitle and DialogDescription visually hidden for a11y, or visually if desired */}
              <div
                className="sr-only"
                role="heading"
                aria-level={1}
                id="settings-modal-title-real"
              >
                Settings
              </div>
              <div className="sr-only" id="settings-modal-desc-real">
                Manage your account, preferences, notifications, and more.
              </div>
              <div className="text-lg font-medium mb-4">Workspace settings</div>
              <div className="mb-6">
                <div className="text-sm mb-1">Name</div>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                  placeholder="e.g. company name"
                  maxLength={65}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={loading}
                  aria-labelledby="settings-modal-title-real"
                  aria-describedby="settings-modal-desc-real"
                />
                <div className="text-xs text-white/50 mt-1">
                  You can use your organization or company name. Keep it simple.
                </div>
              </div>
              <div className="mb-6">
                <div className="text-sm mb-1">Email</div>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
                  placeholder="your@email.com"
                  maxLength={100}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="mb-6">
                <div className="text-sm mb-1">Icon</div>
                <div className="w-18 h-18 border border-white/10 rounded flex items-center justify-center bg-white/5 relative">
                  <Avatar className="h-16 w-16">
                    {/* Optionally add <AvatarImage src="..." /> */}
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-3xl text-white/50">
                        {user?.name?.[0]?.toUpperCase() || 'D'}
                      </span>
                    )}
                  </Avatar>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleProfilePicChange}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute bottom-0 right-0 text-xs px-2 py-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    Change
                  </Button>
                </div>
                <div className="text-xs text-white/50 mt-2">
                  Upload an image or pick an emoji. It will show up in your
                  sidebar and notifications.
                </div>
              </div>
              {error && (
                <div className="text-red-400 text-sm mb-2">{error}</div>
              )}
              {success && (
                <div className="text-green-400 text-sm mb-2">
                  Profile updated!
                </div>
              )}
              <div className="flex gap-2 mt-8">
                <Button
                  variant="default"
                  onClick={handleUpdate}
                  disabled={loading}
                >
                  {loading ? 'Updating...' : 'Update'}
                </Button>
                <Button variant="outline" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {/* Add other tab panels as needed */}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
