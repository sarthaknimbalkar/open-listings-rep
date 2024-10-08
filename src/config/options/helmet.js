import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const toBeReplaced = '42f2671d685f51e10fc6-b9fcecea3e50b3b59bdc28dead054ebc.ssl.cf5.rackcdn.com'

/**
 * @return {import('@fastify/helmet').FastifyHelmetOptions}
 */
export default () => {
    // TODO: Remove "'unsafe-eval'" again. It is left for client side Eta (~ Ejs) rendering
    return {
        contentSecurityPolicy: {
            directives: {
                ...require('@fastify/helmet').contentSecurityPolicy.getDefaultDirectives(),
                'default-src': [
                    "'self'",
                    "'unsafe-eval'",
                    'fonts.googleapis.com',
                    '*.fontawesome.com',
                    'www.googleapis.com',
                    'app.zingsoft.com',
                    'raw.githubusercontent.com',
                    'https://*.mapbox.com',
                    toBeReplaced,
                ],
                'font-src': [
                    "'self'",
                    'fonts.googleapis.com',
                    'fonts.gstatic.com',
                    '*.fontawesome.com',
                    'maxcdn.bootstrapcdn.com',
                ],
                'img-src': [
                    "'self'",
                    'data:',
                    'blob:',
                    '*.tile.osm.org',
                    '*.tile.openstreetmap.org',
                    'via.placeholder.com',
                    'unpkg.com',
                    'live.staticflickr.com',
                    'storage.googleapis.com',
                    'cdn.datatables.net',
                    'icongr.am',
                    toBeReplaced,
                ],
                'script-src': [
                    "'self'",
                    "'unsafe-eval'",
                    'unpkg.com',
                    '*.fontawesome.com',
                    'cdn.jsdelivr.net',
                    'cdn.zinggrid.com',
                    'cdnjs.cloudflare.com',
                    'cdn.datatables.net',
                    'uicdn.toast.com',
                    "'unsafe-inline'",
                ], // "localhost:3002" Ackee tracker test
                'style-src': [
                    "'self'",
                    "'unsafe-inline'",
                    'unpkg.com',
                    'cdn.jsdelivr.net',
                    'fonts.googleapis.com',
                    '*.fontawesome.com',
                    'maxcdn.bootstrapcdn.com',
                    'cdn.datatables.net',
                    'uicdn.toast.com',
                ],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'same-site' },
        // TODO: revise policies
        global: true,
        referrerPolicy: { policy: "same-origin" },
    }
}
