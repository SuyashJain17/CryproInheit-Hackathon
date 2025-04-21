import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const SALT_ROUNDS = 10;

app.use(express.json());

const UserSchema = z.object({
  publickey : z.string(),
  name: z.string().min(1, 'Name is required'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be in YYYY-MM-DD format'),
});

interface UserData {
  publicKey: string;
  name: string;
  dob: string;
}


// Single /user route
app.route('/user')
  // Create a new user
  .post(async (req: Request<{}, {}, UserData>, res: Response) => {
    const parsedData = UserSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.json({ message: 'Incorrect inputs' });
      return;
    }

    try {
      const { name, dob, publickey: publicKey } = parsedData.data;
      const dataToHash = JSON.stringify({ name, dob ,publicKey });
      const hashedData = await bcrypt.hash(dataToHash, SALT_ROUNDS);

      const user = await prisma.user.create({
        data: {
          publicKey,
          hashedData,
        },
      });

      res.json({ publicKey, hashedData });
    } catch (e) {
      console.error('Error creating user:', e);
      res.status(411).json({ message: 'Error creating user' });
    }
  })
  

app.listen(PORT, () => {
  console.log(`HTTP Server running on port ${PORT}`);
});