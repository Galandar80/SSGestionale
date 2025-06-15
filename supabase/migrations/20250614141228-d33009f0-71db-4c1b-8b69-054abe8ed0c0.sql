
-- Rimuovi il vincolo di unicità sull'email per permettere email vuote multiple
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_email_key;

-- Aggiungi un vincolo di unicità condizionale che si applica solo quando email non è vuota
CREATE UNIQUE INDEX members_email_unique_when_not_empty 
ON public.members (email) 
WHERE email IS NOT NULL AND email != '';
