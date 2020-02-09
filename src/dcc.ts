import fetch, { Headers } from 'node-fetch';
import { DateTime } from 'luxon';
import * as AWS from 'aws-sdk';
import { URLSearchParams } from 'url';

const apiUrl = 'https://apps.dunedin.govt.nz/arcgis/rest/services/Public/Refuse_Collection_Property/MapServer/find';
const tableName = process.env.CACHE_TABLE_NAME || 'rubbishCache';
const dynamoDb = new AWS.DynamoDB.DocumentClient();

export async function getRubbishCollectionDay(address: string) {
   const cached = await checkCache(address);
   if (cached) return processOutput(cached.results);

   const body = new URLSearchParams();
   const headers = new Headers();
   
   headers.append('Content-Type', 'application/x-www-form-urlencoded');

   body.append('searchText', address);
   body.append('layers', '0');
   body.append('contains', 'true');
   body.append('returnGeometry', 'false');
   body.append('returnZ', 'false');
   body.append('returnM', 'false');
   body.append('returnUnformattedValues', 'false');
   body.append('returnFieldName', 'false');
   body.append('f', 'json');

   const req = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body
   });

   if (!req.ok) {
      const error = await req.text();
      throw new Error(error || req.statusText);
   }

   const result = await req.json();
   if (result.error) throw new Error(result.error.message);
   if (result.results.length === 0) return undefined;
   const rubbishCollection = result.results as DCCRubbishCollection[];

   const output = {
      collectionDayNumber: parseInt(rubbishCollection[0].attributes.numberDay, 10),
      collectionDay: rubbishCollection[0].attributes.collectionDay,
      currentWeek: formatBinName(rubbishCollection[0].attributes.CurrentWeek),
      address: rubbishCollection[0].value.trim(),
   };

   await writeCache(address, output);
   return processOutput(output);
}

function processOutput(rubbishCollection: RubbishCollection) {
   return {
      ...rubbishCollection,
      beforeCollectionDay: beforeCollectionDay(rubbishCollection.collectionDayNumber),
      nextCollection: nextCollection(rubbishCollection.currentWeek, beforeCollectionDay(rubbishCollection.collectionDayNumber))
   };
}

async function checkCache(address: string) {
   if (process.env.DISABLE_CACHE) return undefined;
   const cacheHit = await dynamoDb.get({
      TableName: tableName,
      Key: { address }
   }).promise();

   return cacheHit.Item
}

async function writeCache(address: string, results: any) {
   if (process.env.DISABLE_CACHE) return;
   const endOfDay = DateTime.local().setZone('Pacific/Auckland').endOf('day');
   const timestamp = Math.round(endOfDay.toSeconds());
   await dynamoDb.put({
      TableName: tableName,
      Item: {
         address,
         results,
         ttl: timestamp // Expire cache at midnight
      }
   }).promise();
}

function formatBinName(currentWeek: "b" | "y") {
   switch(currentWeek) {
      case "b": return "blue";
      case "y": return "yellow";
      default: return currentWeek;
   }
}

function beforeCollectionDay(collectionDay: number) {
   const systemUpdateDay = 6;
   const date = DateTime.local().setZone('Pacific/Auckland');
   const currentWeekDay = date.weekday;
   if (currentWeekDay >= systemUpdateDay) return true;
   if (currentWeekDay <= collectionDay) return true;
   return false;
}

function nextCollection(currentWeek: string, beforeCollectionDay: boolean) {
   if (beforeCollectionDay) return currentWeek;
   switch (currentWeek) {
      case 'blue': return 'yellow';
      case 'yellow': return 'blue';
      default: return currentWeek;
   }
}

interface DCCRubbishCollection {
   layerId: number;
   layerName: string;
   displayFieldName: string;
   foundFieldName: string;
   value: string;
   attributes: {
      AddressStreet: string;
      AddressNumber: string;
      fmtaddress: string;
      collectionDay: string;
      numberDay: string;
      CurrentWeek: "b" | "y";
      strhousnum: string;
      tpklpaprop: string;
      SHAPE: string;
      'SHAPE.STArea()': string;
      'SHAPE.STLength()': string;
      OBJECTID: string;
   };
}

interface RubbishCollection {
   collectionDayNumber: number;
   collectionDay: string;
   currentWeek: string;
   address: string;
}