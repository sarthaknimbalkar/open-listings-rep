// @flow

import type { FastifyInstance } from 'fastify'

export default function authAdapter(fastify: FastifyInstance) {
    let auth, adminAuth
    auth = fastify.auth([fastify.verifyJWT('regular')])
    adminAuth = fastify.auth([fastify.verifyJWT('admin')])
    return { adminAuth, auth }
}
