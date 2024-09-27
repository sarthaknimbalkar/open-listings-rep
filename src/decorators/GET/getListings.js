// @flow

import contexts from '../../contexts.js'
import queries from '../../services/apis/mongo-queries.js'
import { to } from '../../services/routines/code.js'
import { Logger } from '../../utils.js'

import * as Types from '../../types.d.js'
import type { FastifyInstance } from 'fastify'

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)

    return async (req, reply) => {
        const [err, listings] = await to(
            QInstance.getListingsSince(20, '', req.session.get('role') === 'admin', req.pagination),
        )
        const [err2, topTags] = await to(QInstance.topTags())
        if (err) {
            req.log.error(`listings#: ${err.message}`)
            reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])

            return reply
        }
        const { page, perPage } = req.pagination
        const data = {
            context: Types.Contexts.AllListings,
            listings: listings.documents,
            section: '',
            ...(!(err2 || Object.keys(topTags).length === 0) ? { components: { tags: topTags } } : {}),
            addressPoints: [],
            current: page,
            pages: Math.ceil(listings.count / perPage),
        }
        reply.prepareView([data, contexts.listings_, contexts.listings.listings])

        return reply
    }
}
