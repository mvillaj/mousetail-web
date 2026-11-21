-- Pinned coffees: an owner can pin bags to the top of their shelf.
-- A timestamp rather than a flag, so the most recently pinned sits first.
ALTER TABLE coffees ADD COLUMN pinned_at TEXT;
