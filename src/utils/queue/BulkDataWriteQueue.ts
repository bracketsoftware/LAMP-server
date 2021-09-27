import Bull from "bull"
import { Repository } from "../../repository/Bootstrap"
import { RedisClient } from "../../repository/Bootstrap"
import { Mutex } from "async-mutex"
const clientLock = new Mutex()
const Max_Store_Size = 20000
/** Queue Process
 *
 * @param job
 */
export async function BulkDataWriteQueueProcess(job: Bull.Job<any>): Promise<void> {  
  switch (job.data.key) {
    case "sensor_event":
      //wait for same participant with same timestamp
      const release = await clientLock.acquire()
      let write = false
      const participant_id = job.data.participant_id
      const Store_Size = (await RedisClient?.llen(participant_id)) as number      
      let  Store_Data = new Array
      if (Store_Size > Max_Store_Size) {
        console.log("Store_Size", `${participant_id}-${Store_Size}`)
        Store_Data = (await RedisClient?.lrange(participant_id, 0, Max_Store_Size)) as any       
        write = true
        await RedisClient?.ltrim(participant_id, Max_Store_Size, -1)
      }
      release()
      if (write) {   
        console.log("Store_length to write", `${participant_id}-${Store_Data.length}}`)     
        SaveSensorEvent(Store_Data) 
      }       

      break
    default:
      break
  }
}

/** push to db from redis batch wise
 *
 */
async function PushFromRedis(Q_Name: string, Store_Size: number) {
  console.log("Store_Size to be processed for db write", `${Q_Name}--${Store_Size}`)
  for (let i = 0; i < Store_Size; i = i + 501) {
    try {
      const start = i === 0 ? i : i + 1
      const end = i + 501
      if (start >= Store_Size) break
      const Store_Data = (await RedisClient?.lrange(Q_Name, start, end)) as any
      SaveSensorEvent(Store_Data)
    } catch (error) {}
  }
  try {
    console.log("---Store_Size to be processed for trimming", `${Q_Name}--${Store_Size}`)
    //Remove data from redis store
    await RedisClient?.ltrim(Q_Name, Store_Size, -1)
  } catch (error) {
    console.log(error)
  }
}

/** save bulk sensor event data
 *
 * @param datas
 */
async function SaveSensorEvent(datas: any[]) {
  console.log("write started timestamp",Date.now())
  const repo = new Repository()
  const SensorEventRepository = repo.getSensorEventRepository()
  let sensor_events: any[] = []
  for (const data of datas) {
    const participant_id = JSON.parse(data).participant_id
    const sensor_event = JSON.parse(data)
    await delete sensor_event.participant_id
    if (process.env.DB?.startsWith("mongodb://")) {
      await sensor_events.push({ ...sensor_event, _parent: participant_id })
    } else {
      await sensor_events.push({ ...sensor_event, "#parent": participant_id })
    }
  }
  try {
     let obj = await SensorEventRepository._bulkWrite(sensor_events)
     console.log("bulk write finished",obj)
     console.log("write finished timestamp",Date.now())
  } catch (error) {
    console.log("db write error", error)
  }
}