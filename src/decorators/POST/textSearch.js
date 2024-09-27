// @flow

import { Logger, NODE_ENV } from '../../utils.js'
import queries from '../../services/apis/mongo-queries.js'
import { safeText } from '../../services/apis/safe-text.js'
import { to } from '../../services/routines/code.js'
import { formatAjvToLocals } from '../utils/prepareView.js'
import { setFlowSession } from '../utils/flowSessions.js'

import * as Types from '../../types.d.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)

    return async (req: FastifyRequest, reply: FastifyReply) => {
        let data = { addressPoints: [], context: Types.Contexts.TextSearch, crossLangListings: [], listings: [] }

        if (req.validationError && req.validationError.validation) {
            const warnings = formatAjvToLocals(req.validationError, req)
            req.log.error(`search#textSearch: validation error`)
            reply.statusCode = 500
            reply.header('Content-Type', 'application/json; charset=utf-8')
            reply.send({ error: warnings })
            return reply
        }
        setFlowSession(req, '/search/textSearch')

        /** @type Types.textSearchSchema */
        const body = req.body
        const { clean, language } = await safeText({
            text: body.title_desc,
        })

        const lang = language
        let [err, listings] = await to(
            QInstance.textSearch(clean, body.exact, body.div_q, body.section, lang, req.pagination),
        )
        if (err) {
            req.log.error(`search#textSearch: ${err.message}`)
            reply.statusCode = 500
            reply.header('Content-Type', 'application/json; charset=utf-8')
            reply.send({ error: [req.t('generic.error.server')] })
            return reply
        }
        const { page, perPage } = req.pagination
        Object.assign(data, {
            crossLangListings: listings.crossLangDocs,
            current: page,
            listings: listings.documents,
            pages: Math.ceil(listings.count / perPage),
            section: body.section,
        })

        if (NODE_ENV === 'api') return data

        return reply.view('./pages/listings_parser_forker', data)
    }
}
