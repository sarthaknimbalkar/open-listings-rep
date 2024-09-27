// @flow

import type { FastifyReply, FastifyRequest } from 'fastify'

import { config } from '../../utils.js'

const COOKIE_NAME = config('COOKIE_NAME')
/**
 * Removes user from cookie and session immediately
 */
export const kickOut = async (request: FastifyRequest, reply: FastifyReply) => {
    reply.setCookie(COOKIE_NAME, '', {
        expires: new Date(),
    })

    // request.flash('success', 'Successfully logged out')
    request.flash('success', 'Déconnexion réussie')
    await request.session?.destroy()
    delete request.params['user']
}
