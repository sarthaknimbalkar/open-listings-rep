import Grid from 'tui-grid' /* ES6 */

// TODO: apply basic validation on listings changes here
// (probably use already made validation Pipeline)
// TODO: use quilljs
class CustomTextEditor {
    constructor(props) {
        const el = document.createElement('textarea')
        el.value = String(props.value).replace(/<br>/g, '\n')
        this.el = el
    }

    getValue() {
        return this.el.value.replace(/\n/g, '<br>')
    }
    //...
}

class CustomImgRenderer {
    constructor(props) {
        const el = document.createElement('img')
        el.src = String(props.value)
        el.style.height = '5rem'
        el.style.width = '5rem'
        this.el = el
        this.render(props)
    }

    getElement() {
        return this.el
    }

    render(props) {
        // you can change the image link as changes the `value`
        this.el.src = String(props.value)
    }
}

const guessCast = (value) => {
    const lowerCaseValue = value.toLowerCase ? value.toLowerCase(value) : ''
    const numericValue = parseFloat(value)
    const justNumbers = value.match ? value.match(/^-*\d+(\.\d+)?$/g) != null : null

    const castValue = justNumbers
        ? numericValue
        : ['true', 'false'].includes(lowerCaseValue)
          ? lowerCaseValue === 'true'
          : value
    return castValue
}

/** @type  import('../../../node_modules/tui-grid/types/index.js').ExportOptions */
const exportOptions = {}

/** @type  import('../../../node_modules/tui-grid/types/index.js').GridOptions */
const options = {
    contextMenu: false,
    usageStatistics: false,
    el: document.getElementById('grid'),
    data: {
        api: {
            readData: { url: '/admin/', method: 'GET' },
            // createData: { url: '/admin/', method: 'POST' },
            updateData: { url: '/admin/', method: 'PUT' },
            // modifyData: { url: '/admin/', method: 'PUT' },
            // deleteData: { url: '/admin/', method: 'DELETE' },
        },
        contentType: 'application/json',
    },
    scrollX: false,
    scrollY: false,
    minBodyHeight: 30,
    rowHeight: 'auto',
    rowHeaders: ['rowNum'],
    pageOptions: {
        useClient: true,
        perPage: 5,
    },
    columns: [
        {
            header: 'ID',
            name: '_id',
            sortable: true,
        },
        {
            header: 'Image',
            name: 'img',
            renderer: {
                type: CustomImgRenderer,
                // define your option to need to be passed
                options: {},
            },
            sortable: false,
        },
        {
            header: 'Title',
            name: 'title',
            editor: {
                type: 'text',
            },
            sortable: true,
        },
        {
            header: 'Tags',
            name: 'tags',
            editor: {
                type: 'text',
            },
            sortable: true,
        },
        {
            header: 'Description',
            name: 'desc',
            editor: {
                type: 'text',
            }, //CustomTextEditor,
            sortable: true,
        },
        {
            header: 'Approved',
            name: 'a',
            editor: {
                type: 'radio',
                options: {
                    listItems: [
                        { text: 'Approved', value: true },
                        { text: 'Not approved', value: false },
                    ],
                },
            },
            sortable: true,
        },
        {
            header: 'Deactivated',
            name: 'd',
            editor: {
                type: 'radio',
                options: {
                    listItems: [
                        { text: 'Activated', value: false },
                        { text: 'Deactivated', value: true },
                    ],
                },
            },
            sortable: true,
        },
        {
            header: 'Section',
            name: 'section',
            editor: {
                type: 'select',
                options: {
                    listItems: [
                        { text: 'Markets', value: 'markets' },
                        { text: 'Skills', value: 'skills' },
                        { text: 'Blogs', value: 'blogs' },
                        { text: 'Events', value: 'events' },
                        { text: 'Hobbies', value: 'hobbies' },
                    ],
                },
            },
            sortable: true,
        },
    ],
    exportOptions: {},
}

const grid = new Grid(options)

grid.on('beforeRequest', (ev) => {
    const { instance, xhr } = ev
    ev.stop()

    const requestData = instance.getModifiedRows()
    // Issue with library turning values to json: https://github.com/nhn/tui.grid/issues/2011
    // guess string values types and transform them

    const updatedRows = requestData.updatedRows
    updatedRows.forEach((updatedRow) => {
        for (let [key, value] of Object.entries(updatedRow)) {
            updatedRow[key] = guessCast(value)
        }
    })

    xhr.send(JSON.stringify(requestData))
    instance.resetOriginData()
})

grid.on('beforeChange', (ev) => {
    console.log('before change:', ev)
})
grid.on('afterChange', (ev) => {
    grid.request('updateData')
    console.log('after change:', ev)
})

// 'markets' | 'skills' | 'blogs' | 'events' | 'hobbies'
