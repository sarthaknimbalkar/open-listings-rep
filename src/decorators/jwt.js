// @flow

// If you want to use async/await or promises but respond with a value with reply.send:
//      Do return reply / await reply.
//      Do not forget to call reply.send.
// If you want to use async/await or promises:
//      Do not use reply.send.
//      Do return the value that you want to send.

import jwt from 'jsonwebtoken'
import { config } from '../utils.js'
import { loadUser } from './utils/loadUser.js'

import type { FastifyRequest, FastifyReply } from 'fastify'

const COOKIE_NAME = config('COOKIE_NAME')

/**
 *
 * @param {string[]} roles
 * @returns
 */
function verifyJWT(roles = []) {
    if (typeof roles === 'string') {
        roles = [roles]
    }
    /**
     * For secured routes
     * Note: Do not redirect to a secured route as it might stuck in a loop
     */
    return function (request: FastifyRequest, reply: FastifyReply, done) {
        if (!request.cookies) return done()

        const cookie = request.cookies[COOKIE_NAME]
        const verificationCallback = (data) => {
            if (roles.length && !roles.includes(data.role) && data.role !== 'admin') {
                // user's role is not authorized
                // TODO: flash
                throw new Error('')
            }

            loadUser(request, data)
        }

        try {
            const decoded = jwt.verify(cookie || 'open-listings', request.fastify.conf('JWT_SECRET'))
            verificationCallback(decoded)

            return done()
        } catch (error) {
            // TODO: flash
            return reply.redirect('/login')
        }
    }
}

function wsauth(request: FastifyRequest) {
    if (!request.cookies) return false
    const cookie = request.cookies[COOKIE_NAME]
    if (!cookie) return false
    try {
        const decoded = jwt.verify(cookie, request.fastify.conf('JWT_SECRET'))
        // TODO: ts verify
        return decoded['username']
    } catch (ex) {
        console.error(ex.message)
        return false
    }
}

export { verifyJWT, wsauth }
