import { Request, Response, Router } from "express"
import { Researcher } from "../model/Researcher"
import { SecurityContext, ActionContext, _verify } from "./Security"
const jsonata = require("../utils/jsonata") // FIXME: REPLACE THIS LATER WHEN THE PACKAGE IS FIXED
import { PubSubAPIListenerQueue } from "../utils/queue/PubSubAPIListenerQueue"
import { Repository } from "../repository/Bootstrap"
import { CacheDataQueue } from "../utils/queue/CacheDataQueue"
import { RedisClient } from "../repository/Bootstrap"

export const ResearcherService = Router()
ResearcherService.post("/researcher", async (req: Request, res: Response) => {
  try {
    const repo = new Repository()
    const ResearcherRepository = repo.getResearcherRepository()
    const researcher = req.body

    const _ = await _verify(req.get("Authorization"), [])
    const output = { data: await ResearcherRepository._insert(researcher) }
    researcher.action = "create"
    researcher.researcher_id = output["data"]

    //publishing data for researcher add api with token = researcher.{_id}
    PubSubAPIListenerQueue.add({ topic: `researcher`, token: `researcher.${output["data"]}`, payload: researcher })
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})

ResearcherService.put("/researcher/:researcher_id", async (req: Request, res: Response) => {
  try {
    const repo = new Repository()
    const ResearcherRepository = repo.getResearcherRepository()
    let researcher_id = req.params.researcher_id
    const researcher = req.body
    researcher_id = await _verify(req.get("Authorization"), ["self", "parent"], researcher_id)
    const output = { data: await ResearcherRepository._update(researcher_id, researcher) }
    researcher.action = "update"
    researcher.researcher_id = researcher_id

    //publishing data for researcher update api with token = researcher.{researcher_id}
    PubSubAPIListenerQueue.add({ topic: `researcher.*`, token: `researcher.${researcher_id}`, payload: researcher })
    PubSubAPIListenerQueue.add({ topic: `researcher`, token: `researcher.${researcher_id}`, payload: researcher })
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ResearcherService.delete("/researcher/:researcher_id", async (req: Request, res: Response) => {
  try {
    const repo = new Repository()
    const ResearcherRepository = repo.getResearcherRepository()
    let researcher_id = req.params.researcher_id
    researcher_id = await _verify(req.get("Authorization"), ["self", "parent"], researcher_id)
    const output = { data: await ResearcherRepository._delete(researcher_id) }

    //publishing data for researcher delete api with token = researcher.{researcher_id}
    PubSubAPIListenerQueue.add({
      topic: `researcher.*`,
      token: `researcher.${researcher_id}`,
      payload: { action: "delete", researcher_id: researcher_id },
    })
    PubSubAPIListenerQueue.add({
      topic: `researcher`,
      token: `researcher.${researcher_id}`,
      payload: { action: "delete", researcher_id: researcher_id },
    })
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ResearcherService.get("/researcher/:researcher_id", async (req: Request, res: Response) => {
  try {
    const repo = new Repository()
    const ResearcherRepository = repo.getResearcherRepository()
    let researcher_id = req.params.researcher_id
    researcher_id = await _verify(req.get("Authorization"), ["self", "parent"], researcher_id)
    let output = { data: await ResearcherRepository._select(researcher_id) }
    output = typeof req.query.transform === "string" ? jsonata(req.query.transform).evaluate(output) : output
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ResearcherService.get("/researcher", async (req: Request, res: Response) => {
  try {
    const repo = new Repository()
    const ResearcherRepository = repo.getResearcherRepository()
    const _ = await _verify(req.get("Authorization"), [])
    let output = { data: await ResearcherRepository._select() }
    output = typeof req.query.transform === "string" ? jsonata(req.query.transform).evaluate(output) : output
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})

/**Researcher lookup -Take studies with either  participant,participantcount OR activities,activitycount OR sensor,sensor count
 * lookup can be  participant, activity, sensor
 * Data cacheing for 5 minutes available( IF studyID is given as query param, take data based on that studyID from db itself (i.e cache is ignored))
 * @param STRING researcher_id
 * @param STRING lookup
 * @return ARRAY
 */
ResearcherService.get("/researcher/:researcher_id/_lookup/:lookup", async (req: Request, res: Response) => {
  try {
    const _lookup: string = req.params.lookup
    const studyID: string = (!!req.query.study_id ? req.query.study_id : undefined) as any
    let researcher_id: string = req.params.researcher_id
    const _ = await _verify(req.get("Authorization"), ["self", "parent"], researcher_id)
    //PREPARE DATA FROM DATABASE
    let activities: object[] = []
    let sensors: object[] = []
    let study_details: object[] = []
    const repo = new Repository()
    const ActivityRepository = repo.getActivityRepository()
    const SensorRepository = repo.getSensorRepository()
    const StudyRepository = repo.getStudyRepository()
    const ParticipantRepository = repo.getParticipantRepository()
    const TypeRepository = repo.getTypeRepository()
    //Fetch Studies
    const studies = !!studyID
      ? ((await StudyRepository._select(studyID, false)) as any)
      : ((await StudyRepository._select(researcher_id, true)) as any)
    if (_lookup === "participant") {
      let cacheData: any = {}
      try {
        cacheData = await RedisClient?.get(`${researcher_id}_lookup:participants`)
      } catch (error) {}
      if (null === cacheData || undefined !== studyID) {
        console.log("cache data absent for activities")
        let tags = false
        try {
          //fetch participants based on study and researcher tags  from database
          tags = await TypeRepository._get("a", <string>researcher_id, "to.unityhealth.psychiatry.enabled")
        } catch (error) {}
        for (const study of studies) {
          let participants: object[] = []
          //Taking Participants count
          const Participants: any = await ParticipantRepository._lookup(study.id, true)
          study.participants_count = Participants.length
          for (const participant of Participants) {
            await participants.push({ ...participant, study_name: study.name })
          }
          await study_details.push({
            participant_count: Participants.length,
            id: study.id,
            name: study.name,
            participants: participants,
          })
        }
        if (undefined === studyID) {
          try {
            //add the list of participants and researcher tags to cache for next 5 mts
            CacheDataQueue.add({
              key: `${researcher_id}_lookup:participants`,
              payload: { studies: study_details, unityhealth_settings: tags },
            })
          } catch (error) {}
        }
        res.json({ studies: study_details, unityhealth_settings: tags })
      } else {
        console.log("cache data present for activities")
        const result = JSON.parse(cacheData)
        res.json({ studies: result.studies, unityhealth_settings: result.unityhealth_settings })
      }
    } else if (_lookup === "activity") {
      let cacheData: any = {}
      try {
        //Check in redis cache for activities
        cacheData = await RedisClient?.get(`${researcher_id}_lookup:activities`)
      } catch (error) {}

      if (null === cacheData || undefined !== studyID) {
        console.log("cache data absent for activities")
        //fetch activities based on study from database
        for (const study of studies) {
          const Activities = await ActivityRepository._lookup(study.id, true)
          for (const activity of Activities) {
            await activities.push({ ...activity, study_name: study.name })
          }
          await study_details.push({ activity_count: Activities.length, study_id: study.id, study_name: study.name })
        }
        if (undefined === studyID) {
          try {
            //add the list of activities  to cache for next 5 mts
            CacheDataQueue.add({
              key: `${researcher_id}_lookup:activities`,
              payload: { studies: study_details, activities: activities },
            })
          } catch (error) {}
        }
        res.json({ studies: study_details, activities: activities })
      } else {
        console.log("cache data present for activities")
        const result = JSON.parse(cacheData)
        res.json({ studies: result.studies, activities: result.activities })
      }
    } else if (_lookup === "sensor") {
      let cacheData: any = {}
      try {
        //Check in redis cache for Sensors
        cacheData = await RedisClient?.get(`${researcher_id}_lookup:sensors`)
      } catch (error) {}

      if (null === cacheData || undefined !== studyID) {
        console.log("cache data absent for sensors")
        //fetch sensors based on study from database
        for (const study of studies) {
          const Sensors = await SensorRepository._lookup(study.id, true)
          for (const sensor of Sensors) {
            await sensors.push({ ...sensor, study_name: study.name })
          }
          await study_details.push({ sensor_count: Sensors.length, study_id: study.id, study_name: study.name })
        }
        if (undefined === studyID) {
          try {
            //add the list of sensors to cache for next 5 mts
            CacheDataQueue.add({
              key: `${researcher_id}_lookup:sensors`,
              payload: { studies: study_details, sensors: sensors },
            })
          } catch (error) {}
        }
        res.json({ studies: study_details, sensors: sensors })
      } else {
        console.log("cache data present for sensors")
        const result = JSON.parse(cacheData)
        res.json({ studies: result.studies, sensors: result.sensors })
      }
    }
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})

/** Study lookup -Take study based participant's tags,activity_events,sensor_events
 * lookup can be  participant only
 * Data cacheing for 5 minutes
 *  @param study_id STRING
 *  @param lookup STRING
 *  @param mode STRING
 *  @return JSON
 *  mode 3- return  lamp.name and to.unityhealth.psychiatry.settings,4-return  lamp.name only
 *  mode 1 - return only gps,accelerometer,analytics, mode 2- return only activity_event data
 */
ResearcherService.get("/study/:study_id/_lookup/:lookup/mode/:mode", async (req: Request, res: Response) => {
  try {
    const repo = new Repository()
    const ParticipantRepository = repo.getParticipantRepository()
    const TypeRepository = repo.getTypeRepository()
    const SensorEventRepository = repo.getSensorEventRepository()
    const ActivityEventRepository = repo.getActivityEventRepository()
    let studyID: string = req.params.study_id
    const _ = await _verify(req.get("Authorization"), ["self", "parent"], studyID)
    let lookup: string = req.params.lookup
    let mode: number | undefined = Number.parse(req.params.mode)
    //IF THE LOOK UP IS PARTICIPANT
    if (lookup === "participant") {
      const ParticipantIDs = (await ParticipantRepository._select(studyID, true)) as any
      for (let index = 0; index < ParticipantIDs.length; index++) {
        try {
          //Fetch participant's name i.e mode=3 OR 4
          if (mode === 3 || mode === 4) {
            //fetch data from redis if any
            const cacheData = await RedisClient?.get(`${ParticipantIDs[index].id}:name`) || null
            if (null !== cacheData) {
              const result = JSON.parse(cacheData)
              ParticipantIDs[index].name = result.name
            } else {
              let tags_participant_name = ""
              try {
                tags_participant_name = await TypeRepository._get("a", ParticipantIDs[index].id, "lamp.name")
                ParticipantIDs[index].name = tags_participant_name
                CacheDataQueue.add({
                  key: `${ParticipantIDs[index].id}:name`,
                  payload: { name: tags_participant_name },
                })
              } catch (error) {}
            }
          }
        } catch (error) {}
        try {
          //Fetch participant's unity settings i.e mode=3
          if (mode === 3) {
            //fetch data from redis if any
            const cacheData = await RedisClient?.get(`${ParticipantIDs[index].id}:unity_settings`) || null
            if (null !== cacheData) {
              const result = JSON.parse(cacheData)
              ParticipantIDs[index].unity_settings = result.unity_settings
            } else {
              let tags_participant_unity_setting: {} = {}
              try {
                tags_participant_unity_setting = await TypeRepository._get(
                  "a",
                  ParticipantIDs[index].id,
                  "to.unityhealth.psychiatry.settings"
                )
                ParticipantIDs[index].unity_settings = tags_participant_unity_setting
                CacheDataQueue.add({
                  key: `${ParticipantIDs[index].id}:unity_settings`,
                  payload: { unity_settings: tags_participant_unity_setting },
                })
              } catch (error) {}
            }
          }
        } catch (error) {}
        try {
          //Fetch participant's gps data i.e mode=1
          if (mode === 1) {
            //fetch data from redis if any
            const cacheData = await RedisClient?.get(`${ParticipantIDs[index].id}:gps`) || null
            if (null !== cacheData) {
              const result = JSON.parse(cacheData)
              ParticipantIDs[index].gps = result.gps
            } else {
              const gps =
                (await SensorEventRepository._select(ParticipantIDs[index].id, "lamp.gps", undefined, undefined, 5)) ??
                (await SensorEventRepository._select(ParticipantIDs[index].id, "beiwe.gps", undefined, undefined, 5))

              ParticipantIDs[index].gps = gps
              CacheDataQueue.add({
                key: `${ParticipantIDs[index].id}:gps`,
                payload: { gps: gps },
              })
            }
          }
        } catch (error) {}
        try {
          //Fetch participant's accelerometer data i.e mode=1
          if (mode === 1) {
            //fetch data from redis if any
            const cacheData = await RedisClient?.get(`${ParticipantIDs[index].id}:accelerometer`) || null
            if (null !== cacheData) {
              const result = JSON.parse(cacheData)
              ParticipantIDs[index].accelerometer = result.accelerometer
            } else {
              const accelerometer =
                (await SensorEventRepository._select(
                  ParticipantIDs[index].id,
                  "lamp.accelerometer",
                  undefined,
                  undefined,
                  5
                )) ??
                (await SensorEventRepository._select(
                  ParticipantIDs[index].id,
                  "beiwe.accelerometer",
                  undefined,
                  undefined,
                  5
                ))

              ParticipantIDs[index].accelerometer = accelerometer
              CacheDataQueue.add({
                key: `${ParticipantIDs[index].id}:accelerometer`,
                payload: { accelerometer: accelerometer },
              })
            }
          }
        } catch (error) {}
        try {
          //Fetch participant's analytics data i.e mode=1
          if (mode === 1) {
            //fetch data from redis if any
            const cacheData = await RedisClient?.get(`${ParticipantIDs[index].id}:analytics`) || null
            if (null !== cacheData) {
              const result = JSON.parse(cacheData)
              ParticipantIDs[index].analytics = result.analytics
            } else {
              console.log("analytics cache absent")
              const analytics = await SensorEventRepository._select(
                ParticipantIDs[index].id,
                "lamp.analytics",
                undefined,
                undefined,
                1
              )
              ParticipantIDs[index].analytics = analytics
              CacheDataQueue.add({
                key: `${ParticipantIDs[index].id}:analytics`,
                payload: { analytics: analytics },
              })
            }
          }
        } catch (error) {}
        try {
          //Fetch participant's active data i.e mode=2
          if (mode === 2) {
            //fetch data from redis if any
            const cacheData = await RedisClient?.get(`${ParticipantIDs[index].id}:active`) || null
            if (null !== cacheData) {
              const result = JSON.parse(cacheData)
              ParticipantIDs[index].active = result.active
            } else {
              const active = await ActivityEventRepository._select(
                ParticipantIDs[index].id,
                undefined,
                undefined,
                undefined,
                1
              )
              ParticipantIDs[index].active = active
              CacheDataQueue.add({
                key: `${ParticipantIDs[index].id}:active`,
                payload: { active: active },
              })
            }
          }
        } catch (error) {}
      }

      res.json({ participants: ParticipantIDs })
    }
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
