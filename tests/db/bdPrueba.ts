import { PGlite, type Transaction } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/*
 * Base de datos de pruebas: PostgreSQL real (PGlite, compilado a WebAssembly) dentro de Vitest,
 * sin Docker ni conexión. Se simulan las piezas de Supabase que usan las migraciones:
 * roles anon/authenticated/service_role, auth.users, auth.uid() y la publicación de Realtime.
 * Los permisos por defecto imitan a Supabase, que concede todo a anon y authenticated.
 */
const SIMULACION_SUPABASE = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  -- Igual que en Supabase: el id del usuario sale del JWT de la petición.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create publication supabase_realtime;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

const CARPETA_MIGRACIONES = join(import.meta.dirname, '..', '..', 'supabase', 'migrations')

export type Rol = 'admin' | 'docente' | 'alumno'
type Fila = Record<string, unknown>

export class BdPrueba {
  readonly pg: PGlite
  private contador = 0

  constructor(pg: PGlite) {
    this.pg = pg
  }

  /** Crea una cuenta como lo haría Supabase Auth (el trigger crea el perfil) y le asigna el rol. */
  async crearUsuario(rol: Rol = 'alumno', nombre?: string): Promise<string> {
    this.contador += 1
    const email = `${rol}${this.contador}@prueba.test`
    const { rows } = await this.pg.query<{ id: string }>(
      'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
      [email, JSON.stringify({ nombre: nombre ?? `${rol} ${this.contador}` })],
    )
    const id = rows[0].id
    if (rol !== 'alumno') {
      await this.pg.query('update public.usuarios set rol = $1 where id = $2', [rol, id])
    }
    return id
  }

  /** Ejecuta SQL como un usuario con sesión (rol authenticated + su JWT), igual que la API REST. */
  async como<T = Fila>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
    return this.pg.transaction(async (tx: Transaction) => {
      await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`)
      if (uid) await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
      const { rows } = await tx.query<T>(sql, params)
      return rows
    })
  }

  /** Llama a una función RPC con parámetros con nombre, como POST /rest/v1/rpc/<nombre>. */
  async rpc<T = Fila>(uid: string | null, nombre: string, args: Record<string, unknown> = {}): Promise<T[]> {
    const claves = Object.keys(args)
    const lista = claves.map((clave, i) => `${clave} => $${i + 1}`).join(', ')
    return this.como<T>(uid, `select * from public.${nombre}(${lista})`, claves.map((c) => args[c]))
  }

  /** Lo mismo que rpc() para funciones que devuelven un único valor (jsonb, enum…). */
  async rpcValor<T = unknown>(uid: string | null, nombre: string, args: Record<string, unknown> = {}): Promise<T> {
    const claves = Object.keys(args)
    const lista = claves.map((clave, i) => `${clave} => $${i + 1}`).join(', ')
    const filas = await this.como<{ valor: T }>(
      uid,
      `select public.${nombre}(${lista}) as valor`,
      claves.map((c) => args[c]),
    )
    return filas[0].valor
  }

  /** Consulta sin RLS (como el dueño de la base de datos), para comprobar resultados. */
  async admin<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pg.query<T>(sql, params)).rows
  }
}

export async function crearBdPrueba(): Promise<BdPrueba> {
  const pg = await PGlite.create()
  await pg.exec(SIMULACION_SUPABASE)
  const migraciones = readdirSync(CARPETA_MIGRACIONES).filter((f) => f.endsWith('.sql')).sort()
  for (const archivo of migraciones) {
    try {
      await pg.exec(readFileSync(join(CARPETA_MIGRACIONES, archivo), 'utf8'))
    } catch (error) {
      throw new Error(`Falló la migración ${archivo}: ${(error as Error).message}`, { cause: error })
    }
  }
  return new BdPrueba(pg)
}
