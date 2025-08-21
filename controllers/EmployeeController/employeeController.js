import Employee from "#models/authModels/employeeModel.js";
import asyncHandler from "express-async-handler";

const searchEmployee = asyncHandler(async (req, res) => {
  const { search } = req.query;

  try {
    // If no search term is provided, return an empty array
    if (!search) {
      return res.status(200).json([]);
    }

    // Query to find employees with names matching the search term
    const employees = await Employee.find({
      name: { $regex: search, $options: "i" }, // Case-insensitive search
    }).select("_id name"); // Return only _id and name fields for simplicity

    // Format data for react-select
    const formattedEmployees = employees.map((employee) => ({
      value: employee._id,
      label: employee.name,
    }));

    return res.status(200).json(formattedEmployees);
  } catch (error) {
    console.error("Error searching employees:", error);
    return res.status(500).json({ message: "Error fetching employees" });
  }
});

const getAllEmployees = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all employees
    const employees = await Employee.find();

    if (!employees.length) {
      return res.status(200).json({ message: "No employees found" });
    }

    // Filter out the employee with the matching userId (senderId)
    const filteredEmployees = employees.filter(employee => employee._id.toString() !== userId);

    // Return the filtered employees as JSON
    return res.status(200).json(filteredEmployees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return res.status(500).json({ message: "Error fetching employees", error: error.message });
  }
});

// Get a single employee by ID
const getEmployeeById = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(userId)
    // Find the employee by ID
    const employee = await Employee.findById(userId); // Exclude sensitive fields like password
    console.log(employee)

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    return res.status(200).json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return res.status(500).json({ message: "Error fetching employee", error: error.message });
  }
});

export { 
  searchEmployee,
  getAllEmployees,
  getEmployeeById
 };
