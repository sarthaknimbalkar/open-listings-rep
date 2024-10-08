/* eslint-disable no-undef */

// @ts-ignore
let db = new Mongo().getDB('listings_db')

db.createUser({
    pwd: 'root02-PassXXX',
    roles: [
        {
            db: 'listings_db',
            role: 'dbOwner',
        },
    ],
    user: 'root',
})

// Announcements: 'announcements',
// Comment: 'comment',
// Events: 'events',
// Listing: 'listings',
// Users: 'users',
// Userstemp: 'userstemp',
// Words: 'words',
db.createCollection('users', { capped: false })
db.createCollection('usersblock', { capped: false })
db.createCollection('words', { capped: false })
db.createCollection('listings', { capped: false })
db.createCollection('userstemp', { capped: false })
db.createCollection('comment', { capped: false })
db.createCollection('events', { capped: false })
db.createCollection('filters', { capped: false })

console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@')
