import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * EL NÚMERO DE ESTA COMPILACIÓN
 *
 * Se calcula una vez, al compilar, y va a dos sitios: dentro del paquete (como
 * __BUILD_ID__) y a un fichero suelto, dist/version.json.
 *
 * Para qué: el juego es una simulación determinista, así que dos jugadores con
 * versiones distintas del motor NO están jugando la misma partida — cada uno
 * calcula un ganador y la partida acaba en revisión sin repartir nada. Con esto,
 * el que lleva la versión vieja se entera y se recarga solo, en lugar de depender
 * de que alguien le diga «recarga» y le haga caso.
 *
 * El número es la fecha y hora de la compilación porque no hace falta más: lo
 * único que importa es que CAMBIE en cada despliegue.
 */
const BUILD_ID = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    {
      name: 'plant-arena-version',
      // Al acabar de compilar se deja el número en un fichero aparte. El juego lo
      // pide de vez en cuando SIN caché y lo compara con el suyo; si no coinciden,
      // hay versión nueva. No hace falta tocar la base de datos ni acordarse de
      // nada después de desplegar: el fichero cambia solo en cada compilación.
      closeBundle() {
        writeFileSync(
          join('dist', 'version.json'),
          JSON.stringify({ build: BUILD_ID }) + '\n'
        )
      },
    },
    {
      name: 'streaming-api-dev-server',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url?.split('?')[0]
          if (url === '/api/consultar') {
            let bodyStr = ''
            req.on('data', (chunk) => {
              bodyStr += chunk
            })
            req.on('end', async () => {
              try {
                // @ts-expect-error dynamic property on IncomingMessage
                req.body = bodyStr ? JSON.parse(bodyStr) : {}
              } catch {
                // @ts-expect-error dynamic property on IncomingMessage
                req.body = {}
              }
              const adaptedRes = {
                setHeader: (name: string, val: string) => res.setHeader(name, val),
                status: (code: number) => {
                  res.statusCode = code
                  return adaptedRes
                },
                json: (data: unknown) => {
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify(data))
                },
                end: () => res.end(),
              }
              try {
                // @ts-expect-error dynamic JS import without declaration
                const mod = await import('./api/consultar.js')
                await mod.default(req, adaptedRes)
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: err?.message || 'Error en endpoint dev' }))
              }
            })
            return
          }

          if (url === '/api/store/products') {
            const adaptedRes = {
              setHeader: (name: string, val: string) => res.setHeader(name, val),
              status: (code: number) => {
                res.statusCode = code
                return adaptedRes
              },
              json: (data: unknown) => {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              },
              end: () => res.end(),
            }
            try {
              // @ts-expect-error dynamic JS import without declaration
              const mod = await import('./api/store/products.js')
              await mod.default(req, adaptedRes)
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: err?.message || 'Error en endpoint dev' }))
            }
            return
          }

          next()
        })
      },
    },
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1500,
  },
})
