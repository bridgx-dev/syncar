import type { Notification } from '../App'

interface NotificationsProps {
  notifications: Notification[]
}

export default function Notifications({ notifications }: NotificationsProps) {
  if (notifications.length === 0) {
    return null
  }

  return (
    <div className="notifications">
      {notifications.map((notification) => (
        <div key={notification.id} className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      ))}
    </div>
  )
}
