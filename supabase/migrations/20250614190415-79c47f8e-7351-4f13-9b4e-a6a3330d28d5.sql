
-- Aggiungi il campo numero_socio alla tabella members
ALTER TABLE public.members ADD COLUMN numero_socio INTEGER;

-- Crea un indice unico per numero_socio (escludendo i valori NULL)
CREATE UNIQUE INDEX members_numero_socio_unique 
ON public.members (numero_socio) 
WHERE numero_socio IS NOT NULL;
