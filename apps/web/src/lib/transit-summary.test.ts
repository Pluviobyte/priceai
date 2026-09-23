import test from 'node:test';
import assert from 'node:assert/strict';
import { lowest, familyRanges } from './transit-summary';
import type { TransitModelPrice } from './public-pricing';
function price(inputPrice: string | null): TransitModelPrice {
 return {providerSlug:'test',providerName:'Test',modelCode:'gpt',displayName:'GPT',currency:'USD',unit:'per_million_tokens',inputPrice,outputPrice:'1',multiplier:null,evidenceKind:'provider_self_reported',evidenceUrl:'https://example.com',verifiedAt:new Date()};
}
test('station summaries preserve free prices without treating missing prices as free',()=>{
 assert.equal(lowest([price('1'),price('0')]).value,0);
 assert.equal(lowest([price(null)]).value,null);
 assert.deepEqual(familyRanges([price('0'),price('1')]),[{family:'ChatGPT',min:0,max:1}]);
 assert.equal(lowest([{...price(null),multiplier:'0'}]).value,0);
});
