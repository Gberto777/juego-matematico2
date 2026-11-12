import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react'
import { useAuth } from '../../auth/contexto'
import { esCodigoSalaValido, normalizarCodigoSala } from '../../utils/codigoSala'
import { routeToHash } from '../../utils/routes'
import PortalVivo from './PortalVivo'
import './inicio.css'

/** Capturas reales del juego en Godot (public/inicio). */
const img = (nombre: string) => `${import.meta.env.BASE_URL}inicio/${nombre}.webp`

const REGIONES = [
  {
    campo: 'campo-bosque',
    imagen: 'bosque',
    alt: 'Mati corre por el bosque hacia un portal con los números 7, 8 y 6 mientras arriba se lee 3 + 3',
    clausula: 'Primero, el bosque: sumas.',
    detalle: 'Cinco aciertos abren el camino a la región siguiente.',
  },
  {
    campo: 'campo-cueva',
    imagen: 'cueva',
    alt: 'Mati corre por una cueva azul llena de cristales hacia un portal con 4, 1 y 2 para resolver 3 − 2',
    clausula: 'Luego, la cueva: restas.',
    detalle: 'Restas que nunca dan negativo, entre cristales.',
  },
  {
    campo: 'campo-volcan',
    imagen: 'volcan',
    alt: 'Mati corre entre ríos de lava hacia un portal con 27, 30 y 40 para resolver 10 × 3',
    clausula: 'Después, el volcán: multiplicar.',
    detalle: 'Las tablas del 1 al 10, con la lava a los lados.',
  },
  {
    campo: 'campo-corona',
    imagen: 'castillo',
    alt: 'Mati corre por el Castillo del Caos, entre torres y estandartes, hacia un portal con 56, 63 y 16 para resolver 7 × 9',
    clausula: 'Al final, el castillo: de todo.',
    detalle: 'Sumas, restas y tablas mezcladas, y el Rey del Caos.',
  },
]

const CARTAS = [
  {
    titulo: 'Tres vidas',
    campo: 'campo-bosque',
    imagen: 'bosque',
    posicion: '20% 0%',
    alt: 'Los tres corazones y la operación en la parte de arriba de la pantalla del juego',
    texto: 'Cada portal equivocado te quita un corazón. Sin corazones, se acaba la partida.',
    giro: '-3deg',
  },
  {
    titulo: 'Elige el portal',
    campo: 'campo-cueva',
    imagen: 'volcan',
    posicion: '50% 38%',
    alt: 'Un portal con tres puertas y los números 27, 30 y 40',
    texto: 'Cambia de carril y cruza la puerta con el resultado. Cada acierto suma 10 puntos.',
    giro: '2deg',
  },
  {
    titulo: 'Salta y barre',
    campo: 'campo-volcan',
    imagen: 'volcan-2',
    posicion: '50% 52%',
    alt: 'Mati corre por la pista del volcán, con obstáculos y lava a los lados',
    texto: 'Esquiva rocas, troncos y muros saltando, barriéndote o cambiando de carril, y recoge monedas.',
    giro: '-2deg',
  },
  {
    titulo: 'Vence al Rey',
    campo: 'campo-corona',
    imagen: 'rey-del-caos',
    posicion: '22% 86%',
    alt: 'El Rey del Caos habla en un cuadro de diálogo del juego',
    texto: 'En el castillo aparece el Rey del Caos. Cinco respuestas correctas lo derrotan.',
    giro: '4deg',
  },
]

const PREGUNTAS = [
  {
    pregunta: '¿Para qué edades es?',
    respuesta:
      'Para primaria. Las sumas y restas van del 1 al 20 y la multiplicación son las tablas del 1 al 10. Cada partida empieza en el nivel que elijas.',
  },
  {
    pregunta: '¿Hace falta una cuenta?',
    respuesta:
      'Para la práctica rápida, no. Para entrar a las salas de tu clase, sí: puedes crearla con tu correo o pedírsela a tu docente. Es la misma cuenta en la web, la app y el juego.',
  },
  {
    pregunta: '¿Cómo entra mi clase a una sala?',
    respuesta:
      'El docente crea una sala y proyecta su código, por ejemplo MUL-4821. Cada alumno lo escribe en «Mis salas» o abre el enlace de la sala, y empieza a jugar.',
  },
  {
    pregunta: '¿Qué ve el docente?',
    respuesta:
      'Quién está conectado, en qué nivel va cada alumno, sus puntos y sus vidas en ese momento, cuántas partidas terminó y su mejor puntuación en la sala.',
  },
  {
    pregunta: '¿Qué datos se guardan?',
    respuesta:
      'Tu nombre, tu correo y cada respuesta de tus partidas (la operación y el número que elegiste), para que tu progreso y el de la clase se puedan seguir. La base de datos solo deja ver tus partidas a ti, a tu docente y al administrador.',
  },
  {
    pregunta: '¿Cuándo sale para Android?',
    respuesta:
      'El juego 3D todavía no está publicado como APK. Cuando lo esté, aparecerá en la sección de descargas de esta página.',
  },
]

