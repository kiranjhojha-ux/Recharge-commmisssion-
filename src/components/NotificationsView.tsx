import React from 'react';
import { Bell, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatDateTimeHi } from '../lib/format';
import type { UserNotification } from '../types';

interface NotificationsViewProps {
  notifications: UserNotification[];
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ notifications }) => {
  const handleMarkRead = async (notificationId: string) => {
    const path = `notifications/${notificationId}`;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">सूचनाएं (Notifications)</h2>
        </div>
        <span className="text-xs text-slate-500">
          अपठित: {notifications.filter((n) => !n.isRead).length}
        </span>
      </div>

      {notifications.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">अभी कोई नई सूचना नहीं है।</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div
              key={n.notificationId}
              className={`flex flex-col justify-between gap-3 px-6 py-4 sm:flex-row sm:items-center ${
                n.isRead ? 'bg-white' : 'bg-blue-50/50'
              }`}
            >
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-900">{n.title}</div>
                <p className="text-xs leading-relaxed text-slate-600">{n.message}</p>
                <div className="text-[11px] text-slate-400">{formatDateTimeHi(n.createdAt)}</div>
              </div>
              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.notificationId)}
                  className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>पढ़ा हुआ चिह्नित करें</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
