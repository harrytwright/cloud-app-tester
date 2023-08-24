const express = require('express')
const { createClient } = require('redis')
const bodyParser = require('body-parser')
const timeout = require('connect-timeout')
const log = require('@harrytwright/logger')

const app = express()
const port = process.env.PORT || 3000

const client = createClient();

client.on('error', err =>
  log.error('redis', err, 'Redis Client Error')
);

const traverse = (buffer) => {
  let data = ''
  for (let i = 0; i < buffer.length; i++) {
    const bufferElement = buffer[i]
    if (bufferElement === '"') {
      if (['{', ',', ':', '\\'].includes(buffer[i - 1]) || ['}', ',', ':'].includes(buffer[i + 1])) {
        data += bufferElement
      } else {
        data += '\\'
        data += bufferElement
      }
    } else {
      data += bufferElement
    }
  }
  return data
}

const fixBodyParser = (error, req, res, next) => {
  if (error instanceof SyntaxError) {
    log.warn('body-parser', error, 'Failed to parse body')
    try {
      req.body = JSON.parse(traverse(error.body))
      return next()
    } catch (err) {
      log.warn('body-parser:fix', err, 'Failed to parse traversed body')
      return next(error)
    }
  }

  return next(error)
}

app.set('views', process.cwd() + '/public/views')
app.set('view engine', 'ejs')

app.use(require('./morgan').morgan(log))
app.use(bodyParser.json())
app.use(fixBodyParser)

const homepage = (req, res, next) =>
  res.render('homepage.html.ejs', { headers: req.headers, query: req.query })

app.get('/', homepage)
app.get('/homepage', homepage)

app.patch('/config/:centre', timeout('5s'), async (req, res) => {
  const { centre } = req.params
  if (!await client.exists(centre)) {
    res.status(201)
  } else {
    res.status(200)
  }

  await client.set(centre, JSON.stringify(req.body))

  return res.send('accepted')
})

const missingCentre = async (req, res, next) => {
  const { centre } = req.params
  if (!await client.exists(centre))
    return res.status(404).json({ error: `Unable to find ${centre}` })
  return next()
}

app.get('/items/:centre', missingCentre, async (req, res) => {
  const { centre } = req.params
  const items = await client.hVals(`${centre}:items`)
  return res.status(200).json(items.map((el) => JSON.parse(el)))
})

app.post('/items/:centre', missingCentre, async (req, res) => {
  const { centre } = req.params
  const { item_id } = req.body

  await client.hSet(`${centre}:items`, item_id, JSON.stringify(req.body))

  return res.status(201).json({ id: item_id, item_id })
})

app.put('/items/:centre/:item', missingCentre, async (req, res) => {
  const { centre, item } = req.params
  const { item_id } = req.body

  if (item_id != item)
    return res.status(412).json({ error: `The item id in the URI does not match the item_id in the body` })

  if (!await client.hExists(`${centre}:items`, item))
    return res.status(404).json({ error: `Unable to find ${item}` })

  await client.hSet(`${centre}:items`, item, JSON.stringify(req.body))

  return res.status(200).json({ id: item, item_id: item })
})

app.delete('/items/:centre/:item', missingCentre, async (req, res) => {
  const { centre, item } = req.params

  if (!await client.hExists(`${centre}:items`, item))
    return res.status(400).json({ error: `Unable to find ${item}` })

  await client.hDel(`${centre}:items`, item)

  return res.status(200).send('deleted')
})

app.get('/:centre', missingCentre, async (req, res) => {
  const { centre } = req.params
  return res.status(200).json(JSON.parse(await client.get(centre)))
})

app.get('/:centre/status', missingCentre, (req, res) => {
  const body = {
    center: {
      support_items: 'Y',
      support_screens: 'Y',
      poll_rate: 10
    },
    sales: []
  }

  return res.status(200).json(body)
})

client.connect().then(() => {
  log.info('init', 'Connected to redis')

  log.info('init', `Starting ${process.title}`)
  app.listen(port, () => {
    log.info('init', `${process.title} listening on port ${port}`)
  })
})