/** La captura principal se abre como una persiana la primera vez que se ve. */
function Persiana({ children }: { children: ReactNode }) {
  const nodo = useRef<HTMLDivElement>(null)
  const [visto, setVisto] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (visto || !nodo.current) return
    const observador = new IntersectionObserver(([entrada]) => entrada?.isIntersecting && setVisto(true), {
      rootMargin: '0px 0px -12% 0px',
    })
    observador.observe(nodo.current)
    return () => observador.disconnect()
  }, [visto])
  return (
    <div ref={nodo} className={visto ? 'mq-persiana-lista' : 'mq-persiana'}>
      {children}
    </div>
  )
}

/** Las secciones aparecen al llegar a ellas (solo si hay script; sin él, todo está visible). */
function useEntradas(raiz: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const nodo = raiz.current
    if (!nodo || typeof IntersectionObserver === 'undefined') return
    nodo.classList.add('mq-anim')
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          entrada.target.setAttribute('data-visto', '')
          observador.unobserve(entrada.target)
        }
      },
      { rootMargin: '0px 0px -4% 0px' },
    )
    nodo.querySelectorAll('[data-entra]').forEach((el) => observador.observe(el))
    return () => observador.disconnect()
  }, [raiz])
}

/** En escritorio, las cartas se reparten una a una mientras la sección está fija en pantalla. */
function useReparto(pista: RefObject<HTMLDivElement | null>, total: number): number | null {
  const [repartidas, setRepartidas] = useState<number | null>(null)
  useEffect(() => {
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ancho = window.matchMedia?.('(min-width: 900px)')
    if (quieto || !ancho) return
    let marco = 0
    const medir = () => {
      marco = 0
      const nodo = pista.current
      if (!nodo || !ancho.matches) {
        setRepartidas(null)
        return
      }
      const caja = nodo.getBoundingClientRect()
      const recorrido = Math.max(1, caja.height - window.innerHeight)
      const avance = Math.min(1, Math.max(0, -caja.top / recorrido))
      setRepartidas(Math.min(total, 1 + Math.floor(avance * total * 1.1)))
    }
    const alMover = () => {
      if (!marco) marco = requestAnimationFrame(medir)
    }
    medir()
    window.addEventListener('scroll', alMover, { passive: true })
    window.addEventListener('resize', alMover)
    return () => {
      window.removeEventListener('scroll', alMover)
      window.removeEventListener('resize', alMover)
      if (marco) cancelAnimationFrame(marco)
    }
  }, [pista, total])
  return repartidas
}

