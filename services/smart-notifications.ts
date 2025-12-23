// services/smart-notifications.ts

import { LocalNotifications } from '@capacitor/local-notifications';
import { Expense } from '../types';

export class SmartNotifications {
  
  /**
   * Inizializza il servizio notifiche
   */
  static async init(): Promise<void> {
    try {
      const permission = await LocalNotifications.requestPermissions();
      
      if (permission.display !== 'granted') {
        console.log('⚠️ Notification permissions denied');
        return;
      }

      // Listener per click sulle notifiche
      LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (notification) => {
          this.handleNotificationClick(notification);
        }
      );

      console.log('✅ SmartNotifications initialized');
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }

  /**
   * Promemoria spese ricorrenti
   */
  static async scheduleRecurringReminder(
    count: number,
    date: Date = new Date()
  ): Promise<void> {
    // Schedula per domani alle 9:00
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 1001,
          title: '📅 Spese Ricorrenti',
          body: `Hai ${count} spese programmate questo mese`,
          schedule: { at: tomorrow },
          actionTypeId: 'OPEN_RECURRING',
          smallIcon: 'ic_stat_notification'
        }]
      });
      console.log(`✅ Scheduled recurring reminder for ${count} expenses`);
    } catch (error) {
      console.error('Error scheduling recurring reminder:', error);
    }
  }

  /**
   * Alert budget mensile superato
   */
  static async notifyBudgetWarning(
    spent: number,
    limit: number
  ): Promise<void> {
    const percentage = (spent / limit * 100).toFixed(0);
    
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 1002,
          title: '⚠️ Budget Mensile',
          body: `Hai speso €${spent.toFixed(2)} su €${limit.toFixed(2)} (${percentage}%)`,
          actionTypeId: 'OPEN_DASHBOARD',
          smallIcon: 'ic_stat_notification',
          sound: 'alert.wav'
        }]
      });
      console.log(`✅ Budget warning sent: ${percentage}%`);
    } catch (error) {
      console.error('Error sending budget warning:', error);
    }
  }

  /**
   * Riepilogo settimanale (ogni lunedì alle 9:00)
   */
  static async scheduleWeeklySummary(
    weeklyExpenses: number,
    previousWeek: number
  ): Promise<void> {
    const diff = weeklyExpenses - previousWeek;
    const trend = diff > 0 ? '📈' : '📉';
    const diffText = Math.abs(diff).toFixed(2);

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 1003,
          title: '📊 Riepilogo Settimanale',
          body: `Questa settimana: €${weeklyExpenses.toFixed(2)} (${trend} €${diffText})`,
          schedule: {
            on: {
              weekday: 1, // Lunedì
              hour: 9,
              minute: 0
            },
            repeats: true
          },
          actionTypeId: 'OPEN_DASHBOARD',
          smallIcon: 'ic_stat_notification'
        }]
      });
      console.log('✅ Weekly summary scheduled');
    } catch (error) {
      console.error('Error scheduling weekly summary:', error);
    }
  }

  /**
   * Notifica nuove transazioni pending
   */
  static async notifyPendingTransactions(count: number): Promise<void> {
    if (count === 0) return;

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 2000,
          title: '🔔 Nuove Transazioni',
          body: `${count} transazion${count === 1 ? 'e' : 'i'} rilevata da confermare`,
          actionTypeId: 'OPEN_PENDING_TRANSACTIONS',
          smallIcon: 'ic_stat_notification'
        }]
      });
      console.log(`✅ Pending transactions notification sent: ${count}`);
    } catch (error) {
      console.error('Error sending pending notification:', error);
    }
  }

  /**
   * Promemoria pagamento in scadenza
   */
  static async schedulePaymentReminder(
    expense: Expense,
    daysBefore: number = 1
  ): Promise<void> {
    const dueDate = new Date(expense.date);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);
    reminderDate.setHours(10, 0, 0, 0);

    // Non schedulare se è già passata
    if (reminderDate.getTime() < Date.now()) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now(), // ID univoco
          title: '⏰ Pagamento in Scadenza',
          body: `${expense.description} - €${expense.amount.toFixed(2)} domani`,
          schedule: { at: reminderDate },
          actionTypeId: 'OPEN_EXPENSE',
          extra: { expenseId: expense.id },
          smallIcon: 'ic_stat_notification'
        }]
      });
      console.log(`✅ Payment reminder scheduled for ${expense.description}`);
    } catch (error) {
      console.error('Error scheduling payment reminder:', error);
    }
  }

  /**
   * Bilancio giornaliero (ogni sera alle 20:00)
   */
  static async scheduleDailyBalance(balance: number): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 1004,
          title: '📊 Bilancio Giornaliero',
          body: `Saldo attuale: €${balance.toFixed(2)}`,
          schedule: {
            on: {
              hour: 20,
              minute: 0
            },
            repeats: true
          },
          actionTypeId: 'OPEN_DASHBOARD',
          smallIcon: 'ic_stat_notification'
        }]
      });
      console.log('✅ Daily balance scheduled');
    } catch (error) {
      console.error('Error scheduling daily balance:', error);
    }
  }

  /**
   * Gestione click notifiche
   */
  private static handleNotificationClick(notification: any): void {
    const actionType = notification.notification.actionTypeId;
    
    console.log('Notification clicked:', actionType);

    // Dispatch custom event per l'app
    window.dispatchEvent(
      new CustomEvent('notification-action', {
        detail: {
          actionType,
          extra: notification.notification.extra
        }
      })
    );

    switch (actionType) {
      case 'OPEN_RECURRING':
        window.history.pushState({ modal: 'recurring' }, '');
        break;
      case 'OPEN_PENDING_TRANSACTIONS':
        window.history.pushState({ modal: 'pending' }, '');
        break;
      case 'OPEN_DASHBOARD':
        window.history.pushState({ modal: 'home' }, '');
        break;
      case 'OPEN_EXPENSE':
        // Gestito dall'app via custom event
        break;
      case 'REVIEW_TRANSACTION':
        window.history.pushState({ modal: 'pending' }, '');
        break;
    }
  }

  /**
   * Cancella tutte le notifiche pending
   */
  static async cancelAllNotifications(): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
        console.log(`✅ Cancelled ${pending.notifications.length} notifications`);
      }
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  /**
   * Cancella notifica specifica
   */
  static async cancelNotification(id: number): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      console.log(`✅ Cancelled notification ${id}`);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }
}
