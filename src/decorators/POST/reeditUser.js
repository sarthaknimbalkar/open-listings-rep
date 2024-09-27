// @flow

import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import contexts from '../../contexts.js'
import { config, Logger } from '../../utils.js'
import { Actions } from '../../constraints/constants.js'
import mongoQueries from '../../services/apis/mongo-queries.js'
import { ops as helpers } from '../../services/helpers.js'
import { to } from '../../services/routines/code.js'
import { kickOut } from '../utils/kickOut.js'
import Mailer from '../../services/mailer.js'
import * as Types from '../../types.d.js'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import transformers from '../../constraints/transformers.js'

// TODO: accept arabic in case
const nameReg = new RegExp(/^[\w'\-,.][^0-9_!¡?÷?¿/\\+=@#$%ˆ&*(){}|~<>;:[\]]{2,}$/)

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new mongoQueries(redis, new Logger(fastify).log)

    return async function (request: FastifyRequest, reply: FastifyReply) {
        // basic validation based on Fastify schema
        if (request.validationError) {
            reply.prepareView([{}, contexts.userProfile_, contexts.userProfile.VALIDATION_ERROR], request)

            return reply
        }
        /** @type Types.UserProfileSchema */
        const body = request.body

        const { firstName, secondName, bio, localisation } = body
        transformers['sanitize'](body, ['firstName', 'secondName', 'bio', 'localisation'])

        if (!nameReg.test(firstName) || !nameReg.test(secondName)) {
            const friendlyMessages = {
                suggestions: ['Le nom ou le prenom est invalide'],
                warning: ['Le nom ou le prenom est invalide'],
            }
            reply.prepareView(
                [{ ...friendlyMessages }, contexts.userProfile_, contexts.userProfile.VALIDATION_ERROR],
                request,
            )
        }

        try {
            const [err] = await to(
                QInstance.updateUserProfile(
                    { firstName, secondName, bio, localisation },
                    request.session.get('user').username,
                ),
            )
            if (err) {
                reply.prepareView([{}, contexts.userProfile_, contexts.userProfile.VALIDATION_ERROR], request)

                return reply
            }
            fastify.happened(Actions.reedit, 'reedit', { reply, request })

            return reply.prepareView([{}, contexts.userProfile_, contexts.userProfile_], request)
        } catch (err) {
            request.log.error(`reedit: ${err.message}`)
            reply.prepareView([{}, contexts.userProfile_, contexts.userProfile.user_profile], request)

            return reply
        }
    }
}
