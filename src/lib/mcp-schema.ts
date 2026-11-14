export const MCP_BOOKING_SCHEMA = `
  CREATE TABLE IF NOT EXISTS mcp_booking_requests (
    token_hash TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL,
    booking_reference TEXT NOT NULL UNIQUE REFERENCES bookings(reference) ON DELETE CASCADE,
    access_expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TRIGGER IF NOT EXISTS mcp_booking_requests_delete AFTER DELETE ON bookings
  BEGIN
    DELETE FROM mcp_booking_requests WHERE booking_reference=OLD.reference;
  END;
`;
