import React from 'react';
import { Info, CheckCircle2, AlertTriangle } from 'lucide-react';

interface NotificationsListProps {
  notifications: Array<{ id: string; text: string; time: string; type: 'info' | 'success' | 'warn' }>;
}

export const NotificationsList: React.FC<NotificationsListProps> = ({ notifications }) => {
  if (notifications.length === 0) return null;

  return (
    <aside className="fixed bottom-24 left-4 z-20 max-w-sm w-full pointer-events-none flex flex-col gap-1.5 overflow-hidden">
      {notifications.slice(0, 4).map((notif) => (
        <div
          key={notif.id}
          className={`px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-lg flex items-center gap-2 text-xs transition-all pointer-events-auto ${
            notif.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-200'
              : notif.type === 'warn'
              ? 'bg-amber-950/80 border-amber-700/60 text-amber-200'
              : 'bg-neutral-900/80 border-neutral-700/60 text-neutral-200'
          }`}
        >
          {notif.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : notif.type === 'warn' ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : (
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          )}
          <span className="truncate">{notif.text}</span>
          <span className="text-[9px] text-neutral-400 ml-auto shrink-0">{notif.time}</span>
        </div>
      ))}
    </aside>
  );
};
