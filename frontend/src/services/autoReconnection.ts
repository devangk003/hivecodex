import { Socket } from 'socket.io-client';

export interface AutoReconnectionConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitterRange: number;
  enableLogging: boolean;
}

export interface ReconnectionState {
  isReconnecting: boolean;
  attempts: number;
  nextAttemptIn: number;
  lastDisconnectReason?: string;
  totalReconnections: number;
}

export class AutoReconnectionManager {
  private socket: Socket | null = null;
  private config: AutoReconnectionConfig;
  private state: ReconnectionState;
  private reconnectionTimer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  constructor(config: Partial<AutoReconnectionConfig> = {}) {
    this.config = {
      maxAttempts: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitterRange: 0.1,
      enableLogging: true,
      ...config
    };

    this.state = {
      isReconnecting: false,
      attempts: 0,
      nextAttemptIn: 0,
      totalReconnections: 0
    };
  }

  // Initialize with socket instance
  initialize(socket: Socket): void {
    this.socket = socket;
    this.setupSocketListeners();
  }

  // Setup socket event listeners
  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      this.handleDisconnection(reason);
    });

    this.socket.on('connect', () => {
      this.handleReconnection();
    });

    this.socket.on('connect_error', (error) => {
      this.handleConnectionError(error);
    });
  }

  // Handle disconnection
  private handleDisconnection(reason: string): void {
    if (this.config.enableLogging) {
      console.log(`Socket disconnected: ${reason}`);
    }

    this.state.lastDisconnectReason = reason;
    
    // Don't auto-reconnect if disconnection was intentional
    if (reason === 'io client disconnect') {
      return;
    }

    this.startReconnectionProcess();
    this.emit('disconnected', { reason, state: this.state });
  }

  // Handle successful reconnection
  private handleReconnection(): void {
    if (this.state.isReconnecting) {
      this.state.totalReconnections++;
      
      if (this.config.enableLogging) {
        console.log(`Successfully reconnected after ${this.state.attempts} attempts`);
      }
    }

    this.resetReconnectionState();
    this.emit('reconnected', { 
      attempts: this.state.attempts,
      totalReconnections: this.state.totalReconnections 
    });
  }

  // Handle connection errors
  private handleConnectionError(error: Error): void {
    if (this.config.enableLogging) {
      console.error('Connection error:', error.message);
    }

    this.emit('connection-error', { error, state: this.state });
  }

  // Start the reconnection process
  private startReconnectionProcess(): void {
    if (this.state.isReconnecting) {
      return; // Already reconnecting
    }

    this.state.isReconnecting = true;
    this.state.attempts = 0;
    this.scheduleNextReconnection();
  }

  // Schedule the next reconnection attempt
  private scheduleNextReconnection(): void {
    if (this.state.attempts >= this.config.maxAttempts) {
      this.handleMaxAttemptsReached();
      return;
    }

    const delay = this.calculateDelay();
    this.state.nextAttemptIn = delay;
    this.state.attempts++;

    if (this.config.enableLogging) {
      console.log(`Scheduling reconnection attempt ${this.state.attempts} in ${delay}ms`);
    }

    this.startCountdown(delay);
    
    this.reconnectionTimer = setTimeout(() => {
      this.attemptReconnection();
    }, delay);

    this.emit('reconnection-scheduled', { 
      attempt: this.state.attempts,
      delay,
      state: this.state 
    });
  }

  // Calculate delay with exponential backoff and jitter
  private calculateDelay(): number {
    const exponentialDelay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffFactor, this.state.attempts),
      this.config.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * this.config.jitterRange;
    const randomJitter = (Math.random() - 0.5) * 2 * jitter;
    
    return Math.max(exponentialDelay + randomJitter, 0);
  }

  // Start countdown timer for UI updates
  private startCountdown(delay: number): void {
    this.state.nextAttemptIn = delay;
    
    this.countdownTimer = setInterval(() => {
      this.state.nextAttemptIn = Math.max(this.state.nextAttemptIn - 1000, 0);
      this.emit('countdown-update', { nextAttemptIn: this.state.nextAttemptIn });
      
      if (this.state.nextAttemptIn <= 0) {
        this.clearCountdown();
      }
    }, 1000);
  }

  // Clear countdown timer
  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  // Attempt to reconnect
  private attemptReconnection(): void {
    if (!this.socket) {
      this.handleMaxAttemptsReached();
      return;
    }

    if (this.config.enableLogging) {
      console.log(`Attempting reconnection ${this.state.attempts}/${this.config.maxAttempts}`);
    }

    this.emit('reconnection-attempt', { 
      attempt: this.state.attempts,
      state: this.state 
    });

    try {
      this.socket.connect();
      
      // Schedule next attempt if this one fails
      setTimeout(() => {
        if (this.state.isReconnecting && !this.socket?.connected) {
          this.scheduleNextReconnection();
        }
      }, 5000); // Give 5 seconds for connection to establish
      
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Reconnection attempt failed:', error);
      }
      this.scheduleNextReconnection();
    }
  }

  // Handle max attempts reached
  private handleMaxAttemptsReached(): void {
    if (this.config.enableLogging) {
      console.error(`Max reconnection attempts (${this.config.maxAttempts}) reached`);
    }

    this.resetReconnectionState();
    this.emit('max-attempts-reached', { 
      attempts: this.config.maxAttempts,
      state: this.state 
    });
  }

  // Reset reconnection state
  private resetReconnectionState(): void {
    this.state.isReconnecting = false;
    this.state.attempts = 0;
    this.state.nextAttemptIn = 0;
    
    this.clearTimers();
  }

  // Clear all timers
  private clearTimers(): void {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
    this.clearCountdown();
  }

  // Manually trigger reconnection
  forceReconnect(): void {
    this.clearTimers();
    this.resetReconnectionState();
    
    if (this.socket) {
      this.socket.disconnect();
      this.startReconnectionProcess();
    }
  }

  // Stop reconnection process
  stopReconnection(): void {
    this.clearTimers();
    this.resetReconnectionState();
    
    if (this.config.enableLogging) {
      console.log('Auto-reconnection stopped');
    }

    this.emit('reconnection-stopped');
  }

  // Get current state
  getState(): ReconnectionState {
    return { ...this.state };
  }

  // Get configuration
  getConfig(): AutoReconnectionConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(newConfig: Partial<AutoReconnectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  // Event listener management
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in reconnection event listener for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  destroy(): void {
    this.clearTimers();
    this.listeners.clear();
    
    if (this.socket) {
      this.socket.off('disconnect');
      this.socket.off('connect');
      this.socket.off('connect_error');
    }
  }
}

// Export singleton instance
export const autoReconnectionManager = new AutoReconnectionManager();