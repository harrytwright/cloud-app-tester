const { faker } = require('@faker-js/faker');

let id = 0

const createSale = (id) => () => ({
  ID: id++,
  createdAt: (new Date()).toISOString(),
  area: 'Lanes',
  lane: faker.number.int({ min: 1, max: 12 }),
  name: faker.person.fullName(),
  phone: faker.phone.number('07### ######'),
  payments: [
    { paid: 800, timestamp: (new Date()).toISOString(), payment_ref: faker.string.uuid() }
  ],
  items: [{ ID: 102 }, { ID: 104, modifier: 'true' }],
  notes: 'Could I get some chili flakes if you have please'
})

console.log(...faker.helpers.multiple(createSale(id), { count: 1 }).map((el) =>
  `\"${JSON.stringify(el).replace(/\\/g, "\\\\")
    .replace(/\$/g, "\\$")
    .replace(/'/g, "\\'")
    .replace(/"/g, "\\\"")}\"`))
