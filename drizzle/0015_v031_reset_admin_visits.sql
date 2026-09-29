-- Admin visits (Settings → Pristup podrške) count from this release on: earlier
-- "Uđi kao" entries were from testing, before owners could allow or refuse access.
DELETE FROM "audit_log" WHERE "action" IN ('impersonate.start', 'impersonate.stop');
