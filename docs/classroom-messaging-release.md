# Classroom and teacher messages

## Behavior
- Admin > 수업 운영 > 테스트 수업 loads active teachers and active ready textbooks with actual rendered pages (legacy `page_count` can be zero).
- A selected textbook is assigned to the isolated test enrollment without payment and selected on the new session. The normal teacher textbook selector remains assignment restricted. Only a signed admin test student can additionally assign/change a test textbook in class; observer mode remains read only.
- Desktop classroom uses Zoom / textbook / chat columns; at 1050px chat moves below, and at 640px all panels stack. Chat body and input are 16px; recent 100 messages are loaded rather than oldest 100. Textbook content flexes below its selector.
- Zoom participant role stays 0; only the assigned teacher uses host auth/ZAK. Joining no longer obscures SDK prompts behind a TALKLY loading overlay. Waiting participants retry every 10 seconds. Minimum video width is 240px, draggable placement is disabled, controls can scroll into view, and video sizing follows resize. Users still grant camera/mic access and select Join Audio / Start Video.
- Admin > 강사 전달사항 creates a conversation with one active teacher. Teachers receive a header unread badge (20-second polling, refresh on visibility) and a Messages menu. Both sides read/reply in the site, with shared admin read receipts. Inbox/dialog refresh every 15 seconds. No email or browser push is sent.
- Message bodies are plain text (1–5000 characters), subject 1–120, pages 30 conversations / 100 messages. Read receipts update only returned incoming message IDs. Browser cannot insert/update records or call the service-only send RPC; sending is atomic and server-authorized. Unrelated teachers cannot read/reply via API or RLS.

## Database
`supabase/migrations/20261023005902_teacher_messaging.sql` adds two RLS protected tables and a service-only atomic send RPC. Applied to TALKLY nvotgdovtxfzvmrrhxge. Existing lessons, recordings, and notification policies are unchanged. Initial auto-review required explicit recipient checks on message RLS; corrected before successful application.

## Validation
- Production Next build and TypeScript checks pass; changed TS/TSX lint passes.
- 30 automated test cases cover API authorization, spoofed senders, read-receipt filters, textbook restrictions, Zoom participant/host signatures and host waiting, signup and redirects; 22 terminal classroom routing scenarios also pass.
- DB transaction test verifies send/reply, other teacher denial, admin/recipient reads, anonymous denial, immutable browser writes and service-only RPC. Every fixture rolled back; no operational notice was sent.
- Security advisor reports no new issues for the messaging tables.
- Browser UI verification could not run: browser download was unavailable and cloud browser cannot connect to the local server. A UI fixture is kept only in scratch, not shipped.
- Real camera/mic communication needs Jennifer and the admin test student in separate browser sessions/devices. No new Zoom meetings or lesson data were created during this change.

## User verification after deployment
1. Create a test class, select Can You Believe It? 1~4, enter test student mode.
2. Assigned teacher enters separately and starts TALKLY and Zoom. Confirm both can join audio/start video and hear/see each other; check desktop and narrow views.
3. Confirm the textbook appears for both, change page as teacher, and check whiteboard/chat.
4. Admin writes an intended real notice to a selected teacher. Teacher sees unread badge, opens it, replies; admin sees reply and read receipt.
