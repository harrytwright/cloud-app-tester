## TouchDesk Interface Bug

### Steps to reproduce

> This is very basic steps, a little still zonked with jet lag, I hope it makes sense

1. Run `npm install`
2. Set up Cloud app inside TouchDesk as stated by previous emails, setting the HOST URL as `http://localhost:3000`
3. Run `node www.js`
4. Wait for logs to show `PATCH /config/${USER_ID}`
5. Create the items as shown inside [`./invalid.json`](./invalid.json), so one `Pizza` item, 
   `9"` Item, `12"` Item, Create the ItemList with the `9"` and `12"` and link that to the Pizza
6. Save to the Cloud App Screen that will allow the `POST` request to be called
7. See logs for error

If you wish to see a mini fix, uncomment line 30-35 and that should pass
