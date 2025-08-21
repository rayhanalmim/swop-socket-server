import { Router } from 'express'

import publicRoutes from './publicRoutes/publicRoutes.js'
import { getAllEmployees, getEmployeeById, searchEmployee } from '#controllers/EmployeeController/employeeController.js'

const employeeAppRoutes = Router()

employeeAppRoutes.use('/public', publicRoutes)
employeeAppRoutes.route('/search').get(searchEmployee)
employeeAppRoutes.route('/getAllEmployees/:userId').get(getAllEmployees)
employeeAppRoutes.route('/getEmployeeById/:userId').get(getEmployeeById)

export default employeeAppRoutes