const Blog = require('../models/blog')
const Category = require('../models/category')
const Tag = require('../models/tag')

const fs = require('fs')
const formidable = require('formidable')
const slugify = require('slugify')
const {stripHtml} = require('string-strip-html')
const _ = require('lodash')

const {errorHandler} = require('../helpers/dbErrorHandler')
const {smartTrim} = require('../helpers/blog')

exports.create = (req, res) => {
    let form = new formidable.IncomingForm() // form data
    // console.log("form ", form)
    form.keepExtensions = true // if file is there in form data
    form.parse(req, (err, fields, files) => {
        if(err) {
            return res.status(400).json({
                error: 'Image could not upload'
            })
        }

        const {title, body, categories, tags} = fields // extract these

        if(!title || !title.length) {
            return res.status(400).json({
                error: 'Title is required'
            })
        }

        if(!body || body.length < 200) {
            return res.status(400).json({
                error: 'Content is too short'
            })
        }

        if(!categories || categories.length === 0) {
            return res.status(400).json({
                error: 'Atleast one category is required'
            })
        }

        if(!tags || tags.length === 0) {
            return res.status(400).json({
                error: 'Atleast one tag is required'
            })
        }
        
        let blog = new Blog()
        blog.title = title
        blog.body = body
        blog.excerpt = smartTrim(body, 320, ' ', ' ...')
        blog.slug = slugify(title).toLowerCase()
        blog.mtitle = `${title} | ${process.env.APP_NAME}`
        blog.mdesc = stripHtml(body.substring(0, 160)).result // first 160 characters
        blog.postedBy = req.profile._id

        let arrayOfCategories = categories && categories.split(',')
        let arrayOfTags = tags && tags.split(',')
       
        if(files.photo) {
            if(files.photo.size > 10000000) { // > 1MB in bytes
                return res.status(400).json({
                    error: 'Image should be less than 1 MB'
                })
            }
            
            blog.photo.data = fs.readFileSync(files.photo.path)
            blog.photo.contentType = files.photo.type 
        }

       blog.save((err, result) => {
           if(err) {
            return res.status(400).json({
                error: errorHandler(err)
            })
           }
           
        //    res.json(result)
        Blog.findByIdAndUpdate(result._id, {$push: {categories: arrayOfCategories}}, {new: true}).exec((err, result) => {
            if(err) {
                return res.status(400).json({
                    error: errorHandler(err)
                })
            } else {
                Blog.findByIdAndUpdate(result._id, {$push: {tags: arrayOfTags}}, {new: true}).exec((err, result) => {
                    if(err) {
                        return res.status(400).json({
                            error: errorHandler(err)
                        })
                    }

                    res.json(result)
                    
                })
            }
        })
       })
    })
}

exports.list = (req, res) => {
    Blog.find({})
    .populate('categories', '_id name slug')
    .populate('tags', '_id name slug')
    .populate('postedBy', '_id name username')
    .select('_id title slug excerpt categories tags postedBy createdAt updatedAt')
    .exec((err, data) => {
        if (err) {
            return res.json({
                error: errorHandler(err)
            })
        }
        res.json(data)
    })

}

exports.listAllBlogsCategoriesTags = (req, res) => {
    let limit = req.body.limit ? parseInt(req.body.limit) : 10
    let skip = req.body.skip ? parseInt(req.body.skip) : 0

    let blogs
    let categories
    let tags 

    Blog.find({})
    .populate('categories', '_id name slug')
    .populate('tags', '_id name slug')
    .populate('postedBy', '_id name username profile')
    .sort({createdAt: -1}) // latest blogs
    .skip(skip)
    .limit(limit)
    .select('_id title slug excerpt categories tags postedBy createdAt updatedAt')
    .exec((err, data) => {
        if (err) {
            return res.json({
                error: errorHandler(err)
            })
        }

        blogs = data 

        // get all categories
        Category.find({}).exec((err, cat) => {
            if (err) {
                return res.json({
                    error: errorHandler(err)
                })
            }

            categories = cat

            // get all tags
            Tag.find({}).exec((err, tag) => {
                if (err) {
                    return res.json({
                        error: errorHandler(err)
                    })
                }

                tags = tag

                // return all blogs, cat, tags
                res.json({blogs, categories, tags, size: blogs.length})
            })
        })
    })
}

