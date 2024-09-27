// @flow

import { config, Logger } from '../../utils.js'
import queries from '../../services/apis/mongo-queries.js'
import { to } from '../../services/routines/code.js'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)

    return async (req: FastifyRequest, reply: FastifyReply) => {
        const viewer = req.session.get('user').username
        const mongoHex = /^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/i
        const isIdValid = config('IS_MONGO_DB') ? mongoHex.test(req.params.id) : true

        const [err, elem] = isIdValid
            ? await to(QInstance.deleteListingById(req.params.id, req.session.get('role') === 'admin', viewer))
            : ['NOT_FOUND', undefined]

        if (err === 'NOT_FOUND' || !elem) {
            req.log.error(`get/id#deleteListingById: ${err}`)
            throw new Error('kaboom')
        }
        if (err) {
            req.log.error(`get/id#deleteListingById: ${err.message}`)
            throw new Error('kaboom')
        }

        return reply.redirect('/listings/user')
    }
}
