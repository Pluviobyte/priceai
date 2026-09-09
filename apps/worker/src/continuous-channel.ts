import { sql } from 'drizzle-orm';
import { setTimeout as delay } from 'node:timers/promises';
import type { Database } from '@price-radar/database';
import type { CollectorRegistry } from '@price-radar/collector-sdk';
import { crawlSource, vetCandidate, prepareVettingQueue, findChannelWork, recoverClearedPlatformCandidates,
  recoverGrowthCandidates, measureCatalogGrowth, publishLatestSnapshots, seedCanonicalProducts,
  storePublicGenerationSnapshot, evaluatePriceAlerts, refreshSourceQualityProfiles,
  importSourceDirectories, enumerate16688SourceMarketplace } from '@price-radar/pipeline';
import type { WorkerConfig } from './config.js';
import type { ChannelCycleOptions } from './channel-cycle.js';
import { dispatchContinuously, IncrementalPublisher } from './channel-execution.js';

/** One leased dispatcher, continuous per-platform replenishment, independent maintenance. */
export async function runContinuousChannelWork(db:Database,registry:CollectorRegistry,config:WorkerConfig,options:ChannelCycleOptions) {
  const signal=options.signal??new AbortController().signal,log=options.log??(()=>undefined);
  const totals={attempted:0,complete:0,failed:0,vetted:0,approved:0};
  const storage=options.rawObjectStore?{rawObjectStore:options.rawObjectStore}:{};
  const publisher=new IncrementalPublisher(async()=>{
    const started=Date.now();await seedCanonicalProducts(db);
    const publication=await publishLatestSnapshots(db);
    log({event:'channels_published',...publication,durationMs:Date.now()-started});
    if(options.rawObjectStore) await storePublicGenerationSnapshot(db,options.rawObjectStore,publication.generationId).catch(error=>log({event:'public_snapshot_failed',error:String(error)}));
    await evaluatePriceAlerts(db,publication.generationId).catch(error=>log({event:'price_alert_evaluation_failed',error:String(error)}));
  },error=>log({event:'incremental_publication_failed',error:String(error)}));
  const maintain=async()=>{
    await prepareVettingQueue(db);
    const recovered=await recoverClearedPlatformCandidates(db,1000);
    if(recovered.requeued)log({event:'platform_candidates_recovered',...recovered});
    if(process.env.COLLECTOR_GROWTH_RECOVERY==='true')await recoverGrowthCandidates(db,100);
    const growth=await measureCatalogGrowth(db);log({event:'catalog_growth',...growth});
    log({event:'channel_progress',...totals});
    await db.execute(sql`insert into system_metric_samples(service,metric,value,unit,labels)
      values('channel-worker','catalog_valid_offers',${String(growth.valid_offers??0)},'offers',${JSON.stringify(growth)}::jsonb)`);
    await refreshSourceQualityProfiles(db,{limit:10,maxAgeMs:config.qualityProfileMaxAgeMs});
    if(config.sourceDiscoveryEnabled&&!options.skipDiscovery){
      await importSourceDirectories(db,{signal,minIntervalMs:config.sourceDirectoryImportIntervalMs});
      await enumerate16688SourceMarketplace(db,{signal,minIntervalMs:config.sourceDirectoryImportIntervalMs});
    }
  };
  await prepareVettingQueue(db);
  const recovered=await recoverClearedPlatformCandidates(db,1000);
  if(recovered.requeued)log({event:'platform_candidates_recovered',...recovered});
  let stopping=false;
  const maintenanceAbort=new AbortController();
  const maintenance=(async()=>{
    while(!stopping&&!signal.aborted){
      await delay(60_000,undefined,{signal:AbortSignal.any([signal,maintenanceAbort.signal])}).catch(()=>undefined);
      if(stopping||signal.aborted)break;
      try{await maintain();}catch(error){log({event:'channel_maintenance_failed',error:String(error)});}
    }
  })();
  log({event:'continuous_dispatcher_started',platformConcurrency:config.channelPlatformConcurrency});
  try{
    await dispatchContinuously({concurrency:config.channelPlatformConcurrency,signal,
      pull:busy=>findChannelWork(db,busy,config.sourceDiscoveryEnabled&&!options.skipVetting),
      onError:error=>log({event:'channel_job_failed',error:String(error)}),
      work:async job=>{
        const started=Date.now();log({event:'channel_job_started',kind:job.kind,platform:job.platform,id:job.id});
        try{
          if(job.kind==='crawl'){
            totals.attempted++;
            const result=await crawlSource(db,registry,job.id,{signal,...storage});
            if(result.status==='success'&&(result.completeSnapshot||result.updatedSnapshot)){if(result.completeSnapshot)totals.complete++;publisher.changed();}else totals.failed++;
            log({event:'source_crawled',sourceId:job.id,platform:job.platform,...result,durationMs:Date.now()-started});
          }else{
            const result=await vetCandidate(db,registry,job.id,{signal,...storage});totals.vetted++;
            if(result.status==='approved'){totals.approved++;publisher.changed();}
            log({event:'candidate_vetted',...result,profile:undefined,platform:job.platform,durationMs:Date.now()-started});
          }
        }finally{
          await db.execute(sql`insert into collector_platform_state(key,last_served_at) values(${job.platform},now())
            on conflict(key) do update set last_served_at=now()`);
        }
      }});
  }finally{
    stopping=true;maintenanceAbort.abort();await maintenance;await publisher.flush();
  }
  return {crawl:{attempted:totals.attempted,complete:totals.complete,failed:totals.failed}};
}
