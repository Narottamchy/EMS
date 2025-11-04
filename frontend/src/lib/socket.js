import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.subscriptions = new Set();
  }

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = localStorage.getItem('token');
    
    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      // Re-subscribe to all campaigns after reconnection
      this.subscriptions.forEach(campaignId => {
        this.socket.emit('subscribe-campaign', campaignId);
      });
    });

    this.socket.on('disconnect', () => {
      // Socket disconnected
    });

    this.socket.on('connect_error', () => {
      // Connection error
    });

    this.socket.on('error', () => {
      // Socket error
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  subscribeToCampaign(campaignId, callback) {
    if (!this.socket) {
      this.connect();
    }

    // Track subscription for reconnection
    this.subscriptions.add(campaignId);

    this.socket.emit('subscribe-campaign', campaignId);
    
    const eventName = `campaign-${campaignId}-update`;
    this.socket.on(eventName, callback);

    // Store listener for cleanup
    if (!this.listeners.has(campaignId)) {
      this.listeners.set(campaignId, []);
    }
    this.listeners.get(campaignId).push({ event: eventName, callback });
  }

  unsubscribeFromCampaign(campaignId) {
    if (!this.socket) return;

    // Remove from subscriptions
    this.subscriptions.delete(campaignId);

    this.socket.emit('unsubscribe-campaign', campaignId);

    // Remove all listeners for this campaign
    const campaignListeners = this.listeners.get(campaignId);
    if (campaignListeners) {
      campaignListeners.forEach(({ event, callback }) => {
        this.socket.off(event, callback);
      });
      this.listeners.delete(campaignId);
    }
  }

  on(event, callback) {
    if (!this.socket) {
      this.connect();
    }
    this.socket.on(event, callback);
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (!this.socket) {
      this.connect();
    }
    this.socket.emit(event, data);
  }
}

export default new SocketService();
