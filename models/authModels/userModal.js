import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const userModal = Schema({
   
    // Added fields for external identifiers
    privyId: {
        type: String,
        sparse: true,
        index: true
    },
    ethAddress: {
        type: String,
        sparse: true,
        index: true
    }
}, {
    timestamps: true
})

export default model('User', userModal);
