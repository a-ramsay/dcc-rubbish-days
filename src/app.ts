import express, { Request, Response } from 'express';
import morgan from 'morgan';
import { getRubbishCollectionDay } from './dcc';
import { addressValidationRules, validate } from './validator';

const app = express();
if (process.env.NODE_ENV === 'production') {
   app.use(morgan('short'))
} else {
   app.use(morgan('dev'))
}

app.get('/', addressValidationRules(), validate, (req: Request, res: Response) => {
   const address = req.query.address as string;
   getRubbishCollectionDay(address).then(result => {
      if (!result) return res.sendStatus(404);
      return res.json(result);
   }).catch(error => {
      console.error(error.stack || error);
      return res.sendStatus(500);
   });
});

export default app;