import { CommunicationInbox } from "@/components/communications/CommunicationInbox";
import { NotificationInbox } from "@/components/notifications/NotificationInbox";

export default function StudentUpdates() {
  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <CommunicationInbox
        audience="student"
        title="Student Inbox"
        description="Message your tutor on-platform and keep all training communication in one place."
        queryKey={["/api/student/communications"]}
        getPath="/api/student/communications"
        postPath="/api/student/communications"
        unreadCountPath="/api/student/communications/unread-count"
        updatesContent={
          <NotificationInbox
            title="Updates"
            description="Action-required items and informational notifications for students."
            emptyMessage="No notifications yet. You'll see action-required and informational updates here."
          />
        }
      />
    </div>
  );
}
