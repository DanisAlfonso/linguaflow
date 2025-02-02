alter table "public"."cards" drop constraint "cards_difficulty_range";

alter table "public"."cards" drop constraint "cards_retrievability_range";

alter table "public"."cards" drop constraint "cards_stability_positive";

drop function if exists "public"."update_deck_review_stats"(p_deck_id uuid);

alter table "public"."cards" add column "ease_factor" numeric(4,3) not null default 2.5;

alter table "public"."cards" add column "interval" integer not null default 0;

alter table "public"."cards" alter column "difficulty" drop not null;

alter table "public"."cards" alter column "elapsed_days" drop not null;

alter table "public"."cards" alter column "lapses" drop not null;

alter table "public"."cards" alter column "reps" drop not null;

alter table "public"."cards" alter column "retrievability" drop not null;

alter table "public"."cards" alter column "scheduled_days" drop not null;

alter table "public"."cards" alter column "stability" drop not null;

alter table "public"."cards" alter column "state" drop not null;

alter table "public"."cards" alter column "state" set data type smallint using "state"::smallint;

CREATE INDEX idx_cards_next_review ON public.cards USING btree (next_review_at);

CREATE INDEX idx_cards_state ON public.cards USING btree (state);

alter table "public"."cards" add constraint "cards_ease_factor_range" CHECK ((ease_factor >= 1.3)) not valid;

alter table "public"."cards" validate constraint "cards_ease_factor_range";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_deck_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if (tg_op = 'INSERT') then
    update public.decks
    set total_cards = total_cards + 1,
        new_cards = new_cards + 1
    where id = new.deck_id;
  elsif (tg_op = 'DELETE') then
    update public.decks
    set total_cards = total_cards - 1,
        new_cards = case 
          when old.review_count = 0 then new_cards - 1 
          else new_cards 
        end,
        cards_to_review = case 
          when old.next_review_at <= now() then cards_to_review - 1 
          else cards_to_review 
        end
    where id = old.deck_id;
  end if;
  return null;
end;
$function$
;

-- Add missing review tracking columns
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS consecutive_correct integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS next_review_at timestamptz;

-- Add last_studied_at column to decks table
ALTER TABLE decks
ADD COLUMN IF NOT EXISTS last_studied_at timestamptz;


