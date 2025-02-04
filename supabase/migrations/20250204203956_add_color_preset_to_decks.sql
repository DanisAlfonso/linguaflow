-- Add color_preset column to decks table
ALTER TABLE decks
ADD COLUMN color_preset text;

-- Create an enum type for valid color presets
DO $$ BEGIN
    CREATE TYPE valid_color_preset AS ENUM ('blue', 'purple', 'green', 'orange', 'pink');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add check constraint to ensure only valid color presets are used
ALTER TABLE decks
ADD CONSTRAINT valid_color_preset_check
CHECK (color_preset IS NULL OR color_preset IN ('blue', 'purple', 'green', 'orange', 'pink'));
