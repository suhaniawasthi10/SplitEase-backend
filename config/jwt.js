import jwt from "jsonwebtoken";
export const genToken = async (id) => {
 try {
   const token = jwt.sign({id}, process.env.JWT_SECRET, {
     expiresIn: "30d",
   });
   return token;
 } catch (err) {
   console.error("Error generating token:", err);
   throw new Error("Unable to generate token");
 }
};