function Escenario({ opcion }: { opcion: number }) {
  if (opcion === 0) {
    return (
      <div className="mq-escenario-contenido" key="juego">
        <Persiana>
          <img
            src={img('menu')}
            width={540}
            height={960}
            alt="Menú de MathQuest Runner: elegir héroe y nivel, récords y el botón Comenzar"
          />
        </Persiana>
        <p className="pie">
          MathQuest en Godot: eliges a tu héroe y el nivel, y a correr. Tus récords, monedas y la corona del Rey vencido
          quedan en el menú.
        </p>
      </div>
    )
  }
  if (opcion === 1) {
    return (
      <div className="mq-escenario-contenido" key="web">
        <div className="mq-ui-juego" data-ui aria-label="Pantalla de la práctica rápida en la web">
          <div className="barra">
            <span>Nivel 2 · Restas</span>
            <span>40 puntos · 3 vidas</span>
          </div>
          <div className="tarjeta">9 − 4</div>
          <div className="respuesta">
            <span>5</span>
            <b>Responder</b>
          </div>
        </div>
        <p className="pie">
          La práctica rápida de esta web: escribes el resultado, subes de nivel cada cinco aciertos y cuidas tus tres
          vidas. No hace falta instalar nada.
        </p>
      </div>
    )
  }
  return (
    <div className="mq-escenario-contenido" key="sala">
      <div className="mq-ui-sala" data-ui aria-label="Ejemplo del panel de una sala de clase">
        <div className="cabeza">
          Código para entrar
          <strong>MUL-4821</strong>
        </div>
        <table>
          <tbody>
            <tr>
              <td>
                <span className="punto" />
                Ana
              </td>
              <td>Jugando · nivel 3 · 120 pts</td>
            </tr>
            <tr>
              <td>
                <span className="punto" />
                Beto
              </td>
              <td>En espera · mejor 80</td>
            </tr>
            <tr>
              <td>
                <span className="punto" />
                Carla
              </td>
              <td>Jugando · nivel 3 · 30 pts</td>
            </tr>
            <tr>
              <td>
                <span className="punto no" />
                Dani
              </td>
              <td>Visto hace 14 min</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="pie">
        La sala de clase: el docente proyecta el código y ve en vivo quién está conectado, en qué nivel va cada uno y
        cuántos puntos lleva.
      </p>
    </div>
  )
}

function EnlaceCuenta() {
  const { auth } = useAuth()
  if (auth.estado === 'sesion') {
    return (
      <a className="mq-boton" href="#/cuenta">
        Mi cuenta
      </a>
    )
  }
  if (auth.estado === 'anonimo') {
    return (
      <a className="mq-boton" href="#/entrar">
        Entrar
      </a>
    )
  }
  return (
    <a className="mq-boton" href={routeToHash({ name: 'solo' })}>
      Jugar
    </a>
  )
}

function Item({ imagen, nombre, listo, children }: { imagen: string; nombre: string; listo: boolean; children: ReactNode }) {
  return (
    <li className="mq-item" data-entra>
      <img src={img(imagen)} width={64} height={64} alt="" loading="lazy" />
      <div className="linea">
        <h4 style={{ margin: 0, font: 'inherit' }}>{nombre}</h4>
        <span className={`estado${listo ? ' listo' : ''}`}>{listo ? 'Disponible' : 'Pronto'}</span>
      </div>
      <div>{children}</div>
    </li>
  )
}

function FormularioCodigo() {
  const [codigo, setCodigo] = useState('')
  const [nota, setNota] = useState('Si aún no has entrado con tu cuenta, te lo pediremos antes.')

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const normalizado = normalizarCodigoSala(codigo)
    if (!esCodigoSalaValido(normalizado)) {
      setNota('El código tiene 3 letras y 4 números, como MUL-4821.')
      return
    }
    window.location.hash = routeToHash({ name: 'studentRoom', code: normalizado })
  }

  return (
    <>
      <form onSubmit={enviar} noValidate data-entra style={{ '--orden': 1 } as CSSProperties}>
        <label htmlFor="codigo-sala">Mi sala es</label>
        <input
          id="codigo-sala"
          value={codigo}
          onChange={(e) => setCodigo(normalizarCodigoSala(e.target.value))}
          placeholder="MUL-4821"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby="codigo-nota"
        />
        <button type="submit">Entrar</button>
      </form>
      <p id="codigo-nota" className="nota" role="status">
        {nota}
      </p>
    </>
  )
}

const BLOQUES = [
  { letra: 'M', campo: 'campo-bosque', alto: 100 },
  { letra: 'A', campo: 'campo-cueva', alto: 76 },
  { letra: 'T', campo: 'campo-volcan', alto: 90 },
  { letra: 'H', campo: 'campo-corona', alto: 64 },
  { letra: 'Q', campo: 'campo-bosque', alto: 96 },
  { letra: 'U', campo: 'campo-cueva', alto: 70 },
  { letra: 'E', campo: 'campo-volcan', alto: 86 },
  { letra: 'S', campo: 'campo-corona', alto: 60 },
  { letra: 'T', campo: 'campo-bosque', alto: 82 },
]

