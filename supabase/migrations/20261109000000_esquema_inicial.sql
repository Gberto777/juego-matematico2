-- =====================================================================================
-- MathQuest · Esquema inicial compartido por la web, la app móvil y el juego de Godot.
-- Documentación del modelo y de la API: docs/arquitectura.md
--
-- Principios de seguridad (los mismos que en las reglas de Firestore de la Actividad 3):
--   1. RLS activado en todas las tablas: sin una política que lo permita, no se ve nada.
--   2. Permisos por columna: cada rol solo puede escribir las columnas que le tocan.
--   3. Lo delicado (crear salas, unirse, puntajes, roles) pasa por funciones RPC que validan
--      en el servidor. Los aciertos los calcula la base de datos, no el cliente.
--   4. Los usuarios desactivados no pueden leer ni escribir nada salvo su propio perfil.
-- =====================================================================================

-- Funciones auxiliares que usan las políticas. No se exponen en la API REST.
create schema if not exists privado;

-- -------------------------------------------------------------------------------------
-- Tipos
-- -------------------------------------------------------------------------------------

create type public.rol_usuario as enum ('admin', 'docente', 'alumno');
/** Tema de una sala o reto. 'mixta' = progresión normal por niveles. */
create type public.tema_operacion as enum ('suma', 'resta', 'multiplicacion', 'mixta');
create type public.dificultad as enum ('facil', 'media', 'dificil');
create type public.estado_sala as enum ('abierta', 'cerrada');
create type public.origen_partida as enum ('web', 'movil', 'godot');
create type public.modo_partida as enum ('practica', 'sala', 'reto', 'diario');
/** 'abandonada': quedó en curso y el jugador empezó otra desde el mismo origen. */
create type public.estado_partida as enum ('en_curso', 'terminada', 'abandonada');
create type public.operacion as enum ('suma', 'resta', 'multiplicacion');

-- -------------------------------------------------------------------------------------
-- Tablas
-- -------------------------------------------------------------------------------------

-- Perfil de cada cuenta. Las credenciales viven en auth.users (Supabase Auth).
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null check (char_length(nombre) between 1 and 40),
  rol public.rol_usuario not null default 'alumno',
  -- Identificador de un avatar predefinido (ver docs), no una imagen subida.
  avatar text not null default 'buho' check (avatar ~ '^[a-z0-9_]{1,30}$'),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.salas (
  id uuid primary key default gen_random_uuid(),
  -- Prefijo según el tema + 4 cifras, p. ej. MIX-4821. Lo genera crear_sala().
  codigo text not null unique check (codigo ~ '^[A-Z]{3}-[0-9]{4}$'),
  nombre text not null check (char_length(nombre) between 1 and 60),
  docente_id uuid not null references public.usuarios (id) on delete cascade,
  tema public.tema_operacion not null default 'mixta',
  dificultad public.dificultad not null default 'media',
  max_jugadores integer not null default 30 check (max_jugadores between 1 and 100),
  estado public.estado_sala not null default 'abierta',
  creado_en timestamptz not null default now(),
  cerrada_en timestamptz
);
create index salas_docente_idx on public.salas (docente_id);

