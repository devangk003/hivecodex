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
    <div className="p-6 max-w-lg mx-auto bg-card rounded-lg shadow-md mt-8">
      <h2 className="text-xl font-bold mb-4">Settings</h2>
      <div className="space-y-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowEditProfile(true)}
        >
          Edit Profile (Name, Username)
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowChangePicture(true)}
        >
          Change Profile Picture
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowChangePassword(true)}
        >
          Change Password
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setShowDeleteProfile(true)}
        >
          Delete Profile Completely
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => setShowDeleteData(true)}
        >
          Delete All Data Completely
        </Button>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <Button className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Profile Picture Dialog */}
      <Dialog open={showChangePicture} onOpenChange={setShowChangePicture}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Profile Picture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              accept="image/*"
              onChange={e => setProfilePic(e.target.files?.[0] || null)}
            />
            <Button className="w-full">Upload</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="oldPassword">Old Password</Label>
              <Input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button className="w-full">Change Password</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Profile Dialog */}
      <Dialog open={showDeleteProfile} onOpenChange={setShowDeleteProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-destructive">
              Are you sure you want to delete your profile? This action cannot
              be undone.
            </p>
            <Button variant="destructive" className="w-full">
              Delete Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Data Dialog */}
      <Dialog open={showDeleteData} onOpenChange={setShowDeleteData}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-destructive">
              Are you sure you want to delete all your data? This action cannot
              be undone.
            </p>
            <Button variant="destructive" className="w-full">
              Delete All Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPanel;
