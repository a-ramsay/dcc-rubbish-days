import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DateTime } from "luxon";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { z } from "zod";

const dynamoDB = DynamoDBDocument.from(new DynamoDB({}));

const apiUrl =
   "https://apps.dunedin.govt.nz/arcgis/rest/services/Public/Refuse_Collection_Property/MapServer/find";

const queryStringSchema = z.object({
   address: z.string().min(1),
});
const envSchema = z.object({
   CACHE_TABLE: z.string(),
});

export async function handler(event: APIGatewayProxyEventV2) {
   const address = queryStringSchema.safeParse(event.queryStringParameters);
   if (!address.success) {
      return {
         statusCode: 400,
         body: JSON.stringify({ error: address.error.message }),
      };
   }

   try {
      const rubbishCollection = await getRubbishCollectionDay(
         address.data.address,
      );
      return {
         statusCode: 200,
         body: JSON.stringify(rubbishCollection),
      };
   } catch (e) {
      let errorMessage = e;
      if (e instanceof Error) errorMessage = e.message;
      return {
         statusCode: 500,
         body: JSON.stringify({ error: errorMessage }),
      };
   }
}

async function getRubbishCollectionDay(address: string) {
   const { CACHE_TABLE } = envSchema.parse(process.env);
   const cached = await checkCache(address, CACHE_TABLE);
   if (cached) return processOutput(cached.results);
   const body = new URLSearchParams();
   const headers = new Headers();

   headers.append("Content-Type", "application/x-www-form-urlencoded");

   body.append("searchText", address);
   body.append("layers", "0");
   body.append("contains", "true");
   body.append("returnGeometry", "false");
   body.append("returnZ", "false");
   body.append("returnM", "false");
   body.append("returnUnformattedValues", "false");
   body.append("returnFieldName", "false");
   body.append("f", "json");

   const req = await fetch(apiUrl, {
      method: "POST",
      headers,
      body,
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
      collectionDayNumber: parseInt(
         rubbishCollection[0].attributes.numberDay,
         10,
      ),
      collectionDay: rubbishCollection[0].attributes.collectionDay,
      currentWeek: formatBinName(rubbishCollection[0].attributes.CurrentWeek),
      address: rubbishCollection[0].value.trim(),
   };

   await writeCache(address, output, CACHE_TABLE);
   return processOutput(output);
}

function processOutput(rubbishCollection: RubbishCollection) {
   return {
      ...rubbishCollection,
      beforeCollectionDay: beforeCollectionDay(
         rubbishCollection.collectionDayNumber,
      ),
      nextCollection: nextCollection(
         rubbishCollection.currentWeek,
         beforeCollectionDay(rubbishCollection.collectionDayNumber),
      ),
   };
}

async function checkCache(address: string, cacheTable: string) {
   const { Item } = await dynamoDB.get({
      TableName: cacheTable,
      Key: { address },
   });

   return Item;
}

async function writeCache(address: string, results: any, cacheTable: string) {
   const endOfDay = DateTime.local().setZone("Pacific/Auckland").endOf("day");
   const timestamp = Math.round(endOfDay.toSeconds());
   await dynamoDB.put({
      TableName: cacheTable,
      Item: {
         address,
         results,
         ttl: timestamp, // Expire cache at midnight
      },
   });
}

function formatBinName(currentWeek: "b" | "y") {
   switch (currentWeek) {
      case "b":
         return "blue";
      case "y":
         return "yellow";
      default:
         return currentWeek;
   }
}

function beforeCollectionDay(collectionDay: number) {
   const date = DateTime.local().setZone("Pacific/Auckland");
   const currentWeekDay = date.weekday;

   if (currentWeekDay <= collectionDay) return true;
   return false;
}

function nextCollection(currentWeek: string, beforeCollectionDay: boolean) {
   if (beforeCollectionDay) return currentWeek;
   switch (currentWeek) {
      case "blue":
         return "yellow";
      case "yellow":
         return "blue";
      default:
         return currentWeek;
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
      "SHAPE.STArea()": string;
      "SHAPE.STLength()": string;
      OBJECTID: string;
   };
}

interface RubbishCollection {
   collectionDayNumber: number;
   collectionDay: string;
   currentWeek: string;
   address: string;
}
