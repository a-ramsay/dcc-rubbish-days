import express from 'express';
import morgan from 'morgan';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import { getRubbishCollectionDay } from './dcc';
import serverless from 'serverless-http';

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')))
if (process.env.NODE_ENV === 'production') {
   app.use(morgan('short'))
} else {
   app.use(morgan('dev'))
}

const port = process.env.PORT || 3000;

app.get('/', (req, res, next) => {
   const address = req.query.address;
   getRubbishCollectionDay(address).then(result => {
      if (!result) return res.sendStatus(404);
      return res.json(result);
   }).catch(error => {
      console.error(error.stack || error);
      return res.sendStatus(500);
   });
});

app.listen(port, () => {
   console.log(`Server listening on port ${port}`);
});

module.exports.handler = serverless(app);