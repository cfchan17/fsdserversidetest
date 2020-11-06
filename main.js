//imports
const express = require('express')
const handlebars = require('express-handlebars')
const fetch = require('node-fetch')
const withQuery = require('with-query').default
const mysql = require('mysql2/promise')
const morgan = require('morgan')

//create an instance of express app
const app = express()

//configure PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

//configure template engine
app.engine('hbs', handlebars({defaultLayout: 'default.hbs'}))
app.set('view engine', 'hbs')

//Variables for API call
const API_KEY = process.env.API_KEY || ''
const ENDPOINT = 'https://api.nytimes.com/svc/books/v3/reviews.json'

//create mysql connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || '',
    connectionLimit: 4,
    timezone: '+08:00'
})

//SQL Queries
const SQL_GET_TITLES_AND_ID_BY_FIRST_CHAR = 'select book_id, title from book2018 where title like ? order by title asc limit 10 offset ?;'
const SQL_GET_BOOK_BY_ID = 'select * from book2018 where book_id=?;'
const SQL_GET_COUNT_BY_FIRST_CHAR = 'select count(*) as count from book2018 where title like ?'

//Application code
app.use(morgan('combined'))

app.get('/', (req, resp) => {
    const alphabet = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"].map(v => v.toUpperCase());
    const number = [...Array(10).keys()]
    resp.status(200)
    resp.type('text/html')
    resp.render('index', {
        alphabet,
        number
    })
})

app.get('/:getChar/:pageNum', async (req, resp) => {
    const searchChar = req.params.getChar
    const pageNum = parseInt(req.params.pageNum)
    const prevPageNum = pageNum - 1
    const nextPageNum = pageNum + 1
    const offset = (pageNum - 1) * 10
    const conn = await pool.getConnection()
    try {
        const countResult = await conn.query(SQL_GET_COUNT_BY_FIRST_CHAR, `${searchChar.toLowerCase()}%`)
        const count = parseInt(countResult[0][0].count)
        const totalPages = Math.ceil(count/10)
        let hasNextPage = true
        let hasPrevPage = true
        if(pageNum == 1) {
            hasPrevPage = false
        }
        if((pageNum == totalPages) || totalPages == 0) {
            hasNextPage = false
        }
        const result = await conn.query(SQL_GET_TITLES_AND_ID_BY_FIRST_CHAR, [`${searchChar.toLowerCase()}%`, offset])
        const titles = result[0]
        conn.release()

        resp.status(200)
        resp.type('text/html')
        resp.render('catelogue', {
            searchChar,
            titles,
            pageNum,
            hasNextPage,
            hasPrevPage,
            prevPageNum,
            nextPageNum
        })
    }
    catch(e) {
        console.error('DB Error: %s', e)
        resp.status(500)
        resp.type('text/html')
        resp.send('<h3>DB Error</h3>')
    }
})

app.get('/:getChar/:pageNum/:bookid', async (req, resp) => {
    const searchChar = req.params.getChar
    const pageNum = req.params.pageNum
    const bookid = req.params.bookid
    const conn = await pool.getConnection()
    try {
        const result = await conn.query(SQL_GET_BOOK_BY_ID, bookid)
        const book = result[0][0]
        let genres = book.genres.replace(/\|/g, ', ')
        let authors = book.authors.replace(/\|/g, ', ')
        book.genres = genres
        book.authors = authors
        conn.release()

        
        resp.format({
            'text/html': () => {
                resp.status(200)
                resp.render('book_detail', {
                    searchChar,
                    book,
                    pageNum
                })
            },
            'application/json': () => {
                resp.status(200)
                resp.json({
                    bookId: book.book_id,
                    title: book.title,
                    authors: book.authors.split(', '),
                    summary: book.description,
                    pages: book.pages,
                    rating: book.rating,
                    ratingCount: book.rating_count,
                    genre: book.genres.split(', ')
                })
            },
            'default': () => {
                resp.status(406)
                resp.type('text/plain')
                resp.send('406 Error. HTTP Request Not Acceptable.')
            }
        })
    }
    catch(e) {
        console.error('DB Error: %s', e)
        resp.status(500)
        resp.type('text/html')
        resp.send('<h3>DB Error</h3>')
    }
})

app.get('/:getChar/:pageNum/:bookid/reviews', async (req, resp) => {
    const searchChar = req.params.getChar
    const pageNum = req.params.pageNum
    const bookid = req.params.bookid
    const title = req.query.title
    const author = req.query.author.split(', ')[0]
    const url = withQuery(ENDPOINT, {
        'api-key': API_KEY,
        title,
        author
    })
    try{
        const result = await fetch(url)
        const data = await result.json()
        const copyrightString = data.copyright
        const reviews = data.results
        resp.status(200)
        resp.type('text/html')
        resp.render('book_reviews', {
            copyrightString,
            reviews,
            searchChar,
            pageNum,
            bookid
        })
    }
    catch(e) {
        console.error('API Error: ', e)
        resp.status(503)
        resp.type('text/html')
        resp.send('<h3>Service is temporarily unavailable</h3>')
    }
})

//Start the app
pool.getConnection()
    .then(conn => {
        const p0 = Promise.resolve(conn)
        const p1 = conn.ping()
        return Promise.all([p0, p1])
    })
    .then(promiseArray => {
        const conn = promiseArray[0]
        conn.release()
        if(API_KEY) {
            app.listen(PORT, () => {
                console.info(`App has started on port ${PORT} at ${new Date()}`)
            })
        }
        else {
            throw new Error('API_KEY variable is not set')
        }
    })
    .catch(e => {
        console.error('Cannot start server: ', e)
    })