//imports
const express = require('express')
const handlebars = require('express-handlebars')
const fetch = require('node-fetch')
const withQuery = require('with-query').default
const mysql = require('mysql2')

//create an instance of express app
const app = express()

//configure PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

//configure template engine
app.engine('hbs', handlebars({defaultLayout: 'default.hbs'}))
app.set('view engine', 'hbs')

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

//Application code


//Start the app
app.listen(PORT, () => {
    console.info(`App has started on port ${PORT} at ${new Date()}`)
})