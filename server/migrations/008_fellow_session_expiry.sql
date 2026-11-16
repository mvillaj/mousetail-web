-- Fellow's access tokens now expire often enough to matter, and Fellow has no
-- refresh call we know of (the reverse-engineered clients just log in again).
--
-- expired_at records when Fellow first answered 401 to the stored token. The
-- connection stays, devices and email included, so the Fellow page can ask for
-- the password alone instead of making the user disconnect and start over.
-- NULL means the token was last seen working. A fresh /connect clears it.

ALTER TABLE fellow_connections ADD COLUMN expired_at TEXT;
