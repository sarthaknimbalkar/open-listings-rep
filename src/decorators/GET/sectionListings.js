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
        if (req.session['lastQueries']) req.session['lastQueries'] = {}
        const section = req.url.split('/')[2].split('?')[0]
        const [err, listings] = await to(
            QInstance.getListingsSince(100, section, req.session.get('role') === 'admin', req.pagination),
        )
        const [err2, topTags] = await to(QInstance.topTags())

        if (err) {
            return reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])
        }
        const { page, perPage } = req.pagination
        const data = {
            context: Types.Contexts.Listings,
            listings: listings.documents,
            section: section,
            ...(!(err2 || Object.keys(topTags).length === 0) ? { components: { tags: topTags[section] } } : {}),
            addressPoints: [],
            current: page,
            pages: Math.ceil(listings.count / perPage),
        }
        data.addressPoints = listings.documents.map((a) => {
            return [a.lat, a.lng, a.title, a._id, a.section]
        })

        return reply.prepareView([data, 'listings', section])
    }
}
