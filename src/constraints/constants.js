// new_listing"|"send_message|login|subscribe|search

const Actions = {
    confirmation: { type: 'confirmation', w: 1 },
    geoSearch: { type: 'geoSearch', w: 1 },
    textSearchSearch: { type: 'textSearchSearch', w: 1 },
    login: { type: 'login', w: 0 },
    new_listing: { type: 'new_listing', w: 5 },
    reset: { type: 'reset', w: 10 },
    send_message: { type: 'send_message', w: 3 },
    subscribe: { type: 'subscribe', w: 1 },
    reedit: { type: 'reedit_user_profile', w: 10 },
}

let imgHolder = {
    blogs: 'https://via.placeholder.com/512x350/f5eabf/100d00.png?text=Blog',
    events: 'https://via.placeholder.com/512x350/934fe9/11113e.png?text=Event',
    hobbies: 'https://via.placeholder.com/512x350/b2bd12/0a090a.png?text=Hobby',
    markets: 'https://via.placeholder.com/512x350/bd5912/100d00.png?text=Market',
    skills: 'https://via.placeholder.com/512x350/ec496f/0f0f3f.png?text=Skill',
}

export { Actions, imgHolder }
