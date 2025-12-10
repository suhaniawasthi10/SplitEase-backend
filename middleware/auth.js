import jwt from "jsonwebtoken";

export const isAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const verifytoken = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = verifytoken.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });   
  }
};


