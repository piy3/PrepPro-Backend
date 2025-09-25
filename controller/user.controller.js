import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import {prisma} from "../utils/prismaClient.js"

const registerUser = async(req,res)=>{
    try {
        const {fullname,email,password} = req.body;
        if(!fullname || !email || !password){
            return res.status(404).json({
                success:false,
                message:"All fields are required."
            })
        }
        const existingUser = await prisma.user.findUnique({
            where:{
                email:email
            }
        })
        if(existingUser){
            return res.status(404).json({
                success:false,
                message:"User already exists."
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data:{
                fullname,
                email,
                password:hashedPassword
            }
        })
        //recheking if user created successfully
        const createdUser = await prisma.user.findUnique({
            where:{
                id:user.id
            },
            select: {
                id: true,
                fullname: true,
                email: true,
                createdAt: true,
                updatedAt: true
                // exclude password & refreshToken by not selecting them
              }
        })
        if(!createdUser){
            return res.status(500).json({
                success:false,
                message:"User not created.Try Again!"
            })
        }
        return res.status(200).json({
            success:true,
            message:"User created successfully",
            createdUser
        })
        
    } catch (error) {
        return res.status(500).json({
            success:false,
            message:"User not created.Try Again!",
            error:error.message
        })
    }
}

const loginUser = async(req,res)=>{
    try {
        const {email,password} = req.body;
        if(!email || !password){
            return res.status(404).json({
                success:false,
                message:"All fields are required."
            })
        }
        //checking if user exists or not
        const user = await prisma.user.findUnique({
            where:{
                email:email
            }
        })
        if(!user){
            return res.status(200).json({
                success:false,
                message:"User not found."
            })
        }
        const isPasswordValid = await bcrypt.compare(password,user.password);
        if(!isPasswordValid){
            return res.status(200).json({
                success:false,
                message:"Invalid password."
            })
        }
        const accessToken = jwt.sign({id:user.id},process.env.ACCESS_TOKEN_SECRET,{
            expiresIn:process.env.ACCESS_TOKEN_EXPIRY
        })  
        const refreshToken = jwt.sign({id:user.id},process.env.REFRESH_TOKEN_SECRET,{
            expiresIn:process.env.REFRESH_TOKEN_EXPIRY
        })
        user.refreshToken = refreshToken;
        await prisma.user.update({
            where:{
                id:user.id
            },
            data:{
                refreshToken:refreshToken
            }
        })
        const options = {
            httpOnly:true,
            secure:true,
            sameSite:"strict"
        }
        res.cookie("accessToken",accessToken,options)
        res.cookie("refreshToken",refreshToken,options)
        const loggedInUser = await prisma.user.findUnique({
            where:{
                id:user.id
            },
            omit:{
                password:true,
                refreshToken:true
            }
        })
        return res.status(200).json({
            success:true,
            message:"User logged in successfully",
            loggedInUser
        })
    } catch (error) {
        return res.status(500).json({
            success:false,
            message:"User not logged in.Try Again!",
            error:error.message
        })
    }
}

const authUser = async(req,res)=>{
    try{
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")|| req.body.accessToken ;
        if(!token){
            return res.status(200).json({ message: "Unauthorized request" });
        }
    
        const decodedTokenInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await prisma.user.findUnique({
            where:{
                id:decodedTokenInfo?.id
            },
            omit:{
                password:true,
                refreshToken:true
            }
        })
        if(!user){
            return res.status(200).json({ message: "Invalid access token" }); 
        }
        return res.status(200).json({
            success:true,
            message:"User authenticated successfully",
            user
        })
    }catch(error){
        return res.status(200).json({
            success:false,
            message:"User not authenticated.Try Again!",
            error:error.message
        })
    }
}

export {registerUser,loginUser,authUser}