import express from 'express'
import {quizRoutes} from './routes/quiz.routes.js';
import {userRoutes} from './routes/user.routes.js';
import dotenv from 'dotenv'
import cors from "cors"
import cookieParser from "cookie-parser"

dotenv.config()

const app = express()
const port = process.env.PORT 

const isProd = process.env.NODE_ENV === "production";
const origin = isProd ? process.env.PROD_ORIGIN : process.env.DEV_ORIGIN;

app.use(cors({ 
  origin:origin,
  optionsSuccessStatus: 200,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Apply rate limiting
// app.use(dynamicRateLimit); 

//express routes
app.use('/api/v1/quiz',quizRoutes)
app.use('/api/v1/user',userRoutes)

app.listen(port,()=>{
    console.log(`Server running on port ${port}`)
})