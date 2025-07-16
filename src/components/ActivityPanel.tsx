import { Circle } from 'lucide-react';

interface User {
  name: string;
  avatar: string;
  status: 'online' | 'idle' | 'offline';
  activity?: string;
}

const users: User[] = [
  {
    name: 'Rebecca',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b25d4609?w=32&h=32&fit=crop&crop=face',
    status: 'online',
    activity: 'Coding'
  },
  {
    name: 'Devang',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
    status: 'online',
    activity: 'In a call'
  }
];

const getStatusColor = (status: User['status']) => {
  switch (status) {
    case 'online':
      return 'status-online';
    case 'idle':
      return 'status-idle';
    case 'offline':
      return 'status-offline';
    default:
      return 'status-offline';
  }
};

export const ActivityPanel = () => {
  return (
    <div className="w-64 bg-discord-activity border-l border-border h-screen">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Active Now</h2>
      </div>
      
      <div className="p-4">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-4">It's quiet for now...</p>
          <p className="text-xs text-muted-foreground">
            When a friend starts an activity - like playing a game or 
            hanging out on voice - we'll show it here!
          </p>
        </div>
        
        <div className="space-y-4">
          {users.map((user, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
                <Circle 
                  className={`w-3 h-3 absolute -bottom-1 -right-1 bg-discord-activity rounded-full fill-${getStatusColor(user.status)} text-${getStatusColor(user.status)}`}
                />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{user.name}</div>
                {user.activity && (
                  <div className="text-xs text-muted-foreground">{user.activity}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};