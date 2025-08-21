import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const employeeInviteSchema = Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Employee'
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true
    }
}, {
    timestamps: true
})

export default model('EmployeeInvite', employeeInviteSchema);