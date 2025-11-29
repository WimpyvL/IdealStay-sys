-- Adds an archived_at column for per-user conversation archiving
ALTER TABLE conversation_participants
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL AFTER added_at;

-- Helpful index for queries filtering archived conversations per user
CREATE INDEX idx_cp_user_archived ON conversation_participants (user_id, archived_at);
