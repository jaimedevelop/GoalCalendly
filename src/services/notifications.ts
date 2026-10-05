// Notification service for timer status bar integration
export class TimerNotificationService {
  private static instance: TimerNotificationService;
  private updateInterval: number | null = null;
  private fallbackNotification: Notification | null = null;
  private isSupported: boolean;

  private constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
  }

  public static getInstance(): TimerNotificationService {
    if (!TimerNotificationService.instance) {
      TimerNotificationService.instance = new TimerNotificationService();
    }
    return TimerNotificationService.instance;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }

    return this.isSupported ? Notification.permission : 'denied';
  }

  public async showTimerNotification(goalName: string, startTime: number, goalId: string): Promise<void> {
    if (!this.isSupported || Notification.permission !== 'granted' || !Number.isFinite(startTime)) {
      return;
    }

    try {
      // Clear any existing notification
      this.clearNotification();

      // Create initial notification
      const elapsed = Date.now() - startTime;
      const timeString = this.formatTime(elapsed);
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // Use service worker for persistent notification
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_TIMER_NOTIFICATION',
          payload: {
            goalId,
            startTime,
            title: goalName,
            body: timeString,
            tag: 'timer-notification',
            requireInteraction: true,
            silent: true
          }
        });
      } else {
        // Fallback to regular notification
        this.fallbackNotification = new Notification(`⏱️ ${goalName}`, {
          body: `Timer: ${timeString}`,
          tag: 'timer-notification',
          requireInteraction: true,
          silent: true,
          icon: '/icon-192x192.svg'
        });
      }

      // Start updating the notification
      this.startNotificationUpdates(goalName, startTime, goalId);
    } catch (error) {
      console.error('Error showing timer notification:', error);
    }
  }

  public clearNotification(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.fallbackNotification?.close();
    this.fallbackNotification = null;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CLEAR_TIMER_NOTIFICATION'
      });
    }
  }

  private startNotificationUpdates(goalName: string, startTime: number, goalId: string): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const timeString = this.formatTime(elapsed);
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'UPDATE_TIMER_NOTIFICATION',
          payload: {
            goalId,
            startTime,
            title: goalName,
            body: timeString
          }
        });
      }
    }, 1000); // Update every second
  }

  private formatTime(elapsed: number): string {
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  public isNotificationSupported(): boolean {
    return this.isSupported;
  }

  public getPermissionStatus(): NotificationPermission {
    return this.isSupported ? Notification.permission : 'denied';
  }
}

export const timerNotificationService = TimerNotificationService.getInstance();
