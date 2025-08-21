import jwt from 'jsonwebtoken';

const { sign, verify } = jwt;

// Generate Token
export function generateToken(id) {
  return sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}
