// @flow

import type { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify'

/**
 * THIS DECORATOR simply a refactoring of
 * ```
 *  fastify.get('/login', function (req, reply) {
 *      reply.prepareView([{}, 'login', 'login'])
 *  })
 *
 *  // into this =>
 *
 *  fastify.goGet('login')
 * ```
 * 'this' refers to Fastify instance
 */

export function goGet(route: string, preHandler: RouteShorthandOptions) {

    async function getter(req: FastifyRequest, reply: FastifyReply) {
        return reply.prepareView([{}, route, route])
    }
    if (preHandler) this.get(`/${route}`, preHandler, getter)
    else this.get(`/${route}`, getter)
}
