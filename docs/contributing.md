## Contributing

**Contribution is VERY WELCOME, I already thank you in advance.** We're always looking to improve this project, open source contribution is encouraged so long as they adhere to the following guidelines. The first version of this project was written by a single person with the mindset of being productive; We admit that the structure and code at this stage is not the easiest to comprehend. In addition, the developer himself did not adhere to conventional approaches as we see in most web projects.

It is to note that the whole project is written in JavaScript, we believe we don't need TypeScript until proven wrong. We don't any reactive framework like React for the front-end neither.

### Pull requests

-   Our focus at this stage is on resolving bugs and enhancing performance rather than adding new functionalities.

-   As a contributor, never bypass Husky pre commit hooks, it is not a TypeScript project but we assure some level of typing against errors using [Flow](https://flow.org/). It is a partial solution to type the project partially.

-   _keep it stupid, simple_

-   We rely on dozens of open sources projects particularly for front-end particularly. These are lightweight, minimal and safe libraries. Some examples are:

    -   Quill: Quill is a modern WYSIWYG editor built for compatibility and extensibility. [repo](https://github.com/quilljs/quill/)
    -   tagify: 🔖 lightweight, efficient Tags input component in Vanilla JS / React / Angular / Vue [repo](https://github.com/yairEO/tagify)
    -   notyf: 👻 A minimalistic, responsive, vanilla JavaScript library to show toast notifications [repo](https://github.com/caroso1222/notyf)
    -   holmes: Fast and easy searching inside a page [repo](https://github.com/Haroenv/holmes) It uses microlight also.
    -   auto-complete: An extremely lightweight and powerful vanilla JavaScript completion suggester. [repo](https://github.com/Pixabay/JavaScript-autoComplete)
    -   jsi18n: Simple client side internationalization with javascript. [repo](https://github.com/danabr/jsI18n)
    -   avatar: Library for showing Gravatars or generating user avatars. [repo](https://github.com/MatthewCallis/avatar)

        This raises multiple challenges mainly for upgrading and actively maintained from their authors. We would like to rely always on the latest versions, but we would change one library by another if the project seems inactive or very old (like not supporting modules or so).
        Leaflet particularly is the most important in this regard.

        We suggest to install [ndm](https://720kb.github.io/ndm/) and add two projects `./` and `./client/` to keep an eye on last versions and what to expect.

-   No one line functions please. Deflate one, two or three line functions ! something like

```js
function getUser(id) {
    console.log('calling getUser function')
    return this.repository.findOne(id)
}

function main() {
    getUser('id')
}

// Should be

function main() {
    const user = this.repository.findOne(id)
}
```

In the same logic, we don't need MVC unless really needed. If possible connect to DB, do business logic and return results to front-end in the route function.
