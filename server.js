const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

// app
const app = express()

// database
mongoose
  .connect(process.env.DATABASE_LOCAL, { useNewUrlParser: true })
    .then(() => console.log("DB connected"))
    .catch((err) => console.log("DB Error => ", err));

// middlewares

app.use(morgan('dev'))
app.use(bodyParser.json())
app.use(cookieParser())

if(process.env.NODE_ENV === 'development') {
    app.use(cors({
        origin: process.env.CLIENT_URL
    }))
}


// routes
app.get('/api', (req, res) => {
    res.json({time: Date().toString()})
})

// port
const port = process.env.PORT || 8000
app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})