create table public.sala_miembros (
  sala_id uuid not null references public.salas (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  unido_en timestamptz not null default now(),
  -- Se actualiza con cada respuesta y con latido_sala(). "Conectado" = hace menos de 2 minutos.
  ultima_actividad timestamptz not null default now(),
  primary key (sala_id, usuario_id)
);
create index sala_miembros_usuario_idx on public.sala_miembros (usuario_id);

-- Tareas que el docente asigna a una sala.
create table public.retos (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references public.salas (id) on delete cascade,
  docente_id uuid not null default auth.uid() references public.usuarios (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 80),
  descripcion text not null default '' check (char_length(descripcion) <= 500),
  tema public.tema_operacion not null default 'mixta',
  dificultad public.dificultad not null default 'media',
  meta_aciertos integer not null check (meta_aciertos between 1 and 500),
  fecha_limite timestamptz,
  creado_en timestamptz not null default now()
);
create index retos_sala_idx on public.retos (sala_id);

create table public.partidas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  sala_id uuid references public.salas (id) on delete set null,
  reto_id uuid references public.retos (id) on delete set null,
  origen public.origen_partida not null,
  modo public.modo_partida not null default 'practica',
  estado public.estado_partida not null default 'en_curso',
  nivel_inicial smallint not null default 1 check (nivel_inicial between 1 and 4),
  -- Nivel alcanzado (1 sumas, 2 restas, 3 multiplicar, 4 mixtas).
  nivel smallint not null default 1 check (nivel between 1 and 4),
  puntos integer not null default 0 check (puntos >= 0),
  vidas smallint not null default 3 check (vidas between 0 and 10),
  -- Los calcula el trigger de respuestas: el cliente no puede escribirlos.
  aciertos integer not null default 0 check (aciertos >= 0),
  respuestas_total integer not null default 0 check (respuestas_total >= 0),
  -- Solo Godot: monedas recogidas y si venció al Rey del Caos.
  monedas integer not null default 0 check (monedas >= 0),
  jefe_derrotado boolean not null default false,
  duracion_seg integer not null default 0 check (duracion_seg >= 0),
  iniciada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  terminada_en timestamptz,
  check (aciertos <= respuestas_total)
);
create index partidas_usuario_idx on public.partidas (usuario_id, iniciada_en desc);
create index partidas_sala_idx on public.partidas (sala_id) where sala_id is not null;
create index partidas_terminadas_idx on public.partidas (terminada_en) where estado = 'terminada';

-- Cada operación respondida. resultado y correcta los calcula PostgreSQL.
create table public.respuestas (
  id bigint generated always as identity primary key,
  partida_id uuid not null references public.partidas (id) on delete cascade,
  operacion public.operacion not null,
  a integer not null check (a between 0 and 1000),
  b integer not null check (b between 0 and 1000),
  respuesta integer not null check (respuesta between -1000000 and 1000000),
  resultado integer generated always as (
    case operacion when 'suma' then a + b when 'resta' then a - b else a * b end
  ) stored,
  correcta boolean generated always as (
    respuesta = case operacion when 'suma' then a + b when 'resta' then a - b else a * b end
  ) stored,
  tiempo_ms integer check (tiempo_ms between 0 and 600000),
  creado_en timestamptz not null default now()
);
create index respuestas_partida_idx on public.respuestas (partida_id);

create table public.logros (
  id text primary key check (id ~ '^[a-z0-9_]{1,40}$'),
  nombre text not null,
  descripcion text not null,
  icono text not null,
  orden smallint not null default 0
);

create table public.usuario_logros (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  logro_id text not null references public.logros (id) on delete cascade,
  obtenido_en timestamptz not null default now(),
  primary key (usuario_id, logro_id)
);

insert into public.logros (id, nombre, descripcion, icono, orden) values
  ('primera_partida', 'Primeros pasos', 'Termina tu primera partida.', '🎮', 1),
  ('en_clase', 'Compañero de clase', 'Termina una partida dentro de una sala.', '🎒', 2),
  ('nivel_mixtas', 'Todoterreno', 'Llega al nivel 4 (operaciones mixtas).', '🔀', 3),
  ('diez_partidas', 'Constante', 'Termina 10 partidas.', '🔟', 4),
  ('cien_aciertos', 'Cien de cien', 'Acumula 100 respuestas correctas.', '💯', 5),
  ('precision_90', 'Puntería', 'Acierta el 90 % en una partida de al menos 20 respuestas.', '🎯', 6),
  ('quinientos_puntos', 'Goleador', 'Consigue 500 puntos en una sola partida.', '⭐', 7),
  ('reto_cumplido', 'Misión cumplida', 'Completa un reto de tu docente.', '🏅', 8),
  ('rey_derrotado', 'Salvador del reino', 'Derrota al Rey del Caos en MathQuest.', '👑', 9);

