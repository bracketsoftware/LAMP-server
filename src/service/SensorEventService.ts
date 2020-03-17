import { Request, Response, Router } from 'express'
import { SensorEvent } from '../model/SensorEvent'
import { SensorEventRepository } from '../repository/SensorEventRepository'
import { SecurityContext, ActionContext, _verify } from './Security'
import jsonata from 'jsonata'

export const SensorEventService = Router()
SensorEventService.post('/participant/:participant_id/sensor_event', async (req: Request, res: Response) => {
	try {
		let participant_id = req.params.participant_id
		let sensor_event = req.body
		participant_id = await _verify(req.get('Authorization'), ['self', 'sibling', 'parent'], participant_id)
		let output = { data: await SensorEventRepository._insert(participant_id, Array.isArray(sensor_event) ? sensor_event : [sensor_event]) }
		res.json(output)
	} catch(e) {
		if (e.message === '401.missing-credentials')
			res.set('WWW-Authenticate', `Basic realm="LAMP" charset="UTF-8"`)
		res.status(parseInt(e.message.split('.')[0]) || 500).json({ error: e.message })
	}
})
SensorEventService.delete('/participant/:participant_id/sensor_event', async (req: Request, res: Response) => {
	try {
		let participant_id = req.params.participant_id
		let origin = req.query.origin
		let from = req.query.from
		let to = req.query.to
		participant_id = await _verify(req.get('Authorization'), ['self', 'sibling', 'parent'], participant_id)
		let output = { data: await SensorEventRepository._delete(participant_id, origin, from, to) }
		res.json(output)
	} catch(e) {
		if (e.message === '401.missing-credentials')
			res.set('WWW-Authenticate', `Basic realm="LAMP" charset="UTF-8"`)
		res.status(parseInt(e.message.split('.')[0]) || 500).json({ error: e.message })
	}
})
SensorEventService.get('/participant/:participant_id/sensor_event', async (req: Request, res: Response) => {
	try {
		let participant_id = req.params.participant_id
		let origin = req.query.origin
		let from = req.query.from
		let to = req.query.to
		let limit = Math.min(Math.max(req.query.limit ?? 1000, 0), 1000) // clamped to [0, 1000]
		participant_id = await _verify(req.get('Authorization'), ['self', 'sibling', 'parent'], participant_id)
		let output = { data: await SensorEventRepository._select(participant_id, origin, from, to, limit) }
		output = typeof req.query.transform === 'string' ? jsonata(req.query.transform).evaluate(output) : output
		res.json(output)
	} catch(e) {
		if (e.message === '401.missing-credentials')
			res.set('WWW-Authenticate', `Basic realm="LAMP" charset="UTF-8"`)
		res.status(parseInt(e.message.split('.')[0]) || 500).json({ error: e.message })
	}
})
SensorEventService.get('/study/:study_id/sensor_event', async (req: Request, res: Response) => {
	try {
		let study_id = req.params.study_id
		let origin = req.query.origin
		let from = req.query.from
		let to = req.query.to
		let limit = Math.min(Math.max(req.query.limit ?? 1000, 0), 1000) // clamped to [0, 1000]
		study_id = await _verify(req.get('Authorization'), ['self', 'sibling', 'parent'], study_id)
		let output = { data: await SensorEventRepository._select(study_id, origin, from, to, limit) }
		output = typeof req.query.transform === 'string' ? jsonata(req.query.transform).evaluate(output) : output
		res.json(output)
	} catch(e) {
		if (e.message === '401.missing-credentials')
			res.set('WWW-Authenticate', `Basic realm="LAMP" charset="UTF-8"`)
		res.status(parseInt(e.message.split('.')[0]) || 500).json({ error: e.message })
	}
})
SensorEventService.get('/researcher/:researcher_id/sensor_event', async (req: Request, res: Response) => {
	try {
		let researcher_id = req.params.researcher_id
		let origin = req.query.origin
		let from = req.query.from
		let to = req.query.to
		let limit = Math.min(Math.max(req.query.limit ?? 1000, 0), 1000) // clamped to [0, 1000]
		researcher_id = await _verify(req.get('Authorization'), ['self', 'sibling', 'parent'], researcher_id)
		let output = { data: await SensorEventRepository._select(researcher_id, origin, from, to, limit) }
		output = typeof req.query.transform === 'string' ? jsonata(req.query.transform).evaluate(output) : output
		res.json(output)
	} catch(e) {
		if (e.message === '401.missing-credentials')
			res.set('WWW-Authenticate', `Basic realm="LAMP" charset="UTF-8"`)
		res.status(parseInt(e.message.split('.')[0]) || 500).json({ error: e.message })
	}
})
