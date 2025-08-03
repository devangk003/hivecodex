import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { X, User, Lock, Camera, Trash2, Settings } from 'lucide-react';

// Custom transparent dialog overlay for Notion-like experience
const TransparentDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent> & {
    children: React.ReactNode;
  }
>(({ className, children, ...props }, ref) => (
  <Dialog {...props}>
    <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
      <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] bg-white/95 backdrop-blur-lg border border-gray-200/50 shadow-xl rounded-2xl p-6 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        {children}
      </div>
    </div>
  </Dialog>
));

export const SettingsPanel: React.FC = () => {
  const [showDeleteProfile, setShowDeleteProfile] = useState(false);
  const [showDeleteData, setShowDeleteData] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangePicture, setShowChangePicture] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // TODO: Wire up API calls for each action

  return (
    <div className="p-8 max-w-2xl mx-auto bg-white/90 backdrop-blur-lg rounded-3xl shadow-xl border border-gray-200/30 mt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 text-sm">Manage your account and preferences</p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-4">
        {/* Profile Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-700" />
            Profile
          </h3>
          <div className="grid gap-3">
            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 rounded-xl"
              onClick={() => setShowEditProfile(true)}
            >
              <User className="w-4 h-4 mr-3" />
              Edit Profile Information
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 rounded-xl"
              onClick={() => setShowChangePicture(true)}
            >
              <Camera className="w-4 h-4 mr-3" />
              Change Profile Picture
            </Button>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-700" />
            Security
          </h3>
          <Button
            variant="ghost"
            className="w-full justify-start h-12 text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 rounded-xl"
            onClick={() => setShowChangePassword(true)}
          >
            <Lock className="w-4 h-4 mr-3" />
            Change Password
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50/80 backdrop-blur-sm rounded-2xl p-6 border border-red-200/50">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-700" />
            Danger Zone
          </h3>
          <div className="grid gap-3">
            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-red-700 hover:bg-red-100/80 hover:text-red-900 rounded-xl"
              onClick={() => setShowDeleteProfile(true)}
            >
              <Trash2 className="w-4 h-4 mr-3" />
              Delete Profile Completely
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start h-12 text-red-700 hover:bg-red-100/80 hover:text-red-900 rounded-xl"
              onClick={() => setShowDeleteData(true)}
            >
              <Trash2 className="w-4 h-4 mr-3" />
              Delete All Data Completely
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-lg border border-gray-200/50 shadow-2xl rounded-3xl p-8 relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 rounded-full w-8 h-8 p-0 hover:bg-gray-100/80"
              onClick={() => setShowEditProfile(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Edit Profile</h2>
              <p className="text-gray-600 text-sm">Update your personal information</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="username" className="text-sm font-medium text-gray-900 mb-2 block">
                  Username
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full h-12 bg-white/70 border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900"
                  placeholder="Enter your username"
                />
              </div>
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-900 mb-2 block">
                  Display Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-12 bg-white/70 border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900"
                  placeholder="Enter your display name"
                />
              </div>
              <Button className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Change Profile Picture Dialog */}
      <Dialog open={showChangePicture} onOpenChange={setShowChangePicture}>
        <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-lg border border-gray-200/50 shadow-2xl rounded-3xl p-8 relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 rounded-full w-8 h-8 p-0 hover:bg-gray-100/80"
              onClick={() => setShowChangePicture(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Change Profile Picture</h2>
              <p className="text-gray-600 text-sm">Upload a new profile picture</p>
            </div>
            
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <Input
                  type="file"
                  accept="image/*"
                  onChange={e => setProfilePic(e.target.files?.[0] || null)}
                  className="w-full bg-white/70 border-gray-200/50 rounded-xl text-gray-900"
                />
                <p className="text-sm text-gray-500 mt-2">PNG, JPG up to 5MB</p>
              </div>
              <Button className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200">
                Upload Picture
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-lg border border-gray-200/50 shadow-2xl rounded-3xl p-8 relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 rounded-full w-8 h-8 p-0 hover:bg-gray-100/80"
              onClick={() => setShowChangePassword(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Change Password</h2>
              <p className="text-gray-600 text-sm">Update your account password</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <Label htmlFor="oldPassword" className="text-sm font-medium text-gray-900 mb-2 block">
                  Current Password
                </Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="w-full h-12 bg-white/70 border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <Label htmlFor="newPassword" className="text-sm font-medium text-gray-900 mb-2 block">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full h-12 bg-white/70 border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-900 mb-2 block">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full h-12 bg-white/70 border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 text-gray-900"
                  placeholder="Confirm new password"
                />
              </div>
              <Button className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-200">
                Change Password
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete Profile Dialog */}
      <Dialog open={showDeleteProfile} onOpenChange={setShowDeleteProfile}>
        <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-lg border border-red-200/50 shadow-2xl rounded-3xl p-8 relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 rounded-full w-8 h-8 p-0 hover:bg-gray-100/80"
              onClick={() => setShowDeleteProfile(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Delete Profile</h2>
              <p className="text-gray-600 text-sm text-center">This action cannot be undone</p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-red-50/80 border border-red-200/50 rounded-2xl p-4">
                <p className="text-red-800 text-sm font-medium">
                  ⚠️ Warning: This will permanently delete your profile and all associated data.
                </p>
              </div>
              <Button 
                variant="destructive" 
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-200"
              >
                Yes, Delete My Profile
              </Button>
              <Button 
                variant="ghost" 
                className="w-full h-12 text-gray-700 hover:bg-gray-100/80 rounded-xl font-medium transition-all duration-200"
                onClick={() => setShowDeleteProfile(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete All Data Dialog */}
      <Dialog open={showDeleteData} onOpenChange={setShowDeleteData}>
        <div className="fixed inset-0 z-50 bg-black/10 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-lg border border-red-200/50 shadow-2xl rounded-3xl p-8 relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 rounded-full w-8 h-8 p-0 hover:bg-gray-100/80"
              onClick={() => setShowDeleteData(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Delete All Data</h2>
              <p className="text-gray-600 text-sm text-center">This action cannot be undone</p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-red-50/80 border border-red-200/50 rounded-2xl p-4">
                <p className="text-red-800 text-sm font-medium">
                  ⚠️ Critical Warning: This will permanently delete ALL your data including messages, files, and account information.
                </p>
              </div>
              <Button 
                variant="destructive" 
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-200"
              >
                Yes, Delete Everything
              </Button>
              <Button 
                variant="ghost" 
                className="w-full h-12 text-gray-700 hover:bg-gray-100/80 rounded-xl font-medium transition-all duration-200"
                onClick={() => setShowDeleteData(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default SettingsPanel;
