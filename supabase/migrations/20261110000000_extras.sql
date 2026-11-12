-- =====================================================================================
-- MathQuest · Extras: rankings, estadísticas, retos y reto diario.
-- Solo funciones de lectura (security definer) que agregan datos y devuelven lo justo:
-- así nadie necesita leer las partidas de otros para ver un ranking.
-- Contrato en docs/arquitectura.md.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Rankings
-- -------------------------------------------------------------------------------------

/**
 * Mejor puntuación de cada jugador en partidas terminadas.
 * p_periodo: 'global' (siempre) o 'semanal' (desde el lunes). Con p_sala_id, solo esa sala
 * (y solo si eres su docente, un admin o miembro).
 */
create function public.ranking(
  p_periodo text default 'global',
  p_sala_id uuid default null,
  p_limite integer default 20
)
returns table (
  posicion bigint,
  usuario_id uuid,
  nombre text,
  avatar text,
  mejor_puntos integer,
  partidas bigint,
  es_yo boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_desde timestamptz;
begin
  perform privado.exigir_activo();
  if p_periodo = 'semanal' then
    v_desde := date_trunc('week', now());
  elsif p_periodo is distinct from 'global' then
    raise exception 'PERIODO_INVALIDO';
  end if;
  if p_sala_id is not null and not privado.ve_sala(p_sala_id) then
    raise exception 'SIN_ACCESO_A_SALA' using errcode = '42501';
  end if;

  return query
  with mejores as (
    select p.usuario_id, max(p.puntos) as mejor, count(*) as jugadas
    from public.partidas p
    join public.usuarios u on u.id = p.usuario_id and u.activo
    where p.estado = 'terminada'
      and (p_sala_id is null or p.sala_id = p_sala_id)
      and (v_desde is null or p.terminada_en >= v_desde)
    group by p.usuario_id
  )
  select
    rank() over (order by m.mejor desc),
    m.usuario_id, u.nombre, u.avatar, m.mejor, m.jugadas,
    m.usuario_id = auth.uid()
  from mejores m
  join public.usuarios u on u.id = m.usuario_id
  order by m.mejor desc, u.nombre
  limit v_limite;
end
$$;

-- -------------------------------------------------------------------------------------
-- Estadísticas para el docente
-- -------------------------------------------------------------------------------------

/** Progreso de cada alumno de la sala (todas sus partidas en ella). Docente de la sala o admin. */
create function public.estadisticas_sala(p_sala_id uuid)
returns table (
  usuario_id uuid,
  nombre text,
  avatar text,
  partidas bigint,
  aciertos bigint,
  respuestas bigint,
  porcentaje_aciertos integer,
  mejor_puntos integer,
  nivel_max integer,
  ultima_partida timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not privado.es_docente_de_sala(p_sala_id) then
    raise exception 'SIN_ACCESO_A_SALA' using errcode = '42501';
  end if;
  return query
  select
    m.usuario_id, u.nombre, u.avatar,
    count(p.id) filter (where p.estado = 'terminada'),
    coalesce(sum(p.aciertos), 0)::bigint,
    coalesce(sum(p.respuestas_total), 0)::bigint,
    case when coalesce(sum(p.respuestas_total), 0) > 0
      then round(100.0 * sum(p.aciertos) / sum(p.respuestas_total))::integer end,
    coalesce(max(p.puntos), 0),
    coalesce(max(p.nivel), 0)::integer,
    max(p.iniciada_en)
  from public.sala_miembros m
  join public.usuarios u on u.id = m.usuario_id
  left join public.partidas p on p.sala_id = m.sala_id and p.usuario_id = m.usuario_id
  where m.sala_id = p_sala_id
  group by m.usuario_id, u.nombre, u.avatar
  order by u.nombre;
end
$$;

/** Comprueba quién puede ver las respuestas de una sala o de un usuario (ver errores_*). */
create function privado.exigir_acceso_respuestas(p_sala_id uuid, p_usuario_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_activo();
  if p_sala_id is not null then
    if not privado.es_docente_de_sala(p_sala_id) then
      raise exception 'SIN_ACCESO_A_SALA' using errcode = '42501';
    end if;
  elsif p_usuario_id is not null and p_usuario_id <> auth.uid() and not privado.es_admin() then
    raise exception 'SIN_ACCESO' using errcode = '42501';
  end if;
end
$$;

/**
 * Respuestas y fallos por operación. Con p_sala_id: los alumnos de esa sala (docente o admin),
 * opcionalmente de un solo alumno. Sin sala: las del usuario indicado (él mismo o un admin),
 * o las propias si no se indica nadie.
 */
create function public.errores_por_operacion(p_sala_id uuid default null, p_usuario_id uuid default null)
returns table (operacion public.operacion, respuestas bigint, fallos bigint, porcentaje_fallo integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_usuario uuid := case when p_sala_id is null then coalesce(p_usuario_id, auth.uid()) else p_usuario_id end;
begin
  perform privado.exigir_acceso_respuestas(p_sala_id, v_usuario);
  return query
  select
    r.operacion,
    count(*),
    count(*) filter (where not r.correcta),
    round(100.0 * count(*) filter (where not r.correcta) / count(*))::integer
  from public.respuestas r
  join public.partidas p on p.id = r.partida_id
  where (p_sala_id is null or p.sala_id = p_sala_id)
    and (v_usuario is null or p.usuario_id = v_usuario)
  group by r.operacion
  order by r.operacion;
end
$$;

/** Las operaciones concretas que más se fallan (p. ej. 7 × 8), con al menos p_minimo intentos. */
create function public.operaciones_dificiles(
  p_sala_id uuid default null,
  p_usuario_id uuid default null,
  p_limite integer default 10,
  p_minimo integer default 2
)
returns table (operacion public.operacion, a integer, b integer, resultado integer, intentos bigint, fallos bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_usuario uuid := case when p_sala_id is null then coalesce(p_usuario_id, auth.uid()) else p_usuario_id end;
begin
  perform privado.exigir_acceso_respuestas(p_sala_id, v_usuario);
  return query
  select r.operacion, r.a, r.b, r.resultado, count(*), count(*) filter (where not r.correcta)
  from public.respuestas r
  join public.partidas p on p.id = r.partida_id
  where (p_sala_id is null or p.sala_id = p_sala_id)
    and (v_usuario is null or p.usuario_id = v_usuario)
  group by r.operacion, r.a, r.b, r.resultado
  having count(*) >= greatest(coalesce(p_minimo, 2), 1) and count(*) filter (where not r.correcta) > 0
  order by count(*) filter (where not r.correcta)::numeric / count(*) desc, count(*) desc, r.a, r.b
  limit least(greatest(coalesce(p_limite, 10), 1), 50);
end
$$;

-- -------------------------------------------------------------------------------------
-- Perfil del jugador
-- -------------------------------------------------------------------------------------

/**
 * Resumen del jugador: totales, por origen y las últimas 10 partidas terminadas.
 * Lo ve el propio usuario, un admin o un docente que lo tiene en alguna sala.
 */
create function public.estadisticas_usuario(p_usuario_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_usuario uuid := coalesce(p_usuario_id, auth.uid());
  v_resultado jsonb;
begin
  perform privado.exigir_activo();
  if v_usuario <> auth.uid() and not privado.es_admin() and not privado.es_docente_de_alumno(v_usuario) then
    raise exception 'SIN_ACCESO' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'partidas', count(*),
    'puntos_max', coalesce(max(puntos), 0),
    'nivel_max', coalesce(max(nivel), 0),
    'aciertos', coalesce(sum(aciertos), 0),
    'respuestas', coalesce(sum(respuestas_total), 0),
    'precision', case when sum(respuestas_total) > 0 then round(100.0 * sum(aciertos) / sum(respuestas_total)) end,
    'monedas', coalesce(sum(monedas), 0),
    'jefe_derrotado', coalesce(bool_or(jefe_derrotado), false),
    'minutos_jugados', round(coalesce(sum(duracion_seg), 0) / 60.0),
    'por_origen', jsonb_build_object(
      'web', count(*) filter (where origen = 'web'),
      'movil', count(*) filter (where origen = 'movil'),
      'godot', count(*) filter (where origen = 'godot')
    )
  )
  into v_resultado
  from public.partidas
  where usuario_id = v_usuario and estado = 'terminada';

  return v_resultado || jsonb_build_object('ultimas', (
    select coalesce(jsonb_agg(to_jsonb(u) order by u.terminada_en desc), '[]'::jsonb)
    from (
      select id, origen, modo, puntos, nivel, aciertos, respuestas_total, jefe_derrotado, terminada_en
      from public.partidas
      where usuario_id = v_usuario and estado = 'terminada'
      order by terminada_en desc
      limit 10
    ) u
  ));
end
$$;

-- -------------------------------------------------------------------------------------
-- Estadísticas del sistema (admin)
-- -------------------------------------------------------------------------------------

create function public.estadisticas_sistema() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_admin() then
    raise exception 'SOLO_ADMIN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'usuarios', (
      select jsonb_build_object(
        'total', count(*),
        'admin', count(*) filter (where rol = 'admin'),
        'docente', count(*) filter (where rol = 'docente'),
        'alumno', count(*) filter (where rol = 'alumno'),
        'inactivos', count(*) filter (where not activo),
        'nuevos_semana', count(*) filter (where creado_en >= date_trunc('week', now()))
      )
      from public.usuarios
    ),
    'salas', (
      select jsonb_build_object('total', count(*), 'abiertas', count(*) filter (where estado = 'abierta'))
      from public.salas
    ),
    'partidas', (
      select jsonb_build_object(
        'total', count(*) filter (where estado = 'terminada'),
        'hoy', count(*) filter (where estado = 'terminada' and terminada_en >= date_trunc('day', now())),
        'semana', count(*) filter (where estado = 'terminada' and terminada_en >= date_trunc('week', now())),
        'en_curso', count(*) filter (where estado = 'en_curso'),
        'web', count(*) filter (where estado = 'terminada' and origen = 'web'),
        'movil', count(*) filter (where estado = 'terminada' and origen = 'movil'),
        'godot', count(*) filter (where estado = 'terminada' and origen = 'godot')
      )
      from public.partidas
    ),
    'respuestas', (
      select jsonb_build_object(
        'total', count(*),
        'precision', case when count(*) > 0 then round(100.0 * count(*) filter (where correcta) / count(*)) end
      )
      from public.respuestas
    ),
    -- Partidas terminadas por día en las dos últimas semanas (días sin partidas incluidos).
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia::date, 'partidas', coalesce(c.n, 0)) order by d.dia), '[]'::jsonb)
      from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as d(dia)
      left join (
        select date_trunc('day', terminada_en) as dia, count(*) as n
        from public.partidas
        where estado = 'terminada' and terminada_en >= date_trunc('day', now()) - interval '13 days'
        group by 1
      ) c on c.dia = d.dia
    )
  );
