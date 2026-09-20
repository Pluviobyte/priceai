import { readFileSync } from 'node:fs';
const status=JSON.parse(readFileSync(0,'utf8'));
if(!Array.isArray(status.providers)||typeof status.healthy!=='boolean')throw new Error('Invalid discovery status');
console.log(JSON.stringify(status,null,2));
for(const provider of status.providers){
  for(const issue of provider.issues)console.error(`::error::Discovery ${provider.provider}: ${issue}`);
  for(const warning of provider.warnings)console.error(`::warning::Discovery ${provider.provider}: ${warning}`);
}
if(!status.healthy)process.exitCode=1;
