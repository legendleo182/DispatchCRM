-- ============================================================================
-- DISPATCH CRM - Supabase Database Migration
-- Run this SQL in your Supabase SQL Editor to create the required table
-- ============================================================================

-- 1. Create the dispatch_entries table
CREATE TABLE IF NOT EXISTS dispatch_entries (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE NOT NULL,
  party_name      TEXT NOT NULL,
  rm              TEXT DEFAULT '',
  payment_mode    TEXT DEFAULT '' CHECK (payment_mode IN ('', 'Cash', 'Credit')),
  
  -- Pendency
  pendency_number TEXT DEFAULT NULL,
  pendency_closed BOOLEAN DEFAULT FALSE,
  
  -- Item Details
  item_name       TEXT DEFAULT '',
  mtr             TEXT DEFAULT '',
  grn_no          TEXT DEFAULT '',
  grn_complete    BOOLEAN DEFAULT FALSE,
  
  -- Pricing & Charges
  discount_enabled  BOOLEAN DEFAULT FALSE,
  discount_percent  NUMERIC(5,2) DEFAULT NULL,
  charges_enabled   BOOLEAN DEFAULT FALSE,
  charges_name      TEXT DEFAULT NULL,
  
  -- Dispatch Details
  dispatch_via    TEXT DEFAULT '',
  bill_no         TEXT DEFAULT '',
  bilty_no        TEXT DEFAULT '',
  
  -- Bilty Sharing
  bilty_whatsapp  BOOLEAN DEFAULT FALSE,
  bilty_website   BOOLEAN DEFAULT FALSE,
  
  -- Final Status
  dispatch_done   BOOLEAN DEFAULT FALSE,
  status          TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CLOSED')),
  
  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE dispatch_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Create RLS Policies (allow all operations for authenticated anon users)
--    For production, restrict these based on your auth requirements.
-- ============================================================================

-- SELECT policy: Allow anyone to read
CREATE POLICY "Allow SELECT for all"
  ON dispatch_entries
  FOR SELECT
  USING (true);

-- INSERT policy: Allow anyone to insert
CREATE POLICY "Allow INSERT for all"
  ON dispatch_entries
  FOR INSERT
  WITH CHECK (true);

-- UPDATE policy: Allow anyone to update
CREATE POLICY "Allow UPDATE for all"
  ON dispatch_entries
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE policy: Allow anyone to delete
CREATE POLICY "Allow DELETE for all"
  ON dispatch_entries
  FOR DELETE
  USING (true);

-- ============================================================================
-- 4. Create index on commonly queried columns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_dispatch_entries_date ON dispatch_entries (date DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_entries_status ON dispatch_entries (status);
CREATE INDEX IF NOT EXISTS idx_dispatch_entries_party ON dispatch_entries (party_name);
CREATE INDEX IF NOT EXISTS idx_dispatch_entries_created ON dispatch_entries (created_at DESC);

-- ============================================================================
-- 5. Trigger to auto-update `updated_at` on row modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dispatch_entries_updated_at
  BEFORE UPDATE ON dispatch_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. STORAGE BUCKET (for auto cloud sync of Excel file)
-- ============================================================================
-- Run this separately in your Supabase SQL Editor OR create the bucket via
-- Supabase Dashboard -> Storage -> New Bucket:
--   Bucket Name: dispatch-data
--   Public bucket: YES  (so anyone can download)
-- Then add Storage Policies below:
-- ============================================================================

-- Storage policy: Allow public SELECT (download)
CREATE POLICY "Allow public download"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'dispatch-data');

-- Storage policy: Allow public INSERT (upload)
CREATE POLICY "Allow public upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'dispatch-data');

-- Storage policy: Allow public UPDATE (overwrite)
CREATE POLICY "Allow public update"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'dispatch-data')
  WITH CHECK (bucket_id = 'dispatch-data');

-- ============================================================================
-- 7. DISPATCH ITEMS TABLE (Multi-Item Support)
--    Each dispatch entry can have 1-3 items stored in this table.
--    ON DELETE CASCADE ensures items are removed when entry is deleted.
-- ============================================================================
CREATE TABLE IF NOT EXISTS dispatch_items (
  id              BIGSERIAL PRIMARY KEY,
  entry_id        BIGINT NOT NULL REFERENCES dispatch_entries(id) ON DELETE CASCADE,
  item_name       TEXT DEFAULT '',
  mtr             TEXT DEFAULT '',
  grn_no          TEXT DEFAULT '',
  grn_complete    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for dispatch_items
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow SELECT for all items"
  ON dispatch_items
  FOR SELECT
  USING (true);

CREATE POLICY "Allow INSERT for all items"
  ON dispatch_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow UPDATE for all items"
  ON dispatch_items
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow DELETE for all items"
  ON dispatch_items
  FOR DELETE
  USING (true);

-- Index on entry_id for fast JOINs
CREATE INDEX IF NOT EXISTS idx_dispatch_items_entry_id ON dispatch_items (entry_id);

-- ============================================================================
-- DONE! Your dispatch_entries + dispatch_items tables + cloud storage are ready.
-- ============================================================================