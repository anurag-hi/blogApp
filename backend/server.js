import express from 'express';
import mongoose from 'mongoose';
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import cors from "cors";
import aws from "aws-sdk";
import Blog from "./Schema/Blog.js"
import User from './Schema/User.js';


const server = express();
let PORT = 3000;

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;   // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/;   // regex for password

server.use(express.json());
server.use(cors())

mongoose.connect(process.env.DB_LOCATION,{
       autoIndex:true
    }
)

// setting up s3 bucket
const s3 = new aws.S3({
    region: 'ap-south-1',
    accessKeyId:process.env.AWS_ACCESS_KEY,
    secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY
})

const generateUploadURL = async()=>{

    const date = new Date();
    const imageName = `${nanoid()}-${date.getTime()}.jpeg`;

    return await s3.getSignedUrlPromise('putObject',{
        Bucket:'anurag-blogging-website',
        Key:imageName,
        Expires:1000,
        ContentType:"image/jpeg"
    })

}

const verifyJWT = (req, res, next)=>{

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(" ")[1];

    if(token == null){
        return res.status(401).json({error: "No access token"})
    }

    jwt.verify(token, process.env.SECRET_ACCESS_KEY, (err, user)=>{
        if(err){
            return res.staus(403).json({error: "Access toke is invalid"})
        }

        req.user = user.id
        next();
    })

}

const formatDatatoSend = (user)=>{

    /*secret access key is generated using node command "require('crypto').randomBytes(64).toString('hex')" it is used to generate access token using user id*/

    const access_token = jwt.sign({id:user._id},process.env.SECRET_ACCESS_KEY)

    return {
        access_token,
        profile_img: user.personal_info.profile_img,
        username: user.personal_info.username,
        fullname: user.personal_info.fullname
    }
}

// check duplicate and generate new username

const generateUsername = async (email)=>{
    let username = email.split("@")[0];

    let usernameExists = await User.exists({"personal_info.username": username}).then((result)=> result)

    //shorten the random characters after username upto 5
    usernameExists ? username += nanoid().substring(0,5) : "";

    return username;
}

//upload image url route

server.get('/get-upload-url',(req,res)=>{
    generateUploadURL().then(url =>res.status(200).json({uploadURL: url}))
    .catch(err=>{
        console.log(err.message)
        return res.status(500).json({error:err.message})
    })
})

//Receiving data from frontend for signup

server.post("/signup",(req,res)=>{

   let { fullname, email = undefined, password } = req.body;

   //validating data from frontend
   if(fullname.length < 3){
    return res.status(403).json({"error":"Fullname must be atleast of 3 letters"})
   }

    //if no email then run it

   if(!email.length){
    return res.status(403).json({"error":"Enter email"})
   }

   // if email is not valid then run it
   
   if(!emailRegex.test(email)){
    return res.status(403).json({"error":"Invalid email"})
   }

   // if password is not valid

   if(!passwordRegex.test(password)){
    return res.status(403).json({"error":"Password must be 6 to 20 characters long with atleast 1 numeric, 1 lowercase and 1 uppercase letter."})
   }

   //hashing the password 10 times

   bcrypt.hash(password, 10, async (err, hashed_password)=>{

    //get username from email

    let username = await generateUsername(email);

    let user = new User({
        personal_info: { fullname, email, password: hashed_password, username}
    })
    user.save().then((u)=>{

        return res.status(200).json(formatDatatoSend(u))

    })
    .catch(err =>{  

        //if email already exists then duplicate error 11000
        if(err.code == 11000){
            return res.status(500).json({"error":"Email already exists !"})
        }
        return res.status(500).json({"error":err.message})
    })
    // 500 internal server error
   })


})

//Receiving data for sign-in

server.post("/signin",(req,res)=>{

    let {email, password} = req.body;

    User.findOne({"personal_info.email":email}).then((user)=>{
        if(!user){
            return res.status(403).json({"error":"Email not found"});
        }

        bcrypt.compare(password,user.personal_info.password,(err,result)=>{
            if(err){
                return res.status(403).json({"error":"Error occured while login please try again"});
            }
            if(!result){
                return res.status(403).json({"error":"Incorrect Password"})
            }
            else{
                return res.status(200).json(formatDatatoSend(user))
            }
        })

        
    })
    .catch(err =>{
        console.log(err);
        return res.status(500).json({"error":err.message})
    })

})

server.get('/latest-blogs', (req,res)=>{

        let maxLimit = 5;
    
        Blog.find({ draft: false })
        .populate("author","personal_info.profile_img personal_info.username personal_info.fullname -_id")
        .sort({ "publishedAt": -1 }) //sorting by recent blog
        .select("blog_id title des banner activity tags publishedAt -_id")
        .limit(maxLimit)
        .then(blogs =>{
            console.log(blogs);
            return res.status(200).json({ blogs });
        })
        .catch(err =>{
            return res.status(500).json({ eerror: err.message })
        })
    
})



server.post('/create-blog', verifyJWT ,(req,res)=>{

    let authorId = req.user;

    let { title, des, banner, tags, content, draft } = req.body;

    if(!title.length){
        return res.status(403).json({error: "You must provide a title to publish the blog !"});
    }

    if(!draft){
        if(!des.length || des.length > 200){
            return res.status(403).json({error: "You must provide blog description under 200 characters !"});
        }
    
        if(!banner.length){
            return res.status(403).json({error: "You must provide a blog banner !"});
        }
    
        if(!content.blocks.length){
            return res.status(403).json({error: "There must be some content to publish the blog !"});
        }
    
        if(!tags.length || tags.length > 30){
            return res.status(403).json({error: "Provide tags in order to publish the blog, Max limit is 10 !"})
        }
    }


    tags = tags.map(tag=> tag.toLowerCase());

    //replace special characters and space in title with dash
    let blog_id = title.replace(/[^a-zA-Z0-9]/g,' ').replace(/\s+/g,"-").trim() + nanoid();
    console.log(blog_id);

    let blog = new Blog({
        title, des, banner, content, tags, author: authorId, blog_id, draft: Boolean(draft)
    })

    blog.save().then(blog =>{

        let incrementVal = draft ? 0: 1;

        User.findOneAndUpdate({_id: authorId}, { $inc: {"account_info.total_posts": incrementVal}, $push:{"blogs": blog._id} })
        .then(user=> {
            return res.status(200).json({id: blog.blog_id})
        })
        .catch(err=>{
            return res.status(500).json({ error: "Failed to update total posts number !"})
        })

    })
    .catch(err=>{
        return res.status(500).json({error: err.message})
    })

    // return res.json({status: 'done'})

})

server.post("/get-blog", (req,res)=>{

    let { blog_id } = req.body;

    let incrementVal =1;

    Blog.findOneAndUpdate({ blog_id }, { $inc : { "activity.total_reads": incrementVal } })
    .populate("author", "personal_info.fullname personal_info.username personal_info.profile_img")
    .select("title des content banner activity publishedAt blog_id tags")
    .then(blog =>{

        User.findOneAndUpdate({ "personal_info.username": blog.author.personal_info.username }, { $inc: { "account_info.total_reads": incrementVal }
     })
     .catch(err =>{
        return res.status(500).json({error: err.message})
     })

        return res.status(200).json({ blog });
    })
    .catch(err => {
        return res.status(500).json({ error: err.message });
    })

})





server.listen(PORT,()=>{
    console.log('listening on port ->'+ PORT);
})

