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

export {registerUser}