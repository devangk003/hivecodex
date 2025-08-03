export type GlobalUserStatus = 'online' | 'offline' | 'away';
export type RoomUserStatus = 'online' | 'away' | 'in-room' | 'offline';

export interface UserStatusData {
  userId: string;
  userName: string;
  profilePicId?: string;
  globalStatus: GlobalUserStatus;
  roomStatus?: RoomUserStatus;
  currentRoomId?: string;
  lastSeen?: Date;
  isInSameRoom?: boolean;
}

export interface RoomParticipant {
  id: string;
  name: string;
  profilePicId?: string;
  status: RoomUserStatus;
  isOnline: boolean;
  lastSeen?: Date;
  currentRoomId?: string;
}

export interface StatusUpdatePayload {
  userId: string;
  userName: string;
  globalStatus: GlobalUserStatus;
  roomStatus?: RoomUserStatus;
  roomId?: string;
}
