// @flow
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { Actions } from '../../constraints/constants.js'
import { messageSchema } from '../../constraints/constraints.js'
import contexts from '../../contexts.js'
import queries from '../../services/apis/mongo-queries.js'
import { safeText } from '../../services/apis/safe-text.js'
import { to } from '../../services/routines/code.js'
import * as Crypto from '../../services/routines/crypto.js'
import * as Strings from '../../services/routines/strings.js'
import { ajvLocalize, config, Logger } from '../../utils.js'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'


export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new queries(redis, new Logger(fastify).log)
    const key = Crypto.passwordDerivedKey(fastify.conf('PASSWORD'))

    const ajv = new Ajv({ allErrors: true, coerceTypes: true, parseDate: true })
    addFormats(ajv)
    const validate = ajv.compile(messageSchema.valueOf())

    return async (req: FastifyRequest, reply: FastifyReply) => {
        /** @type Types.MessageSchema */
        const body = req.body

        const valid = validate(body)
        let errors = [];

        if (!valid) {
            ajvLocalize[(req.i18n && req.i18n.language) || req.cookies.locale || 'fr'](validate.errors)
            errors = validate.errors?.map((err) => {
                if (err.dataPath) return `"${err.dataPath.substring(1)}" - ${err.message}`
                if (err.instancePath) return `"${err.instancePath.substring(1)}" - ${err.message}`
                else return `${err.message}`
            })
        }

        // basic validation based on Fastify schema
        if (errors.length) {
            req.flash('error', errors[0])

            return reply.redirect('/listings/user/notifications')
        }

        const mongoHex = /^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/i
        // TODO: fix messaging system
        let receiver = Crypto.decrypt(key, body.email)

        const isIdValid = config('IS_MONGO_DB') ? mongoHex.test(body.id || '') : true
        const [err, elem] = isIdValid
            ? await to(QInstance.getListingById(body.id, req.session.get('role') === 'admin', receiver))
            : ['NOT_FOUND', undefined]
        if (err) {
            // TODO: revise later template
            req.log.error(`post/sendMessage#getListingById: ${err.message}`)
            reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])

            return reply
            // throw new Error('Kaboom')
        }
        if (!elem) {
            // TODO: revise later template
            reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])

            return reply
            // throw new Error('Kaboom')
        }
        if (req.validationError?.validation) {
            // TODO: revise later template
            // reply.prepareView([{ data: elem }, contexts.listing_, contexts.listing.contact])
            // return reply
            // throw new Error('Kaboom')
        }

        const { clean, language, text } = await safeText({
            text: body.message,
        })

        const message = {
            cmsg: clean,
            from: req.session.get('user').username,
            lang: language,
            message: text,
            sent: new Date(),
            thread: elem.title,
            threadId: body.id,
            to: receiver,
        }
        const [error, id] = await to(QInstance.insertComment(message))
        if (error) {
            req.log.error(`post/sendMessage#getListingById: ${error.message}`)
            reply.prepareView([{}, contexts.message_, contexts.message.SERVER_ERROR])

            return reply
        }
        let data = {}
        elem.email = Crypto.encrypt(key, elem.usr)
        elem.usr = elem.usr ? Strings.initials(elem.usr) : 'YY'
        data = { data: elem, section: elem.section }
        fastify.happened(Actions.send_message, 'listings#sendMessage', { reply, req })

        return reply.redirect('/listings/user/notifications')
        // reply.prepareView([data, contexts.listing_, contexts.listing.contact])
    }
}
