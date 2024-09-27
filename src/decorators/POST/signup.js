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
import Mailer from './../../services/mailer.js'
import transformers from '../../constraints/transformers.js'

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

// TODO: accept arabic in case
const nameReg = new RegExp(/^[\w'\-,.][^0-9_!¡?÷?¿/\\+=@#$%ˆ&*(){}|~<>;:[\]]{2,}$/)

export default (fastify: FastifyInstance) => {
    const { redis } = fastify
    const QInstance = new mongoQueries(redis, new Logger(fastify).log)

    return async function (request: FastifyRequest, reply: FastifyReply) {
        // basic validation based on Fastify schema
        if (request.validationError) {
            reply.prepareView([{}, contexts.signup_, contexts.signup.VALIDATION_ERROR], request)

            return reply
        }

        /** @type Types.UserSignupSchema */
        const body = request.body
        body['username'] = body['username'].toLowerCase()
        transformers['sanitize'](body, ['firstName', 'secondName'])

        let { firstName, password, secondName, username } = body
        // advanced validation based on other factors
        const passValidation = await helpers.isFinePassword(password, request.i18n.language)
        if (passValidation.score <= 2) {
            // TODO: complete with this. Eithe add to prepareView decorator or just here.
            // @ts-ignore
            const friendlyMessages = {
                suggestions: passValidation.feedback.suggestions,
                warning: passValidation.feedback.warning,
            }
            reply.prepareView([{ ...friendlyMessages }, contexts.signup_, contexts.signup.VALIDATION_ERROR], request)

            return reply
        }

        if (!nameReg.test(firstName) || !nameReg.test(secondName)) {
            const friendlyMessages = {
                suggestions: ['Le nom ou le prenom est invalide'],
                warning: ['Le nom ou le prenom est invalide'],
            }
            reply.prepareView([{ ...friendlyMessages }, contexts.signup_, contexts.signup.VALIDATION_ERROR], request)

            return reply
        }

        // Always 'regular' by default (except user@mail.com for tests)
        const role = username === config('ADMIN_EMAIL') || username === config('ADMIN_EMAIL2') ? 'admin' : 'regular'
        const isVerified = role === 'admin'
        try {
            const user = await QInstance.getUserByUsername(username)
            if (user) {
                await kickOut(request, reply)
                reply.prepareView([{}, contexts.signup_, contexts.signup.EMAIL_TAKEN], request)

                return reply
                // throw { statusCode: 400, message: 'EMAIL_TAKEN' }
            } else if (helpers.isBadEmail(username)) {
                await kickOut(request, reply)
                reply.prepareView([{}, contexts.signup_, contexts.signup.BAD_EMAIL], request)

                return reply
            } else {
                let passHash = await bcrypt.hash(password, 10)
                // Temporary user to be able to verify property of identity (email)
                let tempUser = {
                    token: crypto.randomBytes(16).toString('hex'),
                    username: username,
                }
                // Actual user but unverified
                const [err] = await to(
                    QInstance.insertUser({
                        firstName,
                        isVerified,
                        passHash,
                        password,
                        role,
                        secondName,
                        username,
                    }),
                )
                if (err) {
                    await kickOut(request, reply)
                    reply.prepareView([{}, contexts.signup_, contexts.signup.VALIDATION_ERROR], request)

                    return reply
                }

                const mailer = await Mailer.getInstance()
                mailer.sendCustomMail({
                    data: { host: config('APIHost'), token: tempUser.token },
                    req: request,
                    to: username,
                    todo: 'signup',
                })
                await QInstance.insertTmpUser(tempUser)
                reply.prepareView([{}, contexts.message_, contexts.message.verification], request)
                fastify.happened(Actions.subscribe, 'auth/signup', { reply, request })

                return reply
            }
        } catch (err) {
            await kickOut(request, reply)
            request.log.error(`signup: ${err.message}`)
            reply.prepareView([{}, contexts.signup_, contexts.signup.SERVER_ERROR], request)

            return reply
        }
    }
}
