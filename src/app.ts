import express from 'express';
import morgan from 'morgan';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import { getRubbishCollectionDay } from './dcc';

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')))
if (process.env.NODE_ENV === 'production') {
   app.use(morgan('short'))
} else {
   app.use(morgan('dev'))
}

app.get('/', (req, res, next) => {
   const address = req.query.address;
   if (!address) {
      return res.status(400).json({error: 'address parameter not found'});
   } else {
      getRubbishCollectionDay(address).then(result => {
         if (!result) return res.sendStatus(404);
         return res.json(result);
      }).catch(error => {
         console.error(error.stack || error);
         return res.sendStatus(500);
      });
   }
});

export default app;
// module.exports.handler = serverless(app);