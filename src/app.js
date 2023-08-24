const express = require('express')
const bodyParser = require('body-parser')
const timeout = require('connect-timeout')

const app = express()
const port = process.env.PORT || 3000

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
    console.log(error.body)

    try {
      req.body = JSON.parse(traverse(error.body))
      return next()
    } catch (_) {
      return next(error)
    }
  }

  return next(error)
}

app.set('views', process.cwd() + '/public/views')
app.set('view engine', 'ejs')

app.use(require('morgan')('dev'))
app.use(bodyParser.json())
app.use(fixBodyParser)

const homepage = (req, res, next) =>
  res.render('homepage.html.ejs', { headers: req.headers, query: req.query })

app.get('/', homepage)
app.get('/homepage', homepage)

const database = new Map([])

app.patch('/config/:centre', timeout('5s'), (req, res) => {
  if (database.has(req.params.centre)) {
    database.get(req.params.centre).config = req.body
  } else {
    database.set(req.params.centre, { config: req.body, items: [] })
  }

  return res.status(200).send('accepted')
})

const missingCentre = (req, res, next) => {
  const { centre } = req.params
  if (!database.has(centre))
    return res.status(404).json({ error: `Unable to find ${centre}` })
  return next()
}

app.get('/items/:centre', missingCentre, (req, res) => {
  const { centre } = req.params
  return res.status(200).json(database.get(centre).items)
})

app.post('/items/:centre', missingCentre, (req, res) => {
  const { centre } = req.params
  const { item_id } = req.body
  
  const idx = database.get(centre).items.findIndex((el) => el.item_id === item_id)
  if (idx === -1)
	  database.get(centre).items.push(req.body)
  else
	  database.get(centre).items[idx] = req.body

  return res.status(201).json({ id: item_id, item_id })
})

app.put('/items/:centre/:item', fixBodyParser, missingCentre, (req, res) => {
  const { centre, item } = req.params

  const idx = database.get(centre).items.findIndex((el) => el.item_id === item)
  if (idx === -1)
    return res.status(404).json({ error: `Unable to find ${item}` })

  database.get(centre).items[idx] = req.body

  return res.status(200).json({ id: item, item_id: item })
})

app.get('/:centre', missingCentre, (req, res) => {
  const { centre } = req.params
  return res.status(200).json(database.get(centre).config)
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

app.listen(port, () => {
  console.log(`${process.title} listening on port ${port}`)
})
