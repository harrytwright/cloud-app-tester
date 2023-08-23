const express = require('express')
const bodyParser = require('body-parser')
const timeout = require('connect-timeout')

const app = express()
const port = process.env.PORT || 3000

app.set('views', process.cwd() + '/public/views')
app.set('view engine', 'ejs')

app.use(require('morgan')('dev'))
app.use(bodyParser.json())

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

  return res.status(204).end()
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

  database.get(centre).items.push(req.body)
  return res.status(201).json({ id: item_id, item_id })
})

app.put('/items/:centre/:item', missingCentre, (req, res) => {
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
