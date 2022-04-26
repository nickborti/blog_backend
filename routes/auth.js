const express = require('express')
const { signup, signin, signout, requireSignin } = require('../controllers/auth')
const router = express.Router()

// validators
const {runValidation} = require('../validators')
const {userSignupValidator, userSigninValidator} = require('../validators/auth')

router.post('/signup', userSignupValidator, runValidation, signup)
router.post('/signin', userSigninValidator, runValidation, signin)
router.get('/signout', signout)

router.get('/secret', requireSignin, (req, res) => {
    res.json({message: 'you have access'})
})

module.exports = router