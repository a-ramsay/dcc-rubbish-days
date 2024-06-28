import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as DynamoDB from "aws-cdk-lib/aws-dynamodb";
import * as Lambda from "aws-cdk-lib/aws-lambda";
import * as Logs from "aws-cdk-lib/aws-logs";
import * as CloudFront from "aws-cdk-lib/aws-cloudfront";
import * as Origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ACM from "aws-cdk-lib/aws-certificatemanager";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Duration } from "aws-cdk-lib";

export class DccRubbishDaysStack extends cdk.Stack {
   constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);

      const certificate = ACM.Certificate.fromCertificateArn(
         this,
         "aramsayCoNzCert",
         "arn:aws:acm:us-east-1:255710643438:certificate/bca8db6b-c78b-45d0-8ca2-657c52a66305",
      );

      const cacheTable = new DynamoDB.Table(this, "CacheTable", {
         partitionKey: { name: "address", type: DynamoDB.AttributeType.STRING },
         billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
         timeToLiveAttribute: "ttl",
      });

      const handler = new NodejsFunction(this, "DccRubbishDays", {
         memorySize: 1024,
         timeout: Duration.seconds(30),
         runtime: Lambda.Runtime.NODEJS_20_X,
         logRetention: Logs.RetentionDays.ONE_MONTH,
         handler: "handler",
         entry: path.join(__dirname, `/../src/dcc-recycling.ts`),
         environment: {
            CACHE_TABLE: cacheTable.tableName,
         },
         bundling: {
            minify: true,
         },
      });
      cacheTable.grantReadWriteData(handler);

      const functionUrl = new Lambda.FunctionUrl(this, "FunctionUrl", {
         function: handler,
         authType: Lambda.FunctionUrlAuthType.NONE,
      });

      const distribution = new CloudFront.Distribution(this, "Distribution", {
         defaultBehavior: {
            origin: new Origins.FunctionUrlOrigin(functionUrl),
            cachePolicy: CloudFront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy:
               CloudFront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            viewerProtocolPolicy:
               CloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
         },
         certificate: certificate,
         domainNames: ["dcc-recycling.aramsay.co.nz"],
         httpVersion: CloudFront.HttpVersion.HTTP2_AND_3,
         minimumProtocolVersion:
            CloudFront.SecurityPolicyProtocol.TLS_V1_2_2021,
      });

      new cdk.CfnOutput(this, "DistributionUrl", {
         value: distribution.distributionDomainName,
      });
   }
}
