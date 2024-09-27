// @flow

import perPage from '../config/options/perPage.js'
import { Logger } from '../utils.js'
import queries from '../services/apis/mongo-queries.js'

import type { FastifyInstance } from 'fastify'

async function routes(fastify: FastifyInstance) {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)
    const queriesMethods = Object.getOwnPropertyNames(QInstance)
    queriesMethods.forEach((url) => {
        fastify.post(`/${url}`, async (request, reply) => {
            const { body } = request
            const params = body ? Object.values(body) : []
            const pagination = { page: 1, perPage: perPage() }
            let res
            try {
                console.log(`calling /${url} with parameters ${JSON.stringify(params)}`)
                res = await QInstance[url](...params, pagination)
                reply.send({ data: res, url: url })
            } catch (error) {
                reply.send({ error: error, url: url })
            }
        })
    })
}

export default routes
