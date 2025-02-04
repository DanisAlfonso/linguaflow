import { supabase } from '../lib/supabase';

async function addColorPresetColumn() {
  try {
    // Add color_preset column
    await supabase.rpc('exec_sql', {
      query: `
        -- Add color_preset column to decks table
        ALTER TABLE decks
        ADD COLUMN IF NOT EXISTS color_preset text;

        -- Create an enum type for valid color presets
        DO $$ BEGIN
            CREATE TYPE valid_color_preset AS ENUM ('blue', 'purple', 'green', 'orange', 'pink');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;

        -- Add check constraint to ensure only valid color presets are used
        ALTER TABLE decks
        DROP CONSTRAINT IF EXISTS valid_color_preset_check;
        
        ALTER TABLE decks
        ADD CONSTRAINT valid_color_preset_check
        CHECK (color_preset IS NULL OR color_preset IN ('blue', 'purple', 'green', 'orange', 'pink'));
      `
    });

    console.log('Successfully added color_preset column to decks table');
  } catch (error) {
    console.error('Error adding color_preset column:', error);
    throw error;
  }
}

addColorPresetColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 