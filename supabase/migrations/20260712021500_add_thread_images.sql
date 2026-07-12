-- Add image_urls column to threads
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS image_urls text;

-- Grant permissions (already granted for table)
