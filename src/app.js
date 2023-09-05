require('dotenv').config()

const fs = require('fs')
const path = require('path')

const express = require('express')
const { createClient, defineScript } = require('redis')
const bodyParser = require('body-parser')
const timeout = require('connect-timeout')
const log = require('@harrytwright/logger')

const app = express()
const port = process.env.PORT || 3000

// Add a custom script, this just helps move the sales being processed away from the queue
const customScriptPath = path.join(__dirname, '../lua/process-sales.lua')

const script = fs.readFileSync(customScriptPath).toString('utf8')

const client = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  pingInterval: 1 * 60 * 1000,
  scripts: {
    LFULLMOVE: defineScript({
      NUMBER_OF_KEYS: 1,
      SCRIPT: script,
      transformArguments(...args) {
        return args
      },
      transformReply(reply) {
        return reply;
      }
    })
  }
});

client.on('error', err => {
  log.error('redis', err, 'Redis Client Error')

  if (err.code === 'ECONNREFUSED') {
    log.warn('init', 'Closing due to error')
    process.exit(1)
  }
});

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

const center = {
  support_items: 'Y',
  support_screens: 'Y',
  poll_rate: 10
}

const getRandom = () => Math.floor(Math.random() * 100)

app.post('/customers/:centre', missingCentre, async (req, res) => {
  const { centre } = req.params
  const { cust_id } = req.body
  
  const ID = getRandom()
  
  await client.set(`${centre}:customers:${cust_id}`, JSON.stringify({ ID, ...req.body }))
  
  return res.status(200).json({ id: ID, cust_id })
})

app.patch('/customers/:centre/:customer', missingCentre, async (req, res) => {
  const { centre, customer } = req.params
  const { cust_id } = req.body
  
  const value = JSON.parse(await client.get(`${centre}:customers:${cust_id}`))
   
  await client.set(`${centre}:customers:${cust_id}`, JSON.stringify({ ID: value.ID, ...req.body }))
  await client.zAdd(`${centre}:customers:${cust_id}:history`, [{ score: new Date().getTime(), value: JSON.stringify(value)}])
  
  return res.status(200).json({ id: value.id, cust_id })
})

app.post('/bookings/:centre', missingCentre, async (req, res) => {
  const { centre } = req.params
  const { book_id } = req.body
  
  const ID = getRandom()
  
  await client.set(`${centre}:bookings:${book_id}`, JSON.stringify({ id: ID, ...req.body }))
  
  return res.status(200).json({ id: ID, book_id })
})

app.patch('/bookings/:centre/:booking', missingCentre, async (req, res) => {
  const { centre, booking } = req.params
  const { book_id } = req.body
  
  const value = JSON.parse(await client.get(`${centre}:bookings:${book_id}`))
   
  await client.set(`${centre}:bookings:${book_id}`, JSON.stringify({ id: value.id, ...req.body }))
  await client.zAdd(`${centre}:bookings:${book_id}:history`, [{ score: new Date().getTime(), value: JSON.stringify(value)}])
  
  return res.status(200).json({ id: value.id, book_id })
})


app.get('/:centre/status', timeout('5s'), missingCentre, async (req, res) => {
  const { centre } = req.params

  const sales = (await client.LFULLMOVE(`${centre}:sales:queue`) || []).map(el => JSON.parse(el))

  const body = { sales, center }

  // Set these as we don't want any caching
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", 0);

  return res.status(200).json(body)
})

app.patch('/sales/:centre/:sale', timeout('5s'), missingCentre, async (req, res, next) => {
  const { centre, sale } = req.params
  // const { sale_id, accepted, order_ready } = req.body

  try {
	  await client.zAdd(
		`${centre}:sales:queue:processing:${sale}`,
		[{ score: new Date().getTime(), value: JSON.stringify(req.body)}]
	)
  } catch (err) {
	  return next(err)
  }

  // TODO: See what happens above and uncomment
  // const args = [`${centre}:sales:queue:processing`, sale]
  //
  // // Technically `isDeletedInt` is not correct, but it's either 0 as not deleted and 1 as deleted
  // const [element, isDeletedInt] = await client.multi().hGet(...args).hDel(...args).exec()
  //
  // if (!element) {
  //   return res.status(404).json({ error: `Unable to find order ${sale}` })
  // } else if (isDeletedInt === 0) {
  //   return res.status(404).json({ error: `Failed to delete order ${sale}` })
  // }

  return res.status(200).json({ status: 'Patched' })
})

client.connect().then(() => {
  log.info('init', 'Connected to redis')

  log.info('init', `Starting ${process.title}`)
  app.listen(port, () => {
    log.info('init', `${process.title} listening on port ${port}`)
  })
})
