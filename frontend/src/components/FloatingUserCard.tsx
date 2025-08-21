import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStatusContext } from '@/contexts/UserStatusContext';
import { API_BASE_URL } from '@/lib/api';
import { User } from '@/lib/api';

const FloatingUserCard: React.FC<{ user: User }> = ({ user }) => {
  const [minimized, setMinimized] = useState(false);
  const { roomStatus, currentRoomId } = useUserStatusContext();

  const getStatusColor = () => {
    if (currentRoomId) {
      switch (roomStatus) {
        case 'in-room':
          return '#43B581'; // Green
        case 'away':
          return '#f0b132'; // Yellow
        case 'offline':
          return '#747f8d'; // Gray
        default:
          return '#43B581';
      }
    }
    return '#43B581'; // Default online green
  };

  const getStatusText = () => {
    if (currentRoomId) {
      switch (roomStatus) {
        case 'in-room':
          return 'In Room';
        case 'away':
          return 'Away';
        case 'offline':
          return 'Offline';
        default:
          return 'Online';
      }
    }
    return 'Online';
  };

  if (minimized) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          className="w-12 h-12 bg-[#23272A] border border-[#2C2F33] rounded-full flex items-center justify-center shadow-md hover:bg-[#2C2F33] transition-colors"
          title="Show User Card"
          onClick={() => setMinimized(false)}
        >
          <img
            src={
              user?.profilePicId
                ? `/api/v1/profile/picture/${user.profilePicId}`
                : '/default-user.svg'
            }
            alt={user?.name || 'User'}
            className="w-8 h-8 rounded-full object-cover"
          />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-16 z-50">
      <div className="bg-[#23272A] border border-[#2C2F33] rounded-lg shadow-md p-3 min-w-[220px] max-w-[420px] w-auto">
        <div className="flex flex-row items-center justify-between gap-2">
          <div className="flex flex-row items-center min-w-0 gap-3 flex-1">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 relative">
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <img
                    src={
                      user?.profilePicId
                        ? `/api/v1/profile/picture/${user.profilePicId}`
                        : '/default-user.svg'
                    }
                    alt={user?.name || 'User'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div 
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#23272A]" 
                  style={{ backgroundColor: getStatusColor() }}
                ></div>
              </div>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-white break-all">
                {user?.name || 'User'}
              </span>
              <span className="text-xs text-[#b9bbbe] mt-0.5">
                {getStatusText()}
              </span>
            </div>
          </div>
          <div className="flex flex-row items-center gap-1 ml-2">
            <button
              className="w-8 h-8 bg-discord-button hover:bg-discord-button-hover rounded-full flex items-center justify-center transition-colors"
              title="Mute"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="2" width="6" height="12" rx="3"></rect>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
                <line x1="8" y1="22" x2="16" y2="22"></line>
              </svg>
            </button>
            <button
              className="w-8 h-8 bg-discord-button hover:bg-discord-button-hover rounded-full flex items-center justify-center transition-colors"
              title="Deafen"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"></path>
                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3"></path>
              </svg>
            </button>
            <button
              className="w-8 h-8 bg-discord-button hover:bg-discord-button-hover rounded-full flex items-center justify-center transition-colors"
              title="Minimize"
              onClick={() => setMinimized(true)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="20" x2="20" y2="20"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingUserCard;
