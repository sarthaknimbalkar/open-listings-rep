// @flow

import type {  FastifyRequest } from 'fastify'

export function setFlowSession(req: FastifyRequest, context: string) {
    // TODO: use redis instead and set a ttl on session['lastQueries']
    const { body } = req
    if (!req.session['lastQueries']) req.session['lastQueries'] = {}
    if (!req.session['lastQueries'][context]) req.session['lastQueries'][context] = {}
    if (body.unique_tab_id) req.session['lastQueries'][context][body.unique_tab_id] = body
}

export function getFlowSession(req: FastifyRequest, context: string) {
    let cachedPostBody
    const uniqueTabId = req.params.unique_tab_id
    if (
        uniqueTabId &&
        req.session['lastQueries'] &&
        req.session['lastQueries'][context] &&
        req.session['lastQueries'][context][uniqueTabId]
    )
        cachedPostBody = req.session['lastQueries'][context][uniqueTabId]
    return cachedPostBody
}
