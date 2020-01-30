import express from 'express';
import morgan from 'morgan';
import * as bodyParser from 'body-parser';
import * as path from 'path';

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
   res.json({hello: 'world'});
});

app.listen(port, () => {
   console.log(`Server listening on port ${port}`);
});