import {prisma} from "../utils/prismaClient.js"
import jwt from "jsonwebtoken"

export const verifyJWT  = async(req,res,next)=>{
     try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")|| req.body.accessToken ;
        if(!token){
            return res.status(200).json({ message: "Unauthorized request" });
        }
    
        const decodedTokenInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await prisma.user.findUnique({
            where:{id:decodedTokenInfo.id},
            omit:{refreshToken:true,password:true}
        })
    
        if(!user){
            return res.status(200).json({ message: "Invalid access token" }); 
        }
    
        req.user = user
        next()
    } catch (error) {
        return res.status(401).json({ message: error?.message || "Invalid access token" }); 
    }
}