# DCC Rubbish (Recycling) Days ♻

Remembering which recycling bin to take out in the morning rush is possibly one of the greatest challenges we're faced with. This API allows to search by house address and retrieve the collection day as well what colour bin is being collected. This can then be integrated into a home automation service of choice for automatic alerts, coloured lights, sentient robots, etc.

This API pulls data from the Dunedin City Council GIS public API and calculates the next colour bin. Results are cached until local midnight as that is when the GIS system updates.

This project is setup as a CDK project that deploys to Lambda/CloudFront for production.

## Commands

### Deployment

```bash
# Install dependencies
npm i

# Deploy
cdk deploy
```
