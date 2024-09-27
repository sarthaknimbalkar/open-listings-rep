// @flow

import { Actions } from '../../constraints/constants.js'
import { tagsSubValidation } from '../../services/pipeLine.js'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export default (fastify: FastifyInstance) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
        /** @Type  */
        const body = req.body
        const section = body.section
        if (!section) {
            req.log.error(`post/listings#tags: no section provided}`)
            reply.send({ error: 'SERVER_ERROR' })
            return reply
        }
        let errors, tagsValid
        try {
            ;({ errors, tagsValid } = tagsSubValidation(req))
        } catch (error) {
            req.log.error(`post/listings#tags: ##########}`)
            reply.send({ error: 'SERVER_ERROR' })
            return reply
        }
        const valid = !errors.length && tagsValid
        if (!valid) {
            req.log.error(`post/listings#tags: ##########}`)
            reply.send({ error: 'POST_ERR' })
            return reply
        } else {
            fastify.happened(Actions.subscribe, 'post/listings#tags', { reply, req })
            req.flash('success', 'Successfully subscribed')

            return reply.redirect('/listings/user')
        }
    }
}
