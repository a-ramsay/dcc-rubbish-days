import { query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
export function addressValidationRules() {
   return [
      query('address').exists().trim().escape()
   ]
}

export function validate(req: Request, res: Response, next: NextFunction) {
   const errors = validationResult(req)
   if (errors.isEmpty()) {
      return next()
   }
   return res.status(422).json({
      errors: errors.array(),
   });
}