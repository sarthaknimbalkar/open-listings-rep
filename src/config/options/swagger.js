import { config } from '../../utils.js'

/**@type  import('@fastify/swagger').SwaggerOptions */
export default {
    mode: 'dynamic',
    swagger: {
        consumes: ['application/json'],
        externalDocs: {
            description: 'Find more info here',
            url: 'https://swagger.io',
        },
        host: `localhost:${config('NODE_PORT')}`,
        info: {
            description: '',
            title: 'Open-listings API',
            version: '1.0.0',
        },
        produces: ['application/json'],
        schemes: ['http'],
    },
}
