import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import Employee from "../models/authModels/employeeModel.js";

const { verify } = jwt;

const protectForCustomer = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
     
      const decoded = verify(token, process.env.JWT_SECRET);

      req.customer = await Customer.findById(decoded.id).select("-password");

      next();
    } catch (error) {
      console.log(error);
      res.send(401);
      throw new Error("Not Authorized");
    }
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});
const protectForEmployee = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = verify(token, process.env.JWT_SECRET);

      req.employee = await Employee.findById(decoded.id).select("-password");

      next();
    } catch (error) {
      res.send(401);
      throw new Error("Not Authorized");
    }
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

export { protectForCustomer, protectForEmployee };
