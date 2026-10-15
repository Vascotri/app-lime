-- Adds Pharmacy, Gifts and Dog to the shopping list categories.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Widening a CHECK constraint only ever accepts more values, so existing rows
-- all still satisfy it and nothing needs rewriting.

ALTER TABLE shopping_items DROP CONSTRAINT IF EXISTS shopping_items_category_check;
ALTER TABLE shopping_items ADD CONSTRAINT shopping_items_category_check
  CHECK (category IN ('groceries','home','kids','pharmacy','gifts','dog','other'));
