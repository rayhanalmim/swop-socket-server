import mongoose from 'mongoose';
import colors from 'colors';
async function connectDB() {
  try {
    const { connection } = await mongoose.connect(process.env.MONGO_URI);
    console.log(colors.cyan.underline(`MongoDB Connected: ${connection.host}`));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed due to SIGTERM');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});

export default connectDB;
