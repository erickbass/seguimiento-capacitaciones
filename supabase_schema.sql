-- =========================================================
-- ESQUEMA DE BASE DE DATOS SUPABASE - INTECAP CAPACITACIONES
-- =========================================================

-- 1. Tabla de Usuarios y Credenciales
CREATE TABLE IF NOT EXISTS public.users (
    username TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y políticas públicas de acceso
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a usuarios publicos" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Insertar usuarios por defecto
INSERT INTO public.users (username, role, password)
VALUES 
    ('Administrador', 'admin', 'admin'),
    ('Supervisor', 'supervisor', 'supervisor')
ON CONFLICT (username) DO NOTHING;


-- 2. Tabla de Eventos de Capacitación
CREATE TABLE IF NOT EXISTS public.events (
    id BIGSERIAL PRIMARY KEY,
    numero_evento TEXT UNIQUE NOT NULL,
    nombre_evento TEXT NOT NULL,
    nombre_producto TEXT,
    contraparte TEXT,
    consultor TEXT,
    instructor TEXT,
    fecha_inicio TEXT,
    fecha_fin TEXT,
    hombres_inscritos INTEGER DEFAULT 0,
    mujeres_inscritas INTEGER DEFAULT 0,
    total_inscritos INTEGER DEFAULT 0,
    estado_evento TEXT DEFAULT 'No inscrito',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y políticas públicas de acceso
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a eventos publicos" ON public.events FOR ALL USING (true) WITH CHECK (true);


-- 3. Tabla de Seguimientos / Bitácora de Compromisos
CREATE TABLE IF NOT EXISTS public.followups (
    id BIGSERIAL PRIMARY KEY,
    numero_evento TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "user" TEXT NOT NULL,
    note TEXT NOT NULL,
    evidence TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y políticas públicas de acceso
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a seguimientos publicos" ON public.followups FOR ALL USING (true) WITH CHECK (true);