end
$$;

-- -------------------------------------------------------------------------------------
-- Retos
-- -------------------------------------------------------------------------------------

/** Retos de la sala con su progreso: cuántos miembros lo cumplieron y cómo voy yo. */
create function public.retos_sala(p_sala_id uuid)
returns table (
  id uuid,
  titulo text,
  descripcion text,
  tema public.tema_operacion,
  dificultad public.dificultad,
  meta_aciertos integer,
  fecha_limite timestamptz,
  creado_en timestamptz,
  cumplidos bigint,
  miembros bigint,
  mi_mejor integer,
  cumplido_por_mi boolean
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not privado.ve_sala(p_sala_id) then
    raise exception 'SIN_ACCESO_A_SALA' using errcode = '42501';
  end if;
  return query
  select
    r.id, r.titulo, r.descripcion, r.tema, r.dificultad, r.meta_aciertos, r.fecha_limite, r.creado_en,
    (select count(distinct p.usuario_id) from public.partidas p
      where p.reto_id = r.id and p.estado = 'terminada' and p.aciertos >= r.meta_aciertos),
    (select count(*) from public.sala_miembros m where m.sala_id = r.sala_id),
    (select coalesce(max(p.aciertos), 0) from public.partidas p
      where p.reto_id = r.id and p.usuario_id = auth.uid() and p.estado = 'terminada'),
    exists (select 1 from public.partidas p
      where p.reto_id = r.id and p.usuario_id = auth.uid() and p.estado = 'terminada' and p.aciertos >= r.meta_aciertos)
  from public.retos r
  where r.sala_id = p_sala_id
  order by r.creado_en desc;
end
$$;

/** Progreso de cada miembro en un reto (docente de la sala o admin). */
create function public.progreso_reto(p_reto_id uuid)
returns table (usuario_id uuid, nombre text, mejor_aciertos integer, intentos bigint, cumplido boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_reto public.retos;
begin
  select * into v_reto from public.retos where id = p_reto_id;
  if not found then
    raise exception 'RETO_NO_EXISTE';
  end if;
  if not privado.es_docente_de_sala(v_reto.sala_id) then
    raise exception 'SIN_ACCESO_A_SALA' using errcode = '42501';
  end if;
  return query
  select
    m.usuario_id, u.nombre,
    coalesce(max(p.aciertos), 0),
    count(p.id),
    coalesce(max(p.aciertos), 0) >= v_reto.meta_aciertos
  from public.sala_miembros m
  join public.usuarios u on u.id = m.usuario_id
  left join public.partidas p on p.reto_id = v_reto.id and p.usuario_id = m.usuario_id and p.estado = 'terminada'
  where m.sala_id = v_reto.sala_id
  group by m.usuario_id, u.nombre
  order by coalesce(max(p.aciertos), 0) desc, u.nombre;
end
$$;

/**
 * El reto del día, igual para todos (lo usa la app móvil): cambia de tema y de meta cada día.
 * Se juega con iniciar_partida(p_modo => 'diario'); se cumple con una partida terminada ese día
 * que llegue a la meta de aciertos.
 */
create function public.reto_diario(p_fecha date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_fecha date := coalesce(p_fecha, current_date);
  v_dia integer := extract(doy from v_fecha)::integer;
  v_tema text := (array['suma', 'resta', 'multiplicacion', 'mixta'])[1 + v_dia % 4];
  v_meta integer := (array[10, 15, 20])[1 + (v_dia / 4) % 3];
  v_mejor integer;
begin
  perform privado.exigir_activo();
  select coalesce(max(aciertos), 0) into v_mejor
  from public.partidas
  where usuario_id = auth.uid() and modo = 'diario' and estado = 'terminada'
    and terminada_en >= v_fecha and terminada_en < v_fecha + 1;
  return jsonb_build_object(
    'fecha', v_fecha,
    'tema', v_tema,
    'dificultad', case v_meta when 10 then 'facil' when 15 then 'media' else 'dificil' end,
    'meta_aciertos', v_meta,
    'mi_mejor', v_mejor,
    'completado', v_mejor >= v_meta
  );
end
$$;

-- -------------------------------------------------------------------------------------
-- Permisos: estas funciones solo para usuarios con sesión.
-- -------------------------------------------------------------------------------------

revoke execute on function
  public.ranking(text, uuid, integer),
  public.estadisticas_sala(uuid),
  public.errores_por_operacion(uuid, uuid),
  public.operaciones_dificiles(uuid, uuid, integer, integer),
  public.estadisticas_usuario(uuid),
  public.estadisticas_sistema(),
  public.retos_sala(uuid),
  public.progreso_reto(uuid),
  public.reto_diario(date),
  privado.exigir_acceso_respuestas(uuid, uuid)
from public, anon;

grant execute on function
  public.ranking(text, uuid, integer),
  public.estadisticas_sala(uuid),
  public.errores_por_operacion(uuid, uuid),
  public.operaciones_dificiles(uuid, uuid, integer, integer),
  public.estadisticas_usuario(uuid),
  public.estadisticas_sistema(),
  public.retos_sala(uuid),
  public.progreso_reto(uuid),
  public.reto_diario(date),
  privado.exigir_acceso_respuestas(uuid, uuid)
to authenticated, service_role;
