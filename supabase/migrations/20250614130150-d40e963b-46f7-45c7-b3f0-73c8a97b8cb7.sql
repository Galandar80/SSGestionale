
-- Aggiunge la colonna date_of_birth alla tabella members
ALTER TABLE public.members 
ADD COLUMN date_of_birth DATE;

-- Aggiunge un indice per migliorare le performance delle query sulla data di nascita
CREATE INDEX idx_members_date_of_birth ON public.members(date_of_birth);
