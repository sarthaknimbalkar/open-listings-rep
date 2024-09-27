// @flow

import perPage from '../../config/options/perPage.js'
import { Logger, NODE_ENV } from '../../utils.js'
import queries from '../../services/apis/mongo-queries.js'
import { safeText } from '../../services/apis/safe-text.js'
import { to } from '../../services/routines/code.js'
import { getFlowSession } from '../utils/flowSessions.js'

import * as Types from '../../types.d.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)

    return async (req: FastifyRequest, reply: FastifyReply) => {
        let err, listings
        const page = parseInt(req.params.p) || 1
        const pagination = { page, perPage: perPage(Types.Contexts.TextSearch) }
        const section = req.url.split('/')[5]
        let data = { addressPoints: [], context: Types.Contexts.TextSearch, crossLangListings: [], listings: [] }
        let cachedPostBody = getFlowSession(req, '/search/textSearch')
        if (!cachedPostBody) {
            // Initial landing on the listings page without query (not really a POST request)
            ;[err, listings] = await to(
                QInstance.getListingsSince(100, section, req.session.get('role') === 'admin', pagination),
            )
            if (err) {
                req.log.error(`search#textSearch: ${err.message}`)
                reply.statusCode = 500
                reply.header('Content-Type', 'application/json; charset=utf-8')
                reply.send({ error: [req.t('generic.error.server')] })
                return reply
            }
            // req.log.error(`search#text: no previous cached request`)
            // reply.statusCode = 500
            // reply.header('Content-Type', 'application/json; charset=utf-8')
            // reply.send({ error: [req.t('generic.error.server')] })
            // return reply
        } else {
            const { clean, language } = await safeText({
                text: cachedPostBody.title_desc,
            })

                ;[err, listings] = await to(
                    QInstance.textSearch(
                        clean,
                        cachedPostBody.exact,
                        cachedPostBody.div_q,
                        cachedPostBody.section,
                        language,
                        pagination,
                    ),
                )

            if (err) {
                req.log.error(`search#textSearch: ${err.message}`)
                reply.statusCode = 500
                reply.header('Content-Type', 'application/json; charset=utf-8')
                reply.send({ error: [req.t('generic.error.server')] })
                return reply
            }
        }

        Object.assign(data, {
            crossLangListings: listings.crossLangDocs,
            current: pagination.page,
            listings: listings.documents,
            pages: Math.ceil(listings.count / pagination.perPage),
            section: section || cachedPostBody.section,
        })

        if (NODE_ENV === 'api') return data

        return reply.view('./pages/listings_parser_forker', data)
    }
}
