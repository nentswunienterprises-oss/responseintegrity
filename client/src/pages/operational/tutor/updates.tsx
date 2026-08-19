import { NotificationInbox } from "@/components/notifications/NotificationInbox";

export default function TutorUpdates() {
  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <NotificationInbox
        title="Updates"
        description="Action-required items and informational notifications for tutors."
        emptyMessage="No notifications yet. You'll see action-required and informational updates here."
      />
    </div>
  );
}