/** Página informativa de MathQuest: qué es, cómo se juega, dónde se juega, descargas y preguntas. */
function PaginaInicio() {
  const raiz = useRef<HTMLDivElement>(null)
  const pista = useRef<HTMLDivElement>(null)
  const [pantalla, setPantalla] = useState(0)
  const repartidas = useReparto(pista, CARTAS.length)
  useEntradas(raiz)

  return (
    <div className="mq" ref={raiz}>
      <header className="mq-nav">
        <a className="mq-marca" href="#/">
          MathQuest
        </a>
        <nav aria-label="Secciones">
          <ul>
            <li className="solo-ancho">
              <a className="enlace" href="#como-se-juega">
                Cómo se juega
              </a>
            </li>
            <li className="solo-ancho">
              <a className="enlace" href="#descargas">
                Descargas
              </a>
            </li>
            <li className="solo-ancho">
              <a className="enlace" href="#preguntas">
                Preguntas
              </a>
            </li>
            <li>
              <EnlaceCuenta />
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <section className="mq-portada" aria-labelledby="titulo-inicio">
          <div className="mq-portada-texto">
            <h1 id="titulo-inicio">MathQuest: corre y calcula</h1>
            <p>
              Un juego en 3D para primaria. Mati corre por cuatro regiones y solo avanza si cruza el portal con la
              respuesta correcta. Pruébalo aquí mismo.
            </p>
            <a className="mq-boton" href={routeToHash({ name: 'solo' })}>
              Jugar en la web
            </a>
          </div>
          <PortalVivo />
        </section>

        <section className="mq-regiones" id="regiones" aria-labelledby="titulo-regiones">
          {REGIONES.map((r, i) => (
            <div key={r.imagen} className={`mq-region ${r.campo}`}>
              {i === 0 && (
                <h2 id="titulo-regiones" data-entra>
                  Cuatro regiones
                </h2>
              )}
              <p className="clausula" data-entra style={{ '--orden': 1 } as CSSProperties}>
                {r.clausula}
              </p>
              <p className="detalle" data-entra style={{ '--orden': 2 } as CSSProperties}>
                {r.detalle}
              </p>
              <img className="mq-captura" src={img(r.imagen)} width={540} height={960} alt={r.alt} loading="lazy" />
            </div>
          ))}
        </section>

        <section className="mq-pantallas" id="pantallas" aria-labelledby="titulo-pantallas">
          <div className="mq-pantallas-indice">
            <h2 id="titulo-pantallas" data-entra>
              Dónde se juega
            </h2>
            <p data-entra style={{ '--orden': 1 } as CSSProperties}>
              Una sola cuenta para el juego 3D, la web y la sala de clase.
            </p>
            <ul className="mq-opciones" aria-label="Elige una pantalla">
              {['El juego 3D', 'La práctica web', 'La sala de clase'].map((nombre, i) => (
                <li key={nombre}>
                  <button type="button" aria-pressed={pantalla === i} onClick={() => setPantalla(i)}>
                    {nombre}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mq-escenario" aria-live="polite">
            <Escenario opcion={pantalla} />
          </div>
        </section>

        <section
          className="mq-abanico"
          id="como-se-juega"
          aria-labelledby="titulo-como"
          data-repartidas={repartidas === null ? undefined : repartidas}
        >
          <div className="mq-abanico-pista" ref={pista}>
            <div className="mq-abanico-escena">
              <div className="mq-abanico-cabecera">
                <h2 id="titulo-como" data-entra>
                  Así se juega
                </h2>
                <p data-entra style={{ '--orden': 1 } as CSSProperties}>
                  Mati corre solo. Tú decides el carril, saltas y te barres: con flechas o A, D, W y S en la computadora,
                  deslizando el dedo en el celular.
                </p>
              </div>
              <ul className="mq-cartas">
                {CARTAS.map((c, i) => (
                  <li
                    key={c.titulo}
                    className={`mq-carta ${c.campo}`}
                    style={{ '--i': i, '--giro': c.giro } as CSSProperties}
                    data-oculta={repartidas !== null && i >= repartidas ? '' : undefined}
                  >
                    <h3>{c.titulo}</h3>
                    <img
                      src={img(c.imagen)}
                      width={200}
                      height={200}
                      alt={c.alt}
                      loading="lazy"
                      style={{ objectPosition: c.posicion }}
                    />
                    <p>{c.texto}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mq-descargas" id="descargas" aria-labelledby="titulo-descargas">
          <h2 id="titulo-descargas" data-entra>
            Descargas
          </h2>
          <p data-entra style={{ '--orden': 1 } as CSSProperties}>
            Lo que ya puedes usar hoy y lo que llega pronto. Todo comparte la misma cuenta y el mismo progreso.
          </p>

          <div className="mq-categoria">
            <h3>Para jugar</h3>
            <span>3 formas</span>
          </div>
          <ul className="mq-items">
            <Item imagen="bosque-2" nombre="Práctica rápida en la web" listo>
              <p>Sumas, restas y tablas en cualquier navegador, sin instalar nada.</p>
              <a href={routeToHash({ name: 'solo' })}>Jugar ahora</a>
            </Item>
            <Item imagen="menu" nombre="MathQuest 3D para Android" listo={false}>
              <p>El juego completo en el celular: las cuatro regiones, los héroes y el Rey del Caos. El APK aparecerá aquí.</p>
            </Item>
            <Item imagen="castillo" nombre="MathQuest 3D en el navegador" listo={false}>
              <p>La misma aventura en 3D, para jugarla desde la web sin descargar nada.</p>
            </Item>
          </ul>

          <div className="mq-categoria">
            <h3>Para el aula</h3>
            <span>2 herramientas</span>
          </div>
          <ul className="mq-items">
            <Item imagen="cueva" nombre="Salas de clase" listo>
              <p>El docente crea la sala y comparte el código; los alumnos entran desde la web y juegan.</p>
              <a href={routeToHash({ name: 'myRooms' })}>Entrar con un código</a>
            </Item>
            <Item imagen="rey-del-caos" nombre="App compañera" listo={false}>
              <p>Tu perfil, tu progreso, tus salas y el reto del día, en el celular.</p>
            </Item>
          </ul>
        </section>

        <section id="preguntas" aria-labelledby="titulo-preguntas">
          <div className="mq-preguntas-titulo">
            <h2 id="titulo-preguntas" data-entra>
              Preguntas
            </h2>
          </div>
          <div>
            {PREGUNTAS.map((p) => (
              <div className="mq-franja" key={p.pregunta}>
                <h3 data-entra>{p.pregunta}</h3>
                <p data-entra style={{ '--orden': 1 } as CSSProperties}>
                  {p.respuesta}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mq-final" aria-labelledby="titulo-final">
          <div className="mq-final-texto">
            <h2 id="titulo-final" data-entra>
              ¿Ya tienes el código?
            </h2>
            <FormularioCodigo />
          </div>
          <img
            className="mq-final-imagen"
            src={img('rey-del-caos')}
            width={540}
            height={960}
            alt="El Rey del Caos reta a Mati en el Bosque de las Sumas"
          />
        </section>
      </main>

      <footer className="mq-pie">
        <div className="mq-bloques" title="MathQuest">
          {BLOQUES.map((b, i) => (
            <span key={i} className={b.campo} style={{ height: `${b.alto}%` }}>
              {b.letra}
            </span>
          ))}
        </div>
        <div className="mq-pie-columnas">
          <ul aria-label="Jugar">
            <li>
              <a href={routeToHash({ name: 'solo' })}>Práctica rápida</a>
            </li>
            <li>
              <a href={routeToHash({ name: 'myRooms' })}>Mis salas</a>
            </li>
            <li>
              <a href={routeToHash({ name: 'login' })}>Entrar</a>
            </li>
          </ul>
          <ul aria-label="Docentes">
            <li>
              <a href={routeToHash({ name: 'teacherPanel' })}>Panel docente</a>
            </li>
            <li>
              <a href={routeToHash({ name: 'register' })}>Crear cuenta</a>
            </li>
          </ul>
          <ul aria-label="Esta página">
            <li>
              <a href="#regiones">Regiones</a>
            </li>
            <li>
              <a href="#descargas">Descargas</a>
            </li>
            <li>
              <a href="#preguntas">Preguntas</a>
            </li>
          </ul>
          <p className="creditos">
            Las imágenes son capturas de MathQuest Runner, hecho en Godot 4. Modelos 3D de Kenney (CC0). Tipografía
            Fredoka (SIL Open Font License).
          </p>
        </div>
        <div className="mq-pie-final">
          <span>© 2026 MathQuest · Proyecto escolar</span>
          <a className="mq-boton" href={routeToHash({ name: 'solo' })}>
            Jugar ahora
          </a>
        </div>
      </footer>
    </div>
  )
}

export default PaginaInicio
