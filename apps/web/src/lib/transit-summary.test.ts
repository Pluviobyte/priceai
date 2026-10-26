import test from 'node:test';
import assert from 'node:assert/strict';
import { lowest, familyRanges } from './transit-summary';
import type { TransitModelPrice } from './public-pricing';
function price(inputPrice: string | null): TransitModelPrice {
 return {providerSlug:'test',providerName:'Test',modelCode:'gpt',displayName:'GPT',currency:'USD',unit:'per_million_tokens',inputPrice,outputPrice:'1',multiplier:null,evidenceKind:'provider_self_reported',evidenceUrl:'https://example.com',verifiedAt:new Date()};
}
test('station summaries quote the cheapest paid price, count free variants, and never read a missing price as free',()=>{
 // A ":free" variant beside a paid model is not the family's price; "最低 0" misled buyers.
 assert.deepEqual(lowest([price('1'),price('0')]),{value:1,family:'ChatGPT',isMultiplier:false,freeCount:1});
 assert.equal(lowest([price(null)]).value,null);
 assert.deepEqual(familyRanges([price('0'),price('1')]),[{family:'ChatGPT',min:1,max:1}]);
 // Only free variants: free is then the honest answer.
 assert.equal(lowest([{...price(null),multiplier:'0'}]).value,0);
 assert.deepEqual(familyRanges([price('0')]),[{family:'ChatGPT',min:0,max:0}]);
});
