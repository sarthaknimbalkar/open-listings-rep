// @flow

import bcrypt from 'bcryptjs'
import contexts from '../contexts.js'
import { Logger } from '../utils.js'
import { Actions } from '../constraints/constants.js'
import { userLoginSchema, userPasswordSchema, userSignupSchema } from '../constraints/constraints.js'
import getLogin from '../decorators/POST/login.js'
import getSignup from '../decorators/POST/signup.js'
import authAdapter from '../decorators/auth.js'
import prepareView from '../decorators/utils/prepareView.js'
import { goGet } from '../decorators/utils/goGet.js'
import { kickOut } from '../decorators/utils/kickOut.js'
import queries from '../services/apis/mongo-queries.js'
import { to } from '../services/routines/code.js'

import type { FastifyInstance } from 'fastify'

async function routes(fastify: FastifyInstance) {
    const { redis } = fastify

    const QInstance = new queries(redis, new Logger(fastify).log)
    let { auth } = authAdapter(fastify)

    // const mailer = Mailer.getInstance(null)
    fastify.decorateReply('prepareView', prepareView)
    fastify.decorate('goGet', goGet)

    /* GET login page. */
    fastify.goGet('login')

    /* GET subscribe page. */
    fastify.goGet('signup')

    /* GET reset page. */
    fastify.goGet('reset')

    /* GET logout. */
    fastify.get('/logout', async function (request, reply) {
        await kickOut(request, reply)
        reply.redirect('/')
    })

    const loginHandler = getLogin(fastify)
    fastify.post('/login', { attachValidation: true, schema: { body: userLoginSchema } }, loginHandler)

    const signupHandler = getSignup(fastify)
    fastify.post('/signup', { attachValidation: true, schema: { body: userSignupSchema } }, signupHandler)

    /* Confirmation of email identity. */
    fastify.goGet('confirmation')

    fastify.get('/confirmation/:token/', async function (request, reply) {
        const token = request.params.token
        const tmpUser = await QInstance.getTmpUserByToken(token)
        if (!tmpUser) {
            await kickOut(request, reply)
            reply.code(401)
            reply.prepareView([{}, contexts.signup_, contexts.signup.UNAUTHORIZED], request)

            return reply
            // return new Error('UNAUTHORIZED')
        }
        const user = await QInstance.getUserByUsername(tmpUser.username)
        if (!user) {
            await kickOut(request, reply)
            reply.code(401)
            reply.prepareView([{}, contexts.signup_, contexts.signup.INCORRECT_TOKEN], request)

            return reply
            // return new Error('INCORRECT_TOKEN')
        }
        if (user.isVerified) {
            reply.code(401)
            reply.prepareView([{}, contexts.signup_, contexts.signup.ALREADY_VERIFIED], request)

            return reply
            // return new Error('ALREADY_VERIFIED')
        }
        user.isVerified = true
        await QInstance.updateUser(user)
        fastify.happened(Actions.confirmation, 'auth/confirmation', { reply, request })

        return reply.redirect('/')

    })

    /* Reset of email password. */
    fastify.post(
        '/reset',
        { attachValidation: true, preHandler: auth, schema: { body: userPasswordSchema } },
        async function (request, reply) {
            if (request.validationError) {
                reply.prepareView([{}, contexts.reset_, contexts.reset.VALIDATION_ERROR], request)

                return reply
            }
            const currentUser = request.session.get('user').username
            /**
             * @typedef {object} userPasswordSchema
             * @property {string} [unique_tab_id]
             * @property {string} password
             */
            /** @type userPasswordSchema */
            const body = request.body
            const { password } = body
            const user = await QInstance.getUserByUsername(currentUser)
            // This must never happen really
            if (!user) {
                reply.prepareView([{}, contexts.reset_, contexts.reset.SERVER_ERROR], request)

                return reply
            }
            try {
                user.passHash = await bcrypt.hash(password, 10)
                const [err] = await to(QInstance.updateUser(user))
                if (err) {
                    reply.prepareView([{}, contexts.reset_, contexts.reset.VALIDATION_ERROR], request)

                    return reply
                }
                // request.flash('success', 'Successfully updated password')
                request.flash('success', 'Mot de passe mis à jour avec succès')
                fastify.happened(Actions.reset, 'auth/reset', { reply, request })

                return reply.redirect('/')
            } catch (err) {
                request.log.error(`reset: ${err.message}`)
                reply.prepareView([{}, contexts.reset_, contexts.reset.SERVER_ERROR], request)

                return reply
            }
        },
    )
}

export default routes
