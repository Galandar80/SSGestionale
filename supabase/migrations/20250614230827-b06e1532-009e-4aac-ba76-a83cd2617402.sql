
-- Aggiungi la colonna portafoglio alla tabella budget_entries
ALTER TABLE public.budget_entries 
ADD COLUMN portafoglio TEXT NOT NULL DEFAULT 'contante';

-- Aggiungi un check constraint per validare i valori permessi
ALTER TABLE public.budget_entries 
ADD CONSTRAINT budget_entries_portafoglio_check 
CHECK (portafoglio IN ('contante', 'conto'));
