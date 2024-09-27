// @flow

import contexts from '../../contexts.js'
import { Logger } from '../../utils.js'
import queries from '../../services/apis/mongo-queries.js'
import { to } from '../../services/routines/code.js'

import * as Types from '../../types.d.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default (fastify: FastifyInstance, type: 'origin' | 'parent' | 'granpa') => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)

    return async (req: FastifyRequest, reply: FastifyReply) => {
        const tag = req.params.tag
        const [err, listings] = await to(QInstance.getListingsByTag(tag, type, req.pagination))
        if (err) {
            req.log.error(`index/tag#getListingsByTag: ${err.message}`)
            return reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])
        }
        const { page, perPage } = req.pagination
        const data = {
            context: Types.Contexts.Index,
            current: page,
            listings: listings.documents,
            pages: Math.ceil(listings.count / perPage),
            subtitle: tag,
        }
        return reply.prepareView([data, contexts.index_, contexts.index.tags])
    }
}
