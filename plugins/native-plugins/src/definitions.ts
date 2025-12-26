export interface NotificationListenerPlugin {
  /**
   * Check if notification listener is enabled
   */
  isEnabled(): Promise<{ enabled: boolean }>;

  /**
   * Request notification listener permission
   */
  requestPermission(): Promise<{ enabled: boolean }>;

  /**
   * Start listening for bank notifications
   */
  startListening(): Promise<{ listening: boolean }>;

  /**
   * Stop listening for bank notifications
   */
  stopListening(): Promise<{ message: string }>;

  /**
   * Add listener for notification received events
   */
  addListener(
    eventName: 'notificationReceived',
    listenerFunc: (data: {
      packageName: string;
      appName: string;
      title: string;
      text: string;
      timestamp: number;
    }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

export interface SMSReaderPlugin {
  /**
   * Check if SMS read permission is granted
   */
  checkPermission(): Promise<{ granted: boolean }>;

  /**
   * Request SMS read permission
   */
  requestPermission(): Promise<{ granted: boolean }>;

  /**
   * Get recent SMS messages
   */
  getRecentSMS(options: { hours: number }): Promise<{
    messages: Array<{
      id: string;
      sender: string;
      body: string;
      timestamp: number;
    }>;
    count: number;
  }>;
}
