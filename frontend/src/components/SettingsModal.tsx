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

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  // Form state - initialize with empty strings to avoid null errors
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form values when user data is available
  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPreviewUrl(user.profilePicId ? `/api/profile/picture/${user.profilePicId}` : null);
    }
  }, [user]);

  // Don't render if user is not available
  if (!user) {
    return null;
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfilePic(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      if (profilePic) {
        formData.append('profilePic', profilePic);
      }

      console.log('Submitting profile update:', { name, email, hasFile: !!profilePic });

      const updatedUser = await authAPI.updateProfile(formData);
      
      console.log('Profile updated successfully:', updatedUser);
      
      setUser(updatedUser);
      setSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (error) {
      console.error('Profile update error:', error);
      setError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Account Settings</h3>
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          Profile updated successfully!
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Profile Picture */}
        <div className="flex items-center space-x-4">
          <Avatar className="w-16 h-16">
            {previewUrl ? (
              <img 
                src={previewUrl} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-400 text-xl">
                  {name.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </Avatar>
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Picture
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Submit Button */}
        <Button 
          type="submit" 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Updating...' : 'Update Profile'}
        </Button>
      </form>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'general':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">General Settings</h3>
            <p className="text-gray-600">General application settings will go here.</p>
          </div>
        );
      case 'preferences':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Preferences</h3>
            <p className="text-gray-600">User preferences and customization options.</p>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <p className="text-gray-600">Notification settings and preferences.</p>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{TABS.find(tab => tab.key === activeTab)?.label}</h3>
            <p className="text-gray-600">Settings for {activeTab} will be implemented here.</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-200 p-4">
            <h2 className="text-xl font-semibold mb-4">Settings</h2>
            <nav className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {renderTabContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
