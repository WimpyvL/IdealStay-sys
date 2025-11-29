<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1zzA6PeXClrQv3_EUWNjrhyTTYpPqbtMR

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Realtime Messaging

The messaging system now supports realtime delivery using Socket.IO.

### Backend
* Socket.IO server initialized in `backend/src/server.ts` and shares the same HTTP port.
* Auth: Client provides JWT via `auth.token` in handshake (`auth: { token }`). If missing/invalid, socket connects but certain events may be ignored.
* Rooms:
   * `conv:{conversationId}` – participants join to receive `message:new` events.
   * `user:{userId}` – personal room for notification style updates (`conversation:update`).
* Events Emitted:
   * `message:new` `{ conversation_id, message }` – full message payload for an active conversation.
   * `conversation:update` `{ conversation_id, last_message }` – lightweight update for sidebar (unread counts/last message).

### Frontend
* Hook `src/hooks/useChatSocket.ts` manages connection & room membership.
* `MessagesPage` integrates the hook; shows a Live/Offline indicator.
* Optimistic send: UI updates instantly; if socket disconnected a timed refetch keeps state fresh.

### Environment Variables
No new env vars required. Ensure `VITE_API_BASE` (or base API URL) points to the same origin/port as the backend so the socket can reuse it. If hosting sockets separately, adjust the URL logic inside `useChatSocket`.

### Fallback Behavior
If the socket fails, message sending still works via HTTP and the page will refetch after send.

### Future Enhancements
* Typing indicators (add `conversation:typing` event).
* Presence (track online status via `user:{id}` room occupancy).
* Delivery / read receipts (emit after `markConversationRead`).

