// @flow

import type { FastifyRequest } from 'fastify'

export const loadUser = (request: FastifyRequest, data: Object) => {
    // Store username in params (to be used in front). It can be tempted !
    request.params.user = { role: data.role, username: data.username }
    // Store username in session (to be used in back). It cannot be tempted !
    request.session.set('user', { role: data.role, username: data.username })
}
