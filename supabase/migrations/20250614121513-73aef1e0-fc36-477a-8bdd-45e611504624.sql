
-- Tabella per i soci
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  membership_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('attivo', 'sospeso', 'dimesso')),
  membership_fee BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per i movimenti di bilancio
CREATE TABLE public.budget_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrata', 'uscita')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per i verbali
CREATE TABLE public.meeting_minutes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('assemblea', 'consiglio', 'commissione')),
  participants INTEGER NOT NULL,
  content TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella per il bilancio preventivo
CREATE TABLE public.budget_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  planned_amount DECIMAL(10,2) NOT NULL,
  actual_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrata', 'uscita')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Aggiungere indici per migliorare le performance
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_members_email ON public.members(email);
CREATE INDEX idx_budget_entries_date ON public.budget_entries(date);
CREATE INDEX idx_budget_entries_type ON public.budget_entries(type);
CREATE INDEX idx_meeting_minutes_date ON public.meeting_minutes(date);
CREATE INDEX idx_meeting_minutes_type ON public.meeting_minutes(type);
CREATE INDEX idx_budget_plans_year ON public.budget_plans(year);
CREATE INDEX idx_budget_plans_type ON public.budget_plans(type);

-- Abilitare Row Level Security (RLS) su tutte le tabelle
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_plans ENABLE ROW LEVEL SECURITY;

-- Creare policy che permettono accesso completo (da modificare quando si implementerà l'autenticazione)
CREATE POLICY "Allow all access to members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to budget_entries" ON public.budget_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to meeting_minutes" ON public.meeting_minutes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to budget_plans" ON public.budget_plans FOR ALL USING (true) WITH CHECK (true);
