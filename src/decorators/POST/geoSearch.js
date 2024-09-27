// @flow

import { Logger, NODE_ENV } from '../../utils.js'
import { Actions } from '../../constraints/constants.js'
import queries from '../../services/apis/mongo-queries.js'
import { to } from '../../services/routines/code.js'
import { formatAjvToLocals } from '../utils/prepareView.js'
import { setFlowSession } from '../utils/flowSessions.js'

import * as Types from '../../types.d.js'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)

    return async (req: FastifyRequest, reply: FastifyReply) => {
        let data = { addressPoints: [], context: Types.Contexts.Geolocation, listings: [] }
        if (req.validationError && req.validationError.validation) {
            const warnings = formatAjvToLocals(req.validationError, req)
            req.log.error(`search#geolocation: validation error`)
            reply.statusCode = 500
            reply.send({ error: warnings })
            return reply
        }
        setFlowSession(req, '/search/geolocation')

        /** @type Types.geolocationSchema */
        const body = req.body

        let [err, listings] = await to(
            QInstance.getListingsByGeolocation(body.lat, body.lng, body.section, req.pagination),
        )
        if (err) {
            req.log.error(`search#geolocation: ${err.message}`)
            reply.statusCode = 500
            reply.header('Content-Type', 'application/json; charset=utf-8')
            reply.send({ error: [req.t('generic.error.server')] })
            return reply
        }
        const { page, perPage } = req.pagination
        Object.assign(data, {
            current: page,
            listings: listings.documents,
            pages: Math.ceil(listings.count / perPage),
            section: body.section,
        })

        fastify.happened(Actions.geoSearch, 'search#geolocation', { reply, req })
        if (NODE_ENV === 'api') return data

        return reply.view('./pages/listings_parser_forker', data)
    }
}