exports.read = (req, res) => {
    const slug = req.params.slug.toLowerCase() 
    Blog.findOne({slug})
    .populate('categories', '_id name slug')
    .populate('tags', '_id name slug')
    .populate('postedBy', '_id name username')
    .select('_id title body slug mtitle mdesc photo categories tags postedBy createdAt updatedAt')
    .exec((err, data) => {
        if (err) {
            return res.json({
                error: errorHandler(err)
            })
        }
        res.json(data)
    })
}

exports.remove = (req, res) => {
    const slug = req.params.slug.toLowerCase() 
    Blog.findOneAndRemove({slug})
    .exec((err, data) => {
        console.log(data)
        if (err) {
            return res.json({
                error: errorHandler(err)
            })
        }

        if(data) {
            res.json({
                message: 'Blog deleted successfully'
            })
        } else {
            res.json({
                message: 'Blog not found'
            })
        }
        
    })
}

exports.update = (req, res) => {
    const slug = req.params.slug.toLowerCase() 

    Blog.findOne({slug}).exec((err, oldBlog) => {
        if(err) {
            return res.status(400).json({
                error: errorHandler(err)
            })
        }

        let form = new formidable.IncomingForm()
        form.keepExtensions = true

        form.parse(req, (err, fields, files) => {
            if(err) {
                return res.status(400).json({
                    error: 'Image could not upload'
                })
            }

            let slugBeforeMerge = oldBlog.slug
            oldBlog = _.merge(oldBlog, fields)
            oldBlog.slug = slugBeforeMerge

            

            const {body, categories, tags} = fields

            if(body) {
                oldBlog.excerpt = smartTrim(body, 320, ' ', ' ...')
                oldBlog.mdesc = stripHtml(body.substring(0, 160)).result
            }

            if(categories) {
                oldBlog.categories = categories.split(',')
            }

            if(tags) {
                oldBlog.tags = tags.split(',')
            }
           
            if(files.photo) {
                if(files.photo.size > 10000000) { // > 1MB in bytes
                    return res.status(400).json({
                        error: 'Image should be less than 1 MB'
                    })
                }
                
                oldBlog.photo.data = fs.readFileSync(files.photo.path)
                oldBlog.photo.contentType = files.photo.type 
            }
    
           oldBlog.save((err, result) => {
               if(err) {
                return res.status(400).json({
                    error: errorHandler(err)
                })
               }
               
               res.json(result)
           
           })
        })
    })
}

exports.photo = (req, res) => {
    const slug = req.params.slug.toLowerCase()
    Blog.findOne({slug})
        .select('photo')
        .exec((err, blog) => {
            if(err || !blog) {
                return res.status(400).json({
                    error: errorHandler(error)
                })
            }

            res.set('Content-Type', blog.photo.contentType)
            return res.send(blog.photo.data)
        })
}

exports.listRelated = (req, res) => {
    const limit = req.body.limit ? parseInt(req.body.limit) : 3
    const {_id, categories} = req.body.blog

    // $ne means not including this id
    // $in means including this categories

    // Find blogs who have the same categories as this one but don't return this blog
    Blog.find({_id: {$ne: _id}, categories: {$in: categories}})
        .limit(limit)
        .populate('postedBy', '_id name profile')
        .select('title slug excerpt postedBy createdAt updatedAt')
        .exec((err, blogs) => {
            if(err) {
                return res.status(400).json({
                    error: 'Blogs not found'
                })
            }

            res.json(blogs)
        })
}

exports.listSearch = (req, res) => {
    console.log(req.query)
    const {search} = req.query
    
    // $options: i is case insensitive
    if(search) {
        Blog.find({
            $or: [
                {title: {$regex: search, $options: 'i'}},
                {body: {$regex: search, $options: 'i'}}
            ]
        }, (err, blogs) => {
            if(err) {
                return res.status(400).json({
                    error: errorHandler(err)
                })
            }

            res.json(blogs)

        }).select('-photo -body') // dont send body and photo
    }
}