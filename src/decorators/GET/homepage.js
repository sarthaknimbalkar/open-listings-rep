// @flow

import contexts from '../../contexts.js'
import { Logger } from '../../utils.js'
import queries from '../../services/apis/mongo-queries.js'
import { to } from '../../services/routines/code.js'

import * as Types from '../../types.d.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)
    return async (req: FastifyRequest, reply: FastifyReply) => {
        const [err, listings] = await to(
            QInstance.getListingsSince(20, '', req.session.get('role') === 'admin', req.pagination),
        )
        const [err2, topTags] = await to(QInstance.topBy('div'))
        if (err) {
            throw err
        }
        const { page, perPage } = req.pagination
        const data = {
            listings: listings.documents,
            ...(!(err2 || topTags.length === 0) ? { components: { tags: topTags } } : {}),
            addressPoints: [],
            context: Types.Contexts.Index,
            current: page,
            pages: Math.ceil(listings.count / perPage),
        }
        data.addressPoints = listings.documents.map((a) => {
            return [a.lat, a.lng, a.title, a._id, a.section]
        })
        return reply.prepareView([data, contexts.index_, contexts.index.listings])
    }
}
