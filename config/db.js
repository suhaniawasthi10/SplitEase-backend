import mongoose from "mongoose";

const connectDB = async()=>{
    try {
        const connect = await mongoose.connect(process.env.MONGO_URL);
        console.log('mongodb connected')
    } catch (error) {
        console.log("mongodb connection error",error);
        process.exit(1);  
    }
}

export default connectDB