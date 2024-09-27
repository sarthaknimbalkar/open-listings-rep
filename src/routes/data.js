// @flow

import { give } from '../services/tags/data.js'

import type { FastifyInstance } from 'fastify'

async function routes(fastify: FastifyInstance) {
    ;[
        ['/get_tags_en', give.googleTagsEn],
        ['/get_tags_ar', give.googleTagsAr],
        ['/get_tags_fr', give.googleTagsFr],
        ['/get_markets_tags_en', give.googleTagsEnLite],
        ['/get_markets_tags_ar', give.googleTagsArLite],
        ['/get_markets_tags_fr', give.googleTagsFrLite],
        ['/get_skills_tags_en', give.ESCOTagsEn],
        ['/get_skills_tags_fr', give.ESCOTagsFr],
        ['/get_skills_tags_ar', give.ESCOTagsAr],
        ['/get_events_tags_en', give.cptallTagsEn],
        ['/get_events_tags_ar', give.cptallTagsAr],
        ['/get_events_tags_fr', give.cptallTagsFr],
        ['/get_hobbies_tags_en', give.wikiHobbiesEn],
        ['/get_hobbies_tags_fr', give.wikiHobbiesFr],
        ['/get_hobbies_tags_ar', give.wikiHobbiesAr],
        ['/get_blogs_tags_en', give.blogsTagsEn],
        ['/get_blogs_tags_ar', give.blogsTagsAr],
        ['/get_blogs_tags_fr', give.blogsTagsFr],
    ].forEach(([url, tags]) => {
        fastify.get(url, async (request, reply) => reply.send({ tags }))
    })
}

export default routes
