import express from 'express'
import {quizRoutes} from './routes/quiz.routes.js';
import {userRoutes} from './routes/user.routes.js';
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const port = process.env.PORT 

app.use(express.json());
// app.use(cookieParser());

// Apply rate limiting
// app.use(dynamicRateLimit);

//express routes
app.use('/api/v1/quiz',quizRoutes)
app.use('/api/v1/user',userRoutes)

app.listen(port,()=>{
    console.log(`Server running on port ${port}`)
})