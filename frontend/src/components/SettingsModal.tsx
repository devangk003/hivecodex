import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogPortal, DialogOverlay, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { authAPI } from '@/lib/api';
import { X, Settings, User, Bell, Sliders, Users, AlertTriangle, Upload, Camera } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

// Custom transparent overlay component
const TransparentOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className="fixed inset-0 z-50 bg-transparent data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    {...props}
  />
));
TransparentOverlay.displayName = DialogPrimitive.Overlay.displayName;

// Custom dialog content without default overlay
const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <TransparentOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-5xl h-[85vh] translate-x-[-50%] translate-y-[-50%] gap-0 bg-white/95 backdrop-blur-lg border border-gray-200/50 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-3xl overflow-hidden p-0"
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));

// Only include tabs/features relevant to your app
const TABS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'profile', label: 'Account', icon: User },
  { key: 'preferences', label: 'Preferences', icon: Sliders },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'people', label: 'People', icon: Users },
  { key: 'danger', label: 'Danger zone', icon: AlertTriangle },
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
      setPreviewUrl(user.profilePicId ? `/api/auth/profile/picture/${user.profilePicId}` : null);
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
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h3>
        <p className="text-gray-600">Manage your personal information and profile</p>
      </div>
      
      {success && (
        <div className="bg-green-50/80 border border-green-200/50 text-green-800 px-6 py-4 rounded-2xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            Profile updated successfully!
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50/80 border border-red-200/50 text-red-800 px-6 py-4 rounded-2xl">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Profile Picture Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h4>
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {name.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </Avatar>
            
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 border border-gray-200/50 rounded-xl h-12 px-6 font-medium transition-all duration-200"
              >
                <Camera className="w-4 h-4 mr-2" />
                Change Picture
              </Button>
              <p className="text-gray-500 text-sm mt-2">
                PNG, JPG up to 5MB. Recommended: 200x200px
              </p>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
          <h4 className="text-lg font-semibold text-gray-900 mb-6">Personal Information</h4>
          <div className="grid gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 bg-white/70 border border-gray-200/50 rounded-xl px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900 placeholder-gray-500 transition-all duration-200"
                placeholder="Enter your full name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 bg-white/70 border border-gray-200/50 rounded-xl px-4 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900 placeholder-gray-500 transition-all duration-200"
                placeholder="Enter your email address"
                required
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-12 px-6 text-gray-700 hover:bg-gray-100/80 rounded-xl font-medium transition-all duration-200"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 px-8 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'general':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">General Settings</h3>
              <p className="text-gray-600">General application settings and preferences</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
              <p className="text-gray-700">General settings will be implemented here.</p>
            </div>
          </div>
        );
      case 'preferences':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Preferences</h3>
              <p className="text-gray-600">Customize your experience and workspace</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
              <p className="text-gray-700">User preferences and customization options will be available here.</p>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h3>
              <p className="text-gray-600">Manage your notification preferences</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
              <p className="text-gray-700">Notification settings and preferences will be configured here.</p>
            </div>
          </div>
        );
      case 'people':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">People</h3>
              <p className="text-gray-600">Manage team members and collaborators</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
              <p className="text-gray-700">Team management features will be available here.</p>
            </div>
          </div>
        );
      case 'danger':
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-red-900 mb-2">Danger Zone</h3>
              <p className="text-red-600">Irreversible and destructive actions</p>
            </div>
            <div className="bg-red-50/80 backdrop-blur-sm rounded-2xl p-6 border border-red-200/50">
              <p className="text-red-800 font-medium">⚠️ These actions cannot be undone. Please proceed with caution.</p>
              <div className="mt-6 space-y-4">
                <Button 
                  variant="destructive" 
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 px-6 font-medium transition-all duration-200"
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        );
      default:
        const currentTab = TABS.find(tab => tab.key === activeTab);
        return (
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{currentTab?.label}</h3>
              <p className="text-gray-600">Settings for {activeTab} will be implemented here.</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
              <p className="text-gray-700">This section is coming soon.</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <CustomDialogContent>
        {/* Accessibility components - visually hidden */}
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your account settings, preferences, and personal information
        </DialogDescription>
        
        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-6 top-6 z-10 rounded-full w-10 h-10 p-0 hover:bg-gray-100/80"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="flex h-full min-h-0">
          {/* Sidebar */}
          <div className="w-80 bg-gray-50/60 backdrop-blur-sm border-r border-gray-200/50 p-8">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
              </div>
              <p className="text-gray-600 text-sm">Manage your account and preferences</p>
            </div>
            
            <nav className="space-y-2">
              {TABS.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'bg-white/80 text-gray-900 shadow-sm border border-gray-200/50'
                        : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8 overflow-y-auto auto-hide-scrollbar min-h-0">
            {renderTabContent()}
          </div>
        </div>
      </CustomDialogContent>
    </Dialog>
  );
};

export default SettingsModal;