-- -------------------------------------------------------------------------------------
-- Funciones auxiliares (security definer: leen las tablas sin pasar por RLS y así
-- las políticas no se llaman a sí mismas en bucle)
-- -------------------------------------------------------------------------------------

create function privado.usuario_activo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = auth.uid() and activo)
$$;

create function privado.rol_actual() returns public.rol_usuario
language sql stable security definer set search_path = '' as $$
  select rol from public.usuarios where id = auth.uid() and activo
$$;

create function privado.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(privado.rol_actual() = 'admin', false)
$$;

/** Docente o admin (el admin puede hacer todo lo que hace un docente). */
create function privado.es_docente() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(privado.rol_actual() in ('docente', 'admin'), false)
$$;

create function privado.es_docente_de_sala(p_sala uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.es_admin() or (
    privado.usuario_activo()
    and exists (select 1 from public.salas where id = p_sala and docente_id = auth.uid())
  )
$$;

create function privado.es_miembro_de_sala(p_sala uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.usuario_activo()
    and exists (select 1 from public.sala_miembros where sala_id = p_sala and usuario_id = auth.uid())
$$;

create function privado.ve_sala(p_sala uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.es_docente_de_sala(p_sala) or privado.es_miembro_de_sala(p_sala)
$$;

/** ¿El usuario actual es docente de alguna sala en la que está p_usuario? */
create function privado.es_docente_de_alumno(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.usuario_activo() and exists (
    select 1
    from public.sala_miembros m
    join public.salas s on s.id = m.sala_id
    where m.usuario_id = p_usuario and s.docente_id = auth.uid()
  )
$$;

/** Lanza un error si el usuario actual no tiene sesión o está desactivado. */
create function privado.exigir_activo() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.usuario_activo() then
    raise exception 'USUARIO_INACTIVO' using errcode = '42501';
  end if;
end
$$;

-- -------------------------------------------------------------------------------------
-- Triggers
-- -------------------------------------------------------------------------------------

-- Cada cuenta nueva de Supabase Auth recibe su perfil. El rol SIEMPRE empieza en 'alumno':
-- nunca se lee de los metadatos, porque el propio usuario los puede escribir al registrarse.
create function privado.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := left(trim(coalesce(new.raw_user_meta_data ->> 'nombre', '')), 40);
begin
  if v_nombre = '' then
    v_nombre := left(split_part(coalesce(new.email, 'jugador'), '@', 1), 40);
  end if;
  insert into public.usuarios (id, email, nombre) values (new.id, coalesce(new.email, ''), v_nombre);
  return new;
end
$$;

create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function privado.crear_perfil();

create function privado.sincronizar_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.usuarios set email = coalesce(new.email, '') where id = new.id;
  return new;
end
$$;

create trigger sincronizar_email_de_auth
  after update of email on auth.users
  for each row execute function privado.sincronizar_email();

create function privado.marcar_actualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

create trigger usuarios_actualizado
  before update on public.usuarios
  for each row execute function privado.marcar_actualizado();

create function privado.registrar_cierre_sala() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado is distinct from old.estado then
    new.cerrada_en := case when new.estado = 'cerrada' then now() end;
  end if;
  return new;
end
$$;

create trigger salas_cierre
  before update on public.salas
  for each row execute function privado.registrar_cierre_sala();

-- Al guardar una respuesta: valida que la partida admite respuestas y actualiza sus contadores.
create function privado.contar_respuesta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_partida public.partidas;
begin
  select * into v_partida from public.partidas where id = new.partida_id for update;
  if v_partida.respuestas_total >= 5000 then
    raise exception 'DEMASIADAS_RESPUESTAS';
  end if;
  if v_partida.sala_id is not null
     and (select estado from public.salas where id = v_partida.sala_id) <> 'abierta' then
    raise exception 'SALA_CERRADA';
  end if;

  update public.partidas
  set aciertos = aciertos + (case when new.correcta then 1 else 0 end),
      respuestas_total = respuestas_total + 1,
      actualizada_en = now()
  where id = new.partida_id;

  if v_partida.sala_id is not null then
    update public.sala_miembros set ultima_actividad = now()
    where sala_id = v_partida.sala_id and usuario_id = v_partida.usuario_id;
  end if;
  return null;
end
$$;

create trigger respuestas_contar
  after insert on public.respuestas
  for each row execute function privado.contar_respuesta();

-- -------------------------------------------------------------------------------------
-- Logros
-- -------------------------------------------------------------------------------------

/** Concede los logros que el usuario ya cumple y devuelve los ids de los nuevos. */
create function privado.otorgar_logros(p_usuario uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_nuevos text[];
begin
  with stats as (
    select
      count(*) as partidas,
      coalesce(sum(aciertos), 0) as aciertos,
      coalesce(max(nivel), 0) as nivel_max,
      coalesce(max(puntos), 0) as puntos_max,
      coalesce(bool_or(jefe_derrotado), false) as jefe,
      count(*) filter (where sala_id is not null) as en_sala,
      coalesce(bool_or(respuestas_total >= 20 and aciertos * 100 >= respuestas_total * 90), false) as buena_precision
    from public.partidas
    where usuario_id = p_usuario and estado = 'terminada'
  ),
  cumplidos (id, ok) as (
    select 'primera_partida', partidas >= 1 from stats
    union all select 'en_clase', en_sala >= 1 from stats
    union all select 'nivel_mixtas', nivel_max >= 4 from stats
    union all select 'diez_partidas', partidas >= 10 from stats
    union all select 'cien_aciertos', aciertos >= 100 from stats
    union all select 'precision_90', buena_precision from stats
    union all select 'quinientos_puntos', puntos_max >= 500 from stats
    union all select 'rey_derrotado', jefe from stats
    union all select 'reto_cumplido', exists (
      select 1 from public.partidas p join public.retos r on r.id = p.reto_id
      where p.usuario_id = p_usuario and p.estado = 'terminada' and p.aciertos >= r.meta_aciertos
    )
  ),
  insertados as (
    insert into public.usuario_logros (usuario_id, logro_id)
    select p_usuario, id from cumplidos where ok
    on conflict do nothing
    returning logro_id
  )
  select coalesce(array_agg(logro_id), '{}') into v_nuevos from insertados;
  return v_nuevos;
end
$$;

-- -------------------------------------------------------------------------------------
-- RPC: administración de usuarios
-- -------------------------------------------------------------------------------------

/** Solo admin. Los parámetros nulos no se cambian. Crear cuentas: función Edge admin-crear-usuario. */
create function public.admin_actualizar_usuario(
  p_id uuid,
  p_nombre text default null,
  p_rol public.rol_usuario default null,
  p_activo boolean default null
) returns public.usuarios
language plpgsql security definer set search_path = '' as $$
declare
  v_usuario public.usuarios;
  v_nombre text := trim(p_nombre);
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN' using errcode = '42501';
  end if;
  -- Evita que el sistema se quede sin nadie que lo administre por un clic equivocado.
  if p_id = auth.uid() and ((p_rol is not null and p_rol <> 'admin') or p_activo is false) then
    raise exception 'NO_PUEDES_QUITARTE_ADMIN';
  end if;
  if v_nombre is not null and char_length(v_nombre) not between 1 and 40 then
    raise exception 'NOMBRE_INVALIDO';
  end if;

  update public.usuarios
  set nombre = coalesce(v_nombre, nombre),
      rol = coalesce(p_rol, rol),
      activo = coalesce(p_activo, activo)
  where id = p_id
  returning * into v_usuario;

  if not found then
    raise exception 'USUARIO_NO_EXISTE';
  end if;
  return v_usuario;
end
$$;

-- -------------------------------------------------------------------------------------
-- RPC: salas
-- -------------------------------------------------------------------------------------

create function public.crear_sala(
  p_nombre text,
  p_tema public.tema_operacion default 'mixta',
  p_dificultad public.dificultad default 'media',
  p_max_jugadores integer default 30
) returns public.salas
language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_prefijo text := case p_tema
    when 'suma' then 'SUM' when 'resta' then 'RES' when 'multiplicacion' then 'MUL' else 'MIX' end;
  v_sala public.salas;
begin
  if not privado.es_docente() then
    raise exception 'SOLO_DOCENTES' using errcode = '42501';
  end if;
  if char_length(v_nombre) not between 1 and 60 then
    raise exception 'NOMBRE_INVALIDO';
  end if;
  if p_max_jugadores is null or p_max_jugadores not between 1 and 100 then
    raise exception 'LIMITE_INVALIDO';
  end if;

  for intento in 1..20 loop
    begin
      insert into public.salas (codigo, nombre, docente_id, tema, dificultad, max_jugadores)
      values (
        v_prefijo || '-' || (1000 + floor(random() * 9000))::integer,
        v_nombre, auth.uid(), coalesce(p_tema, 'mixta'), coalesce(p_dificultad, 'media'), p_max_jugadores
      )
      returning * into v_sala;
      return v_sala;
    exception when unique_violation then
      null; -- Código ocupado: se prueba con otro.
    end;
  end loop;
  raise exception 'SIN_CODIGO_LIBRE';
end
$$;

/** Acepta el código con o sin guion y en minúsculas: "mix4821", "MIX-4821", "mix 4821". */
create function public.unirse_sala(p_codigo text) returns public.salas
language plpgsql security definer set search_path = '' as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_sala public.salas;
  v_miembros integer;
begin
  perform privado.exigir_activo();
  if v_codigo ~ '^[A-Z]{3}[0-9]{4}$' then
    v_codigo := substr(v_codigo, 1, 3) || '-' || substr(v_codigo, 4);
  end if;

  -- FOR UPDATE: si muchos alumnos entran a la vez, se atienden de uno en uno y el límite se respeta.
  select * into v_sala from public.salas where codigo = v_codigo for update;
  if not found then
    raise exception 'SALA_NO_EXISTE';
  end if;
  if v_sala.estado <> 'abierta' then
    raise exception 'SALA_CERRADA';
  end if;
  if v_sala.docente_id = auth.uid() then
    return v_sala;
  end if;

  update public.sala_miembros set ultima_actividad = now()
  where sala_id = v_sala.id and usuario_id = auth.uid();
  if found then
    return v_sala;
  end if;

  select count(*) into v_miembros from public.sala_miembros where sala_id = v_sala.id;
  if v_miembros >= v_sala.max_jugadores then
    raise exception 'SALA_LLENA';
  end if;

  insert into public.sala_miembros (sala_id, usuario_id) values (v_sala.id, auth.uid());
  return v_sala;
end
$$;

/** Marca al usuario como conectado. Devuelve el estado de la sala, o null si no es miembro. */
create function public.latido_sala(p_sala_id uuid) returns public.estado_sala
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_activo();
  update public.sala_miembros set ultima_actividad = now()
  where sala_id = p_sala_id and usuario_id = auth.uid();
  if not found then
    return null;
  end if;
  return (select estado from public.salas where id = p_sala_id);
end
$$;

/** Miembros de la sala con su partida en curso y sus mejores datos. Docente, admin o miembros. */
create function public.miembros_sala(p_sala_id uuid)
returns table (
  usuario_id uuid,
  nombre text,
  avatar text,
  unido_en timestamptz,
  ultima_actividad timestamptz,
  conectado boolean,
  jugando boolean,
  puntos integer,
  nivel smallint,
  vidas smallint,
  partidas_terminadas bigint,
  mejor_puntos integer
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not privado.ve_sala(p_sala_id) then
    raise exception 'SIN_ACCESO_A_SALA' using errcode = '42501';
  end if;
  return query
  select
    m.usuario_id, u.nombre, u.avatar, m.unido_en, m.ultima_actividad,
    m.ultima_actividad > now() - interval '2 minutes',
    actual.id is not null,
    actual.puntos, actual.nivel, actual.vidas,
    coalesce(hist.terminadas, 0),
    coalesce(hist.mejor, 0)
  from public.sala_miembros m
  join public.usuarios u on u.id = m.usuario_id
  left join lateral (
    select p.id, p.puntos, p.nivel, p.vidas from public.partidas p
    where p.sala_id = m.sala_id and p.usuario_id = m.usuario_id and p.estado = 'en_curso'
    order by p.iniciada_en desc limit 1
  ) actual on true
  left join lateral (
    select count(*) as terminadas, max(p.puntos) as mejor from public.partidas p
    where p.sala_id = m.sala_id and p.usuario_id = m.usuario_id and p.estado = 'terminada'
  ) hist on true
  where m.sala_id = p_sala_id
  order by u.nombre;
end
$$;

-- -------------------------------------------------------------------------------------
-- RPC: partidas
-- -------------------------------------------------------------------------------------

create function public.iniciar_partida(
  p_origen public.origen_partida,
  p_modo public.modo_partida default 'practica',
  p_nivel_inicial integer default 1,
  p_sala_id uuid default null,
  p_reto_id uuid default null
) returns public.partidas
language plpgsql security definer set search_path = '' as $$
declare
  v_modo public.modo_partida := coalesce(p_modo, 'practica');
  v_sala_id uuid := p_sala_id;
  v_reto public.retos;
  v_partida public.partidas;
begin
  perform privado.exigir_activo();
  if p_origen is null then
    raise exception 'ORIGEN_REQUERIDO';
  end if;
  if p_nivel_inicial is null or p_nivel_inicial not between 1 and 4 then
    raise exception 'NIVEL_INVALIDO';
  end if;

  if p_reto_id is not null then
    select * into v_reto from public.retos where id = p_reto_id;
    if not found then
      raise exception 'RETO_NO_EXISTE';
    end if;
    if v_reto.fecha_limite is not null and v_reto.fecha_limite < now() then
      raise exception 'RETO_VENCIDO';
    end if;
    v_modo := 'reto';
    v_sala_id := v_reto.sala_id;
  elsif v_modo = 'reto' then
    raise exception 'RETO_REQUERIDO';
  elsif v_sala_id is not null then
    v_modo := 'sala';
  elsif v_modo = 'sala' then
    raise exception 'SALA_REQUERIDA';
  end if;

  if v_sala_id is not null then
    if not privado.es_miembro_de_sala(v_sala_id) then
      raise exception 'NO_ES_MIEMBRO';
    end if;
    if (select estado from public.salas where id = v_sala_id) <> 'abierta' then
      raise exception 'SALA_CERRADA';
    end if;
    update public.sala_miembros set ultima_actividad = now()
    where sala_id = v_sala_id and usuario_id = auth.uid();
  end if;

  -- Una sola partida en curso por origen: la anterior se cerró sin terminar (se cerró la app, etc.).
  update public.partidas set estado = 'abandonada', terminada_en = now()
  where usuario_id = auth.uid() and origen = p_origen and estado = 'en_curso';

  insert into public.partidas (usuario_id, sala_id, reto_id, origen, modo, nivel_inicial, nivel)
  values (auth.uid(), v_sala_id, p_reto_id, p_origen, v_modo, p_nivel_inicial, p_nivel_inicial)
  returning * into v_partida;
  return v_partida;
end
$$;

/**
 * Envía el estado actual de la partida (puntos, nivel, vidas...). Con p_terminar = true la cierra
 * y concede logros. Devuelve { partida, logros_nuevos: [{ id, nombre, descripcion, icono }] }.
 * Las respuestas deben enviarse ANTES: los puntos se validan contra los aciertos registrados.
 */
create function public.actualizar_partida(
  p_partida_id uuid,
  p_puntos integer,
  p_nivel integer,
  p_vidas integer,
  p_monedas integer default 0,
  p_duracion_seg integer default 0,
  p_jefe_derrotado boolean default false,
  p_terminar boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_partida public.partidas;
  v_logros text[] := '{}';
begin
  perform privado.exigir_activo();
  select * into v_partida from public.partidas
  where id = p_partida_id and usuario_id = auth.uid()
  for update;
  if not found then
    raise exception 'PARTIDA_NO_EXISTE';
  end if;
  if v_partida.estado <> 'en_curso' then
    raise exception 'PARTIDA_TERMINADA';
  end if;

  -- Web: 10 × nivel por acierto (máx. 40). Godot: 10 por acierto + 50 al vencer al jefe.
  if p_puntos is null or p_puntos < 0 or p_puntos > v_partida.aciertos * 40 + 100 then
    raise exception 'PUNTOS_INVALIDOS';
  end if;
  if p_nivel is null or p_nivel not between v_partida.nivel_inicial and 4 then
    raise exception 'NIVEL_INVALIDO';
  end if;
  if p_vidas is null or p_vidas not between 0 and 10 then
    raise exception 'VIDAS_INVALIDAS';
  end if;
  if coalesce(p_monedas, 0) not between 0 and 100000
     or coalesce(p_duracion_seg, 0) not between 0 and 86400 then
    raise exception 'DATOS_INVALIDOS';
  end if;
  if coalesce(p_jefe_derrotado, false) and p_nivel < 4 then
    raise exception 'DATOS_INVALIDOS';
  end if;

  update public.partidas
  set puntos = p_puntos,
      nivel = p_nivel,
      vidas = p_vidas,
      monedas = coalesce(p_monedas, 0),
      duracion_seg = coalesce(p_duracion_seg, 0),
      jefe_derrotado = jefe_derrotado or coalesce(p_jefe_derrotado, false),
      actualizada_en = now(),
      estado = case when p_terminar then 'terminada'::public.estado_partida else estado end,
      terminada_en = case when p_terminar then now() else terminada_en end
  where id = p_partida_id
  returning * into v_partida;

  if p_terminar then
    v_logros := privado.otorgar_logros(auth.uid());
  end if;

  return jsonb_build_object(
    'partida', to_jsonb(v_partida),
    'logros_nuevos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'nombre', l.nombre, 'descripcion', l.descripcion, 'icono', l.icono
      ) order by l.orden), '[]'::jsonb)
      from public.logros l where l.id = any (v_logros)
    )
  );
end
$$;

-- -------------------------------------------------------------------------------------
-- Permisos. Supabase da por defecto TODOS los permisos de las tablas nuevas a anon y
-- authenticated (confía en RLS). Aquí se quitan y se conceden solo los necesarios.
-- service_role (la clave secreta del servidor) conserva sus permisos y no pasa por RLS.
-- -------------------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;

grant select on
  public.usuarios, public.salas, public.sala_miembros, public.retos,
  public.partidas, public.respuestas, public.logros, public.usuario_logros
to authenticated;

-- El propio usuario solo cambia su nombre y su avatar (rol y activo: admin_actualizar_usuario).
grant update (nombre, avatar) on public.usuarios to authenticated;
-- Crear salas: crear_sala(). El docente edita estas columnas y puede borrar la sala.
grant update (nombre, tema, dificultad, max_jugadores, estado) on public.salas to authenticated;
grant delete on public.salas to authenticated;
-- Entrar: unirse_sala(). Salir (alumno) o expulsar (docente): DELETE.
grant delete on public.sala_miembros to authenticated;
grant insert (sala_id, titulo, descripcion, tema, dificultad, meta_aciertos, fecha_limite) on public.retos to authenticated;
grant update (titulo, descripcion, tema, dificultad, meta_aciertos, fecha_limite) on public.retos to authenticated;
grant delete on public.retos to authenticated;
-- Partidas: iniciar_partida() y actualizar_partida(). Respuestas: INSERT directo (por lotes).
grant insert (partida_id, operacion, a, b, respuesta, tiempo_ms) on public.respuestas to authenticated;

-- Funciones: solo usuarios con sesión.
revoke execute on all functions in schema public, privado from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant usage on schema privado to authenticated, service_role;
grant execute on all functions in schema privado to authenticated, service_role;
-- Solo se llama desde actualizar_partida(); un cliente no debe poder conceder logros a nadie.
revoke execute on function privado.otorgar_logros(uuid) from authenticated;

-- Lo mismo para las tablas y funciones de migraciones futuras: nada abierto por defecto.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges revoke execute on functions from public;

-- -------------------------------------------------------------------------------------
-- Políticas RLS
-- -------------------------------------------------------------------------------------

alter table public.usuarios enable row level security;
alter table public.salas enable row level security;
alter table public.sala_miembros enable row level security;
alter table public.retos enable row level security;
alter table public.partidas enable row level security;
alter table public.respuestas enable row level security;
alter table public.logros enable row level security;
alter table public.usuario_logros enable row level security;

-- usuarios: cada uno ve su perfil (aunque esté desactivado, para avisarle); el admin ve todos;
-- el docente ve a los alumnos de sus salas.
create policy usuarios_ver on public.usuarios for select to authenticated
  using (id = (select auth.uid()) or privado.es_admin() or privado.es_docente_de_alumno(id));
create policy usuarios_editar_propio on public.usuarios for update to authenticated
  using (id = (select auth.uid()) and activo)
  with check (id = (select auth.uid()));

-- salas: las ven su docente, el admin y sus miembros. Para entrar con un código: unirse_sala().
create policy salas_ver on public.salas for select to authenticated
  using (privado.ve_sala(id));
create policy salas_editar on public.salas for update to authenticated
  using (privado.es_docente_de_sala(id))
  with check (privado.es_docente_de_sala(id));
create policy salas_borrar on public.salas for delete to authenticated
  using (privado.es_docente_de_sala(id));

create policy miembros_ver on public.sala_miembros for select to authenticated
  using ((usuario_id = (select auth.uid()) and privado.usuario_activo()) or privado.es_docente_de_sala(sala_id));
create policy miembros_salir_o_expulsar on public.sala_miembros for delete to authenticated
  using ((usuario_id = (select auth.uid()) and privado.usuario_activo()) or privado.es_docente_de_sala(sala_id));

create policy retos_ver on public.retos for select to authenticated
  using (privado.ve_sala(sala_id));
create policy retos_crear on public.retos for insert to authenticated
  with check (privado.es_docente_de_sala(sala_id) and docente_id = (select auth.uid()));
create policy retos_editar on public.retos for update to authenticated
  using (privado.es_docente_de_sala(sala_id))
  with check (privado.es_docente_de_sala(sala_id));
create policy retos_borrar on public.retos for delete to authenticated
  using (privado.es_docente_de_sala(sala_id));

create policy partidas_ver on public.partidas for select to authenticated
  using (
    (usuario_id = (select auth.uid()) and privado.usuario_activo())
    or privado.es_admin()
    or (sala_id is not null and privado.es_docente_de_sala(sala_id))
  );

-- Las respuestas se ven si se ve su partida (la subconsulta aplica la RLS de partidas).
create policy respuestas_ver on public.respuestas for select to authenticated
  using (exists (select 1 from public.partidas p where p.id = partida_id));
create policy respuestas_crear on public.respuestas for insert to authenticated
  with check (
    privado.usuario_activo()
    and exists (
      select 1 from public.partidas p
      where p.id = partida_id and p.usuario_id = (select auth.uid()) and p.estado = 'en_curso'
    )
  );

create policy logros_ver on public.logros for select to authenticated using (true);

create policy usuario_logros_ver on public.usuario_logros for select to authenticated
  using (
    (usuario_id = (select auth.uid()) and privado.usuario_activo())
    or privado.es_admin()
    or privado.es_docente_de_alumno(usuario_id)
  );

-- -------------------------------------------------------------------------------------
-- Tiempo real: el panel del docente escucha cambios en estas tablas (respetando RLS).
-- -------------------------------------------------------------------------------------

alter publication supabase_realtime add table public.salas, public.sala_miembros, public.partidas;
