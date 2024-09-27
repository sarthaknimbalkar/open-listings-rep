// @flow

import contexts from '../../contexts.js'
import { config, Logger } from '../../utils.js'
import queries from '../../services/apis/mongo-queries.js'
import { to } from '../../services/routines/code.js'
import * as Crypto from '../../services/routines/crypto.js'
import * as Strings from '../../services/routines/strings.js'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)
    const key = Crypto.passwordDerivedKey(fastify.conf('PASSWORD'))

    return async (req: FastifyRequest, reply: FastifyReply) => {
        const viewer = req.session.get('user') ? req.session.get('user').username : ''
        const mongoHex = /^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/i
        const isIdValid = config('IS_MONGO_DB') ? mongoHex.test(req.params.id) : true
        const [err, elem] = isIdValid
            ? await to(QInstance.getListingById(req.params.id, req.session.get('role') === 'admin', viewer))
            : ['NOT_FOUND', undefined]

        if (err === 'NOT_FOUND' || !elem) return reply.prepareView([{}, contexts.message_, contexts.message.NOT_FOUND])

        if (err) {
            req.log.error(`get/id#getListingById: ${err.message}`)

            return reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])
        }

        const author = elem.usr === viewer
        elem.email = Crypto.encrypt(key, elem.usr)
        elem.usr = elem.usr ? Strings.initials(elem.usr) : 'YY'
        let data = { author, data: elem, section: elem.section }

        return reply.prepareView([data, contexts.listing_, contexts.listing.id])
    }
}